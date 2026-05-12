import { cn } from '@/lib/utils'
import { Field, Input, Select } from './primitives'
import { normalizePhoneSuffix } from '@/lib/utils'

export interface SourcePickerProps {
  sourceType: 'network' | 'client'
  onSourceTypeChange: (next: 'network' | 'client') => void
  networkId: string
  onNetworkIdChange: (id: string) => void
  phoneSuffix: string
  onPhoneSuffixChange: (suffix: string) => void
  networks: { id: string; name: string }[]
  required?: boolean
}

export function SourcePicker({
  sourceType,
  onSourceTypeChange,
  networkId,
  onNetworkIdChange,
  phoneSuffix,
  onPhoneSuffixChange,
  networks,
  required,
}: SourcePickerProps) {
  return (
    <div className="space-y-2">
      <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-sm">
        <button
          type="button"
          onClick={() => onSourceTypeChange('network')}
          className={cn(
            'rounded-md px-3 py-1.5 font-medium transition-all duration-150',
            sourceType === 'network'
              ? 'bg-surface-2 text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Торгова мережа
        </button>
        <button
          type="button"
          onClick={() => onSourceTypeChange('client')}
          className={cn(
            'rounded-md px-3 py-1.5 font-medium transition-all duration-150',
            sourceType === 'client'
              ? 'bg-surface-2 text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Клієнт (телефон)
        </button>
      </div>
      {sourceType === 'network' ? (
        <Field label="Торгова мережа" required={required}>
          <Select value={networkId} onChange={(e) => onNetworkIdChange(e.target.value)}>
            <option value="">Оберіть…</option>
            {networks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <Field label="Телефон клієнта" required={required} hint="9 цифр після +380">
          <div className="flex items-stretch overflow-hidden rounded-lg border border-border focus-within:ring-2 focus-within:ring-primary/40">
            <span className="flex items-center bg-surface-2 px-3 text-sm font-mono text-muted-foreground">
              +380
            </span>
            <Input
              value={phoneSuffix}
              onChange={(e) => onPhoneSuffixChange(normalizePhoneSuffix(e.target.value))}
              inputMode="numeric"
              autoComplete="tel-national"
              className="rounded-none border-0 font-mono shadow-none focus-visible:ring-0"
              placeholder="501112233"
              maxLength={9}
            />
          </div>
        </Field>
      )}
    </div>
  )
}
