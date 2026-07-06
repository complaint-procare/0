import { useMemo, useState } from 'react'
import { CheckCircle2, Ruler } from 'lucide-react'
import { BoxVisual } from './BoxVisual'
import {
  applyPlan,
  fitBoxPlan,
  formatBoxDims,
  formatBoxInputNumber,
  formatBoxNumber,
  parsePositiveNumber,
  titleForBox,
  type BoxCalculatorInput,
  type BoxMatch,
} from '@/lib/boxes'

function describePlan(box: BoxMatch, qty: number) {
  const modes = []
  if (box.upright_only) modes.push('тільки стоячі')
  if (box.mixed_stack) modes.push('стоячі + зверху')

  if (box.packing_mode === 'mixed_stack') {
    const standing = box.segments?.find((segment) => segment.type === 'upright')
    const lying = box.segments?.find((segment) => segment.type === 'lying_top')
    const standingText = standing ? `стоячі ${standing.capacity} шт (${formatBoxDims(standing.orientation)})` : ''
    const lyingText = lying ? `зверху ${lying.capacity} шт (${formatBoxDims(lying.orientation)})` : ''
    return `Розкладка: ${[standingText, lyingText].filter(Boolean).join(' + ')}${modes.length ? ` · ${modes.join(' · ')}` : ''}`
  }

  return `Розкладка: ${box.counts.join(' x ')} шт · поворот ${formatBoxDims(box.orientation)}${modes.length ? ` · ${modes.join(' · ')}` : ''}`
}

function recalcBox(baseBox: BoxMatch, draft: { length: string; width: string; height: string }, input: BoxCalculatorInput) {
  const length = parsePositiveNumber(draft.length)
  const width = parsePositiveNumber(draft.width)
  const height = parsePositiveNumber(draft.height)
  if (!length || !width || !height) return null

  const customBox = {
    ...baseBox,
    length_cm: length,
    width_cm: width,
    height_cm: height,
  }
  const itemDims = [input.length_cm, input.width_cm, input.height_cm]
  const plan = fitBoxPlan(customBox, itemDims, {
    qty: input.qty,
    uprightOnly: input.upright_only,
    mixedStack: input.mixed_stack,
  })
  return applyPlan(customBox, plan, input)
}

export function BoxResultCard({
  box,
  index,
  input,
}: {
  box: BoxMatch
  index: number
  input: BoxCalculatorInput
}) {
  const [draft, setDraft] = useState({
    length: formatBoxInputNumber(box.length_cm),
    width: formatBoxInputNumber(box.width_cm),
    height: formatBoxInputNumber(box.height_cm),
  })

  const calculated = useMemo(() => recalcBox(box, draft, input), [box, draft, input])
  const activeBox = calculated || box
  const fits = calculated ? calculated.capacity >= input.qty : true
  const itemNote = input.adjustment_mm
    ? `1 одиниця для прорахунку: ${formatBoxDims([input.length_cm, input.width_cm, input.height_cm])} · ${input.adjustment_mode === 'subtract' ? '-' : '+'}${formatBoxNumber(input.adjustment_mm)} мм`
    : `1 одиниця для прорахунку: ${formatBoxDims([input.length_cm, input.width_cm, input.height_cm])}`

  function updateDraft(key: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  return (
    <article className={`box-card ${index === 0 ? 'best' : ''} ${!fits ? 'does-not-fit' : ''}`}>
      <header className="box-card-head">
        <div>
          <h2>{titleForBox(activeBox)}</h2>
          <p>{formatBoxDims(activeBox)}</p>
        </div>
        {index === 0 && (
          <span className="best-badge">
            <CheckCircle2 size={15} /> Найкраща
          </span>
        )}
      </header>

      <div className="box-size-editor">
        <div className="size-editor-head">
          <span>
            <Ruler size={14} /> Перерахунок коробки
          </span>
          <strong>{formatBoxNumber(activeBox.volume_cm3, 0)} см3</strong>
        </div>
        <div className="size-mini-grid">
          <label>
            <span>Д</span>
            <input value={draft.length} inputMode="decimal" onChange={(event) => updateDraft('length', event.target.value)} />
          </label>
          <label>
            <span>Ш</span>
            <input value={draft.width} inputMode="decimal" onChange={(event) => updateDraft('width', event.target.value)} />
          </label>
          <label>
            <span>В</span>
            <input value={draft.height} inputMode="decimal" onChange={(event) => updateDraft('height', event.target.value)} />
          </label>
        </div>
        <small>{calculated ? (fits ? 'перераховано' : `не вміщає ${input.qty} шт`) : 'вкажіть три розміри'}</small>
      </div>

      <div className="box-metrics">
        <div>
          <span>Місткість</span>
          <strong>{activeBox.capacity} шт</strong>
        </div>
        <div>
          <span>Заповнення</span>
          <strong>{formatBoxNumber(activeBox.fill_percent)}%</strong>
        </div>
        <div>
          <span>Вільно</span>
          <strong>{formatBoxNumber(activeBox.free_volume_cm3, 0)} см3</strong>
        </div>
      </div>

      <div className="item-adjust-note">{itemNote}</div>
      <BoxVisual box={activeBox} qty={input.qty} />
      <p className="box-layout">{describePlan(activeBox, input.qty)}</p>
      {activeBox.note && <p className="box-note">{activeBox.note}</p>}
    </article>
  )
}
