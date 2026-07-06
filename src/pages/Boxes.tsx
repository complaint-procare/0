import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Boxes, Database, FileSpreadsheet, Loader2 } from 'lucide-react'
import { BoxesControls } from '@/components/boxes/BoxesControls'
import { BoxResultCard } from '@/components/boxes/BoxResultCard'
import {
  formatBoxDims,
  formatBoxNumber,
  initialBoxForm,
  loadBoxes,
  matchBoxes,
  normalizeCalculatorInput,
  type BoxCalculatorForm,
  type BoxDataSource,
  type BoxMatchResult,
} from '@/lib/boxes'
import '@/components/boxes/boxes.css'

function buildPreviewText(form: BoxCalculatorForm) {
  const hasAnyDimension = [form.length, form.width, form.height].some((value) => String(value || '').trim())
  if (!hasAnyDimension) return 'введіть розміри однієї одиниці'

  const normalized = normalizeCalculatorInput(form)
  if (!normalized.ok) return normalized.error

  const input = normalized.input
  const adjustment = input.adjustment_mm
    ? ` · ${input.adjustment_mode === 'subtract' ? '-' : '+'}${formatBoxNumber(input.adjustment_mm)} мм`
    : ''
  return `${formatBoxDims([input.length_cm, input.width_cm, input.height_cm])}${adjustment}`
}

function sourceIcon(source: string) {
  return source === 'supabase' ? <Database size={18} /> : <FileSpreadsheet size={18} />
}

export function BoxesPage() {
  const [form, setForm] = useState<BoxCalculatorForm>(initialBoxForm)
  const [data, setData] = useState<BoxDataSource | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [result, setResult] = useState<BoxMatchResult | null>(null)
  const [message, setMessage] = useState('Введіть розміри товару і кількість.')

  useEffect(() => {
    let active = true

    loadBoxes()
      .then((next) => {
        if (!active) return
        setData(next)
        setLoadError('')
      })
      .catch((error) => {
        if (!active) return
        setLoadError(error instanceof Error ? error.message : 'Не вдалося завантажити коробки.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const previewText = useMemo(() => buildPreviewText(form), [form])
  const best = result?.ok ? result.matches[0] : undefined
  const boxes = data?.boxes ?? []
  const canSubmit = !loading && !loadError && boxes.length > 0

  function runCalculation() {
    if (!canSubmit) return
    const next = matchBoxes(boxes, form)

    if (!next.ok) {
      setResult(null)
      setMessage(next.error)
      return
    }

    setResult(next)
    setMessage(
      next.matches.length
        ? `Знайдено ${next.matches.length} варіантів із ${next.total_boxes}.`
        : 'Під ці розміри коробку не знайдено.',
    )
  }

  function resetForm() {
    setForm(initialBoxForm)
    setResult(null)
    setMessage('Введіть розміри товару і кількість.')
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    runCalculation()
  }

  return (
    <div className="boxes-page">
      <main className="app-shell">
        <header className="app-header">
          <div>
            <div className="header-kicker">
              <Boxes size={20} /> Коробки
            </div>
            <h1>Підбір коробки</h1>
          </div>
          <div className="source-pill" title={data?.generatedAt ? `Оновлено ${data.generatedAt}` : undefined}>
            {loading ? <Loader2 size={18} className="spin" /> : sourceIcon(data?.source ?? 'box.xlsx')}
            <span>{loading ? 'завантаження' : `${boxes.length} шт`}</span>
          </div>
        </header>

        {loadError && (
          <div className="state-banner error" role="alert">
            <AlertCircle size={19} /> {loadError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <BoxesControls
            form={form}
            onChange={setForm}
            onSubmit={runCalculation}
            onReset={resetForm}
            disabled={!canSubmit}
            previewText={previewText}
          />
        </form>

        {best && (
          <section className="box-summary" aria-label="Найкращий варіант">
            <span>Найкраща</span>
            <strong>{best.article ? `Арт. ${best.article}` : best.name}</strong>
            <small>
              {formatBoxDims(best)} · вміщає {best.capacity} шт · вільно {formatBoxNumber(best.free_volume_cm3, 0)} см3
            </small>
          </section>
        )}

        <section className="result-status" aria-live="polite">
          {message}
        </section>

        <section className="box-results" aria-label="Результати підбору">
          {result?.ok && result.matches.length ? (
            result.matches.map((box, index) => (
              <BoxResultCard key={`${box.source_row}-${index}`} box={box} index={index} input={result.input} />
            ))
          ) : (
            <div className="empty-state">
              <Boxes size={32} /> {loading ? 'Завантажую коробки...' : message}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
