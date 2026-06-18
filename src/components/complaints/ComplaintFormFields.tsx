import type { Dispatch, SetStateAction } from 'react'
import { Autocomplete } from '@/components/ui/autocomplete'
import { Field, Input, Select, Textarea } from '@/components/ui/primitives'
import { SourcePicker } from '@/components/ui/source-picker'
import type { ComplaintFormState } from '@/lib/complaint-form'
import type {
  ComplaintGroup,
  ComplaintStatus,
  Product,
  SeverityLevel,
} from '@/lib/types'

interface ComplaintFormLookups {
  brands: { id: string; name: string }[]
  products: Product[]
  networks: { id: string; name: string; is_active?: boolean }[]
  statuses: ComplaintStatus[]
  severities: SeverityLevel[]
  groups: ComplaintGroup[]
  users: { id: string; full_name: string }[]
}

interface ComplaintFormFieldsProps {
  form: ComplaintFormState
  setForm: Dispatch<SetStateAction<ComplaintFormState>>
  data: ComplaintFormLookups
  allowNewNetwork?: boolean
  showManager?: boolean
  showResolution?: boolean
  preservedValues?: {
    groupId?: string | null
    severityId?: string | null
    statusId?: string | null
  }
}

export function ComplaintFormFields({
  form,
  setForm,
  data,
  allowNewNetwork = false,
  showManager = false,
  showResolution = false,
  preservedValues,
}: ComplaintFormFieldsProps) {
  const productOptions = data.products
    .filter((product) => product.is_active && (!form.brand_id || product.brand_id === form.brand_id))
    .map((product) => ({
      key: product.id,
      label: product.name,
      hint: product.sku ?? undefined,
      value: product,
    }))
  const productEmptyHint = form.brand_id
    ? 'Для вибраного бренду товарів не знайдено — назва введеться як є'
    : 'Збігів немає — назва введеться як є'

  const update = (patch: Partial<ComplaintFormState>) => {
    setForm((current) => ({ ...current, ...patch }))
  }

  const changeBrand = (brandId: string) => {
    setForm((current) => {
      const catalogProduct = data.products.find(
        (product) =>
          product.is_active &&
          ((current.product_barcode && product.sku === current.product_barcode) ||
            product.name === current.product_name),
      )
      const keepProduct =
        !catalogProduct || !brandId || catalogProduct.brand_id === brandId
      return {
        ...current,
        brand_id: brandId,
        product_name: keepProduct ? current.product_name : '',
        product_barcode: keepProduct ? current.product_barcode : '',
      }
    })
  }

  return (
    <>
      <SourcePicker
        sourceType={form.source_type}
        onSourceTypeChange={(sourceType) => update({ source_type: sourceType })}
        networkId={form.retail_network_id}
        onNetworkIdChange={(retailNetworkId) =>
          update({ retail_network_id: retailNetworkId })
        }
        networkName={allowNewNetwork ? form.retail_network_name : undefined}
        onNetworkNameChange={
          allowNewNetwork
            ? (retailNetworkName) => update({ retail_network_name: retailNetworkName })
            : undefined
        }
        phoneSuffix={form.phone_suffix}
        onPhoneSuffixChange={(phoneSuffix) => update({ phone_suffix: phoneSuffix })}
        networks={data.networks}
        required
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {showManager && (
          <Field label="Менеджер" required>
            <Select
              value={form.manager_id}
              onChange={(event) => update({ manager_id: event.target.value })}
            >
              {data.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Назва продукту" required hint="Підказки беруться з каталогу продуктів">
          <Autocomplete<Product>
            value={form.product_name}
            onChange={(productName) => update({ product_name: productName })}
            onSelect={(option) =>
              update({
                product_name: option.value.name,
                product_barcode: option.value.sku ?? form.product_barcode,
                brand_id: option.value.brand_id ?? form.brand_id,
              })
            }
            options={productOptions}
            placeholder="Почніть вводити, напр., кавовий скраб"
            emptyHint={productEmptyHint}
          />
        </Field>

        <Field label="Штрихкод">
          <Input
            value={form.product_barcode}
            onChange={(event) =>
              update({ product_barcode: event.target.value.replace(/\s/g, '') })
            }
            inputMode="numeric"
            placeholder="Напр., 4820123456789"
          />
        </Field>

        <Field label="Бренд" required>
          <Select
            value={form.brand_id}
            onChange={(event) => changeBrand(event.target.value)}
          >
            <option value="">Оберіть…</option>
            {data.brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Номер партії" required>
          <Input
            value={form.batch_number}
            onChange={(event) => update({ batch_number: event.target.value })}
          />
        </Field>

        <Field label="Група скарги" required>
          <Select
            value={form.complaint_group_id}
            onChange={(event) => update({ complaint_group_id: event.target.value })}
          >
            <option value="">Оберіть…</option>
            {data.groups
              .filter(
                (group) =>
                  group.is_active || group.id === preservedValues?.groupId,
              )
              .sort(bySortOrder)
              .map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
          </Select>
        </Field>

        <Field label="Критичність" required>
          <Select
            value={form.severity_id}
            onChange={(event) => update({ severity_id: event.target.value })}
          >
            <option value="">Оберіть…</option>
            {data.severities
              .filter(
                (severity) =>
                  severity.is_active || severity.id === preservedValues?.severityId,
              )
              .sort(bySortOrder)
              .map((severity) => (
                <option key={severity.id} value={severity.id}>
                  {severity.name}
                </option>
              ))}
          </Select>
        </Field>

        <Field label="Статус" required>
          <Select
            value={form.status_id}
            onChange={(event) => update({ status_id: event.target.value })}
          >
            <option value="">Оберіть…</option>
            {data.statuses
              .filter(
                (status) =>
                  status.is_active || status.id === preservedValues?.statusId,
              )
              .sort(bySortOrder)
              .map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
          </Select>
        </Field>
      </div>

      <Field label="Суть претензії" required>
        <Textarea
          rows={showResolution ? 3 : 4}
          value={form.problem_description}
          onChange={(event) => update({ problem_description: event.target.value })}
        />
      </Field>

      {showResolution && (
        <Field label="Рішення / Відповідь">
          <Textarea
            rows={4}
            value={form.resolution_response}
            onChange={(event) => update({ resolution_response: event.target.value })}
          />
        </Field>
      )}
    </>
  )
}

function bySortOrder<T extends { sort_order: number; name: string }>(a: T, b: T) {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'uk')
}
