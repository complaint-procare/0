import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { v4 as uuid } from 'uuid'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'

async function loadXLSX() {
  return await import('xlsx')
}
import { Button } from '@/components/ui/primitives'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { insert, list } from '@/lib/db'
import type { Brand, Product } from '@/lib/types'

interface ParsedRow {
  name: string
  sku: string
  brandName: string
  warning?: string
}

const HEADER_ALIASES: Record<keyof ParsedRow, string[]> = {
  name: ['назва', 'назва продукту', 'назва товару', 'name', 'product', 'product name', 'товар'],
  sku: ['sku', 'артикул', 'штрихкод', 'barcode', 'код', 'ean'],
  brandName: ['бренд', 'brand', 'марка', 'виробник'],
  warning: [],
}

function normalizeKey(k: string): string {
  return k.toString().trim().toLowerCase()
}

function detectColumn(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = headers.findIndex((h) => normalizeKey(h) === alias)
    if (idx !== -1) return idx
  }
  return -1
}

export function ProductsExcelImport() {
  const toast = useToast()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [createMissingBrands, setCreateMissingBrands] = useState(true)

  const reset = () => {
    setRows([])
    setFileName('')
    setImporting(false)
  }

  const handleFile = async (file: File) => {
    setFileName(file.name)
    try {
      const XLSX = await loadXLSX()
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      if (!sheet) throw new Error('У файлі немає аркушів')
      const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })
      if (json.length < 2) {
        toast.show('Файл порожній або немає рядків даних', 'error')
        return
      }
      const headers = (json[0] as unknown[]).map((h) => String(h ?? ''))
      const idxName = detectColumn(headers, HEADER_ALIASES.name)
      const idxSku = detectColumn(headers, HEADER_ALIASES.sku)
      const idxBrand = detectColumn(headers, HEADER_ALIASES.brandName)
      if (idxName === -1) {
        toast.show('Не знайдено колонку «Назва»', 'error')
        return
      }
      const parsed: ParsedRow[] = []
      for (let i = 1; i < json.length; i++) {
        const r = json[i] as unknown[]
        const name = String(r[idxName] ?? '').trim()
        if (!name) continue
        parsed.push({
          name,
          sku: idxSku === -1 ? '' : String(r[idxSku] ?? '').trim(),
          brandName: idxBrand === -1 ? '' : String(r[idxBrand] ?? '').trim(),
        })
      }
      if (!parsed.length) {
        toast.show('Не знайдено рядків з назвою', 'error')
        return
      }
      setRows(parsed)
    } catch (e) {
      toast.show(`Не вдалось прочитати файл: ${(e as Error).message}`, 'error')
    }
  }

  const runImport = async () => {
    setImporting(true)
    try {
      const now = () => new Date().toISOString()
      const brands = await list('brands')
      const brandByName = new Map(brands.map((b) => [b.name.toLowerCase(), b]))
      let createdBrands = 0
      let createdProducts = 0
      let skipped = 0

      for (const r of rows) {
        let brandId: string | null = null
        if (r.brandName) {
          const existing = brandByName.get(r.brandName.toLowerCase())
          if (existing) {
            brandId = existing.id
          } else if (createMissingBrands) {
            const newBrand: Brand = {
              id: uuid(),
              name: r.brandName,
              is_active: true,
              created_at: now(),
            }
            await insert('brands', newBrand)
            brandByName.set(r.brandName.toLowerCase(), newBrand)
            brandId = newBrand.id
            createdBrands++
          } else {
            skipped++
            continue
          }
        }
        const product: Product = {
          id: uuid(),
          brand_id: brandId,
          name: r.name,
          sku: r.sku || undefined,
          is_active: true,
          created_at: now(),
        }
        await insert('products', product)
        createdProducts++
      }

      await qc.invalidateQueries({ queryKey: ['products'] })
      await qc.invalidateQueries({ queryKey: ['brands'] })
      const parts = [`Імпортовано продуктів: ${createdProducts}`]
      if (createdBrands) parts.push(`нових брендів: ${createdBrands}`)
      if (skipped) parts.push(`пропущено: ${skipped}`)
      toast.show(parts.join(', '), 'success')
      reset()
      setOpen(false)
    } catch (e) {
      toast.show((e as Error).message, 'error')
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = async () => {
    const XLSX = await loadXLSX()
    const ws = XLSX.utils.aoa_to_sheet([
      ['Назва', 'SKU', 'Бренд'],
      ['Кавовий скраб 200 мл', 'JB-CSCR-200', 'Joko Blend'],
      ['Молочко для тіла 250 мл', 'JB-BMLK-250', 'Joko Blend'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Products')
    XLSX.writeFile(wb, 'products-template.xlsx')
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="h-4 w-4" /> Імпорт з Excel
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
          reset()
        }}
        title="Імпорт продуктів з Excel"
        description="Підтримуються .xlsx, .xls, .csv. Очікувані колонки: Назва (обов'язково), SKU, Бренд."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4" /> Шаблон
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
                reset()
              }}
            >
              Скасувати
            </Button>
            <Button onClick={runImport} disabled={!rows.length || importing}>
              <Upload className="h-4 w-4" />
              {importing ? 'Імпорт…' : `Імпортувати (${rows.length})`}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="btn btn-outline cursor-pointer">
            <FileSpreadsheet className="h-4 w-4" />
            {fileName || 'Обрати файл…'}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                e.target.value = ''
              }}
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createMissingBrands}
              onChange={(e) => setCreateMissingBrands(e.target.checked)}
            />
            Створювати нові бренди, якщо їх немає у каталозі
          </label>

          {rows.length > 0 && (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Назва</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Бренд</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-1.5">{r.name}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{r.sku || '—'}</td>
                      <td className="px-3 py-1.5">{r.brandName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 20 && (
                <p className="border-t border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  …та ще {rows.length - 20} рядків.
                </p>
              )}
            </div>
          )}
        </div>
      </Dialog>
    </>
  )
}
