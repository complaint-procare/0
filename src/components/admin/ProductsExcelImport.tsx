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
import { insert, list, remove, update } from '@/lib/db'
import { supabaseEnabled } from '@/lib/supabase'
import type { Brand, Product } from '@/lib/types'

interface ParsedRow {
  externalId: string
  name: string
  sku: string
  brandName: string
}

type ImportColumn = keyof ParsedRow

type ProductImportMatch = Pick<Product, 'external_id' | 'brand_id' | 'name' | 'sku'>

const HEADER_ALIASES: Record<ImportColumn, string[]> = {
  externalId: ['id', 'ід', 'external id', 'product id', 'код товару', 'товар id'],
  name: ['назва', 'назва продукту', 'назва товару', 'name', 'product', 'product name', 'товар'],
  sku: ['sku', 'артикул', 'штрихкод', 'barcode', 'код', 'ean'],
  brandName: ['бренд', 'brand', 'марка', 'виробник'],
}

function normalizeKey(k: string): string {
  return k.toString().trim().toLowerCase()
}

function normalizeText(value: string | undefined | null): string {
  return String(value ?? '').trim().toLowerCase()
}

function productImportKeys(product: ProductImportMatch): string[] {
  const keys: string[] = []
  const externalId = normalizeText(product.external_id)
  const sku = normalizeText(product.sku)
  const name = normalizeText(product.name)

  if (externalId) keys.push('id:' + externalId)
  if (sku) keys.push('sku:' + sku)
  if (name) keys.push('name:' + (product.brand_id ?? '') + ':' + name)

  return keys
}

function addProductToIndex(map: Map<string, Product>, product: Product) {
  for (const key of productImportKeys(product)) {
    if (!map.has(key)) map.set(key, product)
  }
}

function findProductByImportKeys(
  map: Map<string, Product>,
  product: ProductImportMatch,
): Product | undefined {
  for (const key of productImportKeys(product)) {
    const existing = map.get(key)
    if (existing) return existing
  }
  return undefined
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
  const [exporting, setExporting] = useState(false)
  const [createMissingBrands, setCreateMissingBrands] = useState(true)
  const [deleteMissingProducts, setDeleteMissingProducts] = useState(false)

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
      const idxExternalId = detectColumn(headers, HEADER_ALIASES.externalId)
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
          externalId: idxExternalId === -1 ? '' : String(r[idxExternalId] ?? '').trim(),
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
      toast.show('Не вдалося прочитати файл: ' + (e as Error).message, 'error')
    }
  }

  const runImport = async () => {
    if (!supabaseEnabled) {
      toast.show(
        'Імпорт товарів має записуватися в Supabase. Перезапустіть або redeploy застосунок з VITE_SUPABASE_URL та VITE_SUPABASE_ANON_KEY.',
        'error',
      )
      return
    }
    setImporting(true)
    try {
      const now = () => new Date().toISOString()
      const brands = await list('brands')
      const brandByName = new Map(brands.map((b) => [b.name.toLowerCase(), b]))
      const existingProducts = await list('products')
      const productByKey = new Map<string, Product>()
      for (const product of existingProducts) addProductToIndex(productByKey, product)
      const touchedProductIds = new Set<string>()
      let createdBrands = 0
      let createdProducts = 0
      let updatedProducts = 0
      let deletedProducts = 0
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
              color: '#64748B',
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
        const productDraft: Omit<Product, 'id'> = {
          external_id: r.externalId || null,
          brand_id: brandId,
          name: r.name,
          sku: r.sku || null,
          is_active: true,
          created_at: now(),
        }

        const existingProduct = findProductByImportKeys(productByKey, productDraft)
        if (existingProduct) {
          const patch = {
            external_id: r.externalId || null,
            brand_id: brandId,
            name: r.name,
            sku: r.sku || null,
            is_active: true,
          }
          await update('products', existingProduct.id, patch)
          const updatedProduct: Product = { ...existingProduct, ...patch }
          addProductToIndex(productByKey, updatedProduct)
          touchedProductIds.add(existingProduct.id)
          updatedProducts++
        } else {
          const product: Product = {
            ...productDraft,
            id: uuid(),
          }
          await insert('products', product)
          addProductToIndex(productByKey, product)
          touchedProductIds.add(product.id)
          createdProducts++
        }
      }

      if (deleteMissingProducts) {
        for (const product of existingProducts) {
          if (!touchedProductIds.has(product.id)) {
            await remove('products', product.id)
            deletedProducts++
          }
        }
      }

      await qc.invalidateQueries({ queryKey: ['products'] })
      await qc.invalidateQueries({ queryKey: ['brands'] })
      const parts = ['Нових продуктів: ' + createdProducts]
      if (updatedProducts) parts.push('оновлено: ' + updatedProducts)
      if (deletedProducts) parts.push('видалено: ' + deletedProducts)
      if (createdBrands) parts.push('нових брендів: ' + createdBrands)
      if (skipped) parts.push('пропущено: ' + skipped)
      toast.show(parts.join(', '), 'success')
      reset()
      setOpen(false)
    } catch (e) {
      toast.show((e as Error).message, 'error')
    } finally {
      setImporting(false)
    }
  }

  const exportProducts = async () => {
    if (!supabaseEnabled) {
      toast.show('Експорт товарів доступний тільки з активним підключенням до Supabase.', 'error')
      return
    }
    setExporting(true)
    try {
      const XLSX = await loadXLSX()
      const [products, brands] = await Promise.all([list('products'), list('brands')])
      const brandById = new Map(brands.map((brand) => [brand.id, brand.name]))
      const rowsForExport = [
        ['id', 'Назва', 'SKU', 'Бренд', 'Активний'],
        ...[...products]
          .sort((a, b) => a.name.localeCompare(b.name, 'uk', { sensitivity: 'base' }))
          .map((product) => [
            product.external_id ?? '',
            product.name,
            product.sku ?? '',
            product.brand_id ? brandById.get(product.brand_id) ?? '' : '',
            product.is_active ? 'Так' : 'Ні',
          ]),
      ]
      const ws = XLSX.utils.aoa_to_sheet(rowsForExport)
      ws['!cols'] = [{ wch: 14 }, { wch: 58 }, { wch: 18 }, { wch: 22 }, { wch: 12 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Products')
      const date = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, 'products-export-' + date + '.xlsx')
      toast.show('Експортовано товарів: ' + products.length, 'success')
    } catch (e) {
      toast.show((e as Error).message, 'error')
    } finally {
      setExporting(false)
    }
  }

  const downloadTemplate = async () => {
    const XLSX = await loadXLSX()
    const ws = XLSX.utils.aoa_to_sheet([
      ['id', 'Назва', 'SKU', 'Бренд'],
      ['123', 'Кавовий скраб 200 мл', 'JB-CSCR-200', 'Joko Blend'],
      ['234', 'Молочко для тіла 250 мл', 'JB-BMLK-250', 'Joko Blend'],
    ])
    ws['!cols'] = [{ wch: 14 }, { wch: 42 }, { wch: 18 }, { wch: 22 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Products')
    XLSX.writeFile(wb, 'products-template.xlsx')
  }

  return (
    <>
      <Button variant="outline" onClick={exportProducts} disabled={exporting}>
        <Download className="h-4 w-4" /> {exporting ? 'Експорт…' : 'Експорт'}
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          if (!supabaseEnabled) {
            toast.show(
              'Імпорт товарів доступний тільки з активним підключенням до Supabase.',
              'error',
            )
            return
          }
          setOpen(true)
        }}
      >
        <FileSpreadsheet className="h-4 w-4" /> Імпорт з Excel
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
          reset()
        }}
        title="Імпорт продуктів з Excel"
        description="Підтримуються .xlsx, .xls, .csv. Очікувані колонки: id (необов’язково), Назва (обов’язково), SKU, Бренд. Якщо id або SKU збігається з існуючим товаром — товар буде оновлено."
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
              {importing ? 'Імпорт…' : 'Імпортувати (' + rows.length + ')'}
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
                if (f) void handleFile(f)
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

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={deleteMissingProducts}
              onChange={(e) => setDeleteMissingProducts(e.target.checked)}
            />
            Видаляти з Supabase товари, яких немає у файлі
          </label>

          {rows.length > 0 && (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Назва</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Бренд</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-1.5 font-mono text-xs">{r.externalId || '—'}</td>
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
