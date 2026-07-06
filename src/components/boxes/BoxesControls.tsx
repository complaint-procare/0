import { Box, Calculator, Layers3, RotateCcw, Search, ShieldPlus } from 'lucide-react'
import type { BoxCalculatorForm } from '@/lib/boxes'

export function BoxesControls({
  form,
  onChange,
  onSubmit,
  onReset,
  disabled,
  previewText,
}: {
  form: BoxCalculatorForm
  onChange: (next: BoxCalculatorForm) => void
  onSubmit: () => void
  onReset: () => void
  disabled: boolean
  previewText: string
}) {
  function setField<K extends keyof BoxCalculatorForm>(key: K, value: BoxCalculatorForm[K]) {
    onChange({ ...form, [key]: value })
  }

  return (
    <section className="calculator-panel" aria-label="Параметри товару">
      <div className="dimension-grid">
        <label>
          <span>Довжина, см</span>
          <input
            value={form.length}
            inputMode="decimal"
            autoComplete="off"
            placeholder="15,5"
            onChange={(event) => setField('length', event.target.value)}
          />
        </label>
        <label>
          <span>Ширина, см</span>
          <input
            value={form.width}
            inputMode="decimal"
            autoComplete="off"
            placeholder="10,5"
            onChange={(event) => setField('width', event.target.value)}
          />
        </label>
        <label>
          <span>Висота, см</span>
          <input
            value={form.height}
            inputMode="decimal"
            autoComplete="off"
            placeholder="18,5"
            onChange={(event) => setField('height', event.target.value)}
          />
        </label>
        <label>
          <span>Кількість</span>
          <input
            value={form.qty}
            inputMode="numeric"
            autoComplete="off"
            placeholder="1"
            onChange={(event) => setField('qty', event.target.value)}
          />
        </label>
      </div>

      <div className="adjust-grid">
        <label>
          <span>Поправка на кожну, мм</span>
          <input
            value={form.adjustmentMm}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            onChange={(event) => setField('adjustmentMm', event.target.value)}
          />
        </label>
        <div className="segmented" role="group" aria-label="Напрям поправки">
          <button
            type="button"
            className={form.adjustmentMode === 'add' ? 'active' : ''}
            onClick={() => setField('adjustmentMode', 'add')}
          >
            + Додати
          </button>
          <button
            type="button"
            className={form.adjustmentMode === 'subtract' ? 'active' : ''}
            onClick={() => setField('adjustmentMode', 'subtract')}
          >
            - Відняти
          </button>
        </div>
        <div className="adjust-preview" aria-live="polite">
          <Calculator size={16} /> {previewText}
        </div>
      </div>

      <div className="toggle-row">
        <label className="stand-toggle">
          <input
            type="checkbox"
            checked={form.uprightOnly}
            onChange={(event) => setField('uprightOnly', event.target.checked)}
          />
          <span>
            <ShieldPlus size={18} /> Тільки стоячі
          </span>
        </label>
        <label className="stand-toggle">
          <input
            type="checkbox"
            checked={form.mixedStack}
            onChange={(event) => setField('mixedStack', event.target.checked)}
          />
          <span>
            <Layers3 size={18} /> Стоячі + зверху
          </span>
        </label>
      </div>

      <div className="action-row">
        <button className="secondary-button" type="button" onClick={onReset}>
          <RotateCcw size={18} /> Очистити
        </button>
        <button className="primary-button" type="button" onClick={onSubmit} disabled={disabled}>
          <Search size={18} /> Підібрати <Box size={18} />
        </button>
      </div>
    </section>
  )
}
