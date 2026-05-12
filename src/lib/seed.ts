import { v4 as uuid } from 'uuid'
import { hashPin } from './utils'
import { getSetting, insert, list, remove, update, upsertSetting } from './db'
import type {
  Brand,
  Client,
  ComplaintStatus,
  EntityDefinition,
  FieldDefinition,
  Product,
  RetailNetwork,
  SeverityLevel,
  User,
} from './types'

const SEED_FLAG_KEY = '__seeded__v1'
const MIGRATION_FLAG_KEY = '__migration__product_text__'
const MIGRATION_SOURCE_KEY = '__migration__source_type__'
const MIGRATION_SEVERITY_COLORS_KEY = '__migration__severity_colors_dark__'

export async function ensureSeed() {
  const flag = await getSetting(SEED_FLAG_KEY)
  if (flag) {
    await migrateProductToText()
    await migrateSourceType()
    await migrateSeverityColors()
    return
  }

  const now = () => new Date().toISOString()

  // --- Users (with PINs) ---
  const adminId = uuid()
  const managerId = uuid()
  const supervisorId = uuid()
  const pmId = uuid()
  const qaId = uuid()

  const users: User[] = [
    {
      id: adminId,
      full_name: 'Адмін Адмінович',
      role: 'admin',
      pin_hash: await hashPin('1234'),
      is_active: true,
      created_at: now(),
      updated_at: now(),
    },
    {
      id: managerId,
      full_name: 'Ірина Менеджер',
      role: 'manager',
      pin_hash: await hashPin('1111'),
      is_active: true,
      created_at: now(),
      updated_at: now(),
    },
    {
      id: supervisorId,
      full_name: 'Олег Керівник',
      role: 'supervisor',
      pin_hash: await hashPin('2222'),
      is_active: true,
      created_at: now(),
      updated_at: now(),
    },
    {
      id: pmId,
      full_name: 'Марія Продакт',
      role: 'product_manager',
      pin_hash: await hashPin('3333'),
      is_active: true,
      created_at: now(),
      updated_at: now(),
    },
    {
      id: qaId,
      full_name: 'Тарас ВКЯ',
      role: 'qa',
      pin_hash: await hashPin('4444'),
      is_active: true,
      created_at: now(),
      updated_at: now(),
    },
  ]
  for (const u of users) await insert('users', u)

  // --- Statuses ---
  const statuses: ComplaintStatus[] = [
    { id: uuid(), name: 'Нова', sort_order: 10, is_closed: false, is_active: true },
    { id: uuid(), name: 'В роботі', sort_order: 20, is_closed: false, is_active: true },
    {
      id: uuid(),
      name: 'Очікує відповідь клієнта',
      sort_order: 30,
      is_closed: false,
      is_active: true,
    },
    { id: uuid(), name: 'Очікує ВКЯ', sort_order: 40, is_closed: false, is_active: true },
    { id: uuid(), name: 'Закрита', sort_order: 50, is_closed: true, is_active: true },
    { id: uuid(), name: 'Відхилена', sort_order: 60, is_closed: true, is_active: true },
  ]
  for (const s of statuses) await insert('complaint_statuses', s)

  // --- Severity ---
  const severities: SeverityLevel[] = [
    {
      id: uuid(),
      name: 'Інформаційна',
      sort_order: 10,
      color: 'bg-slate-700/40 text-slate-300',
      is_active: true,
    },
    {
      id: uuid(),
      name: 'Низька',
      sort_order: 20,
      color: 'bg-emerald-900/40 text-emerald-400',
      is_active: true,
    },
    {
      id: uuid(),
      name: 'Середня',
      sort_order: 30,
      color: 'bg-amber-900/40 text-amber-400',
      is_active: true,
    },
    {
      id: uuid(),
      name: 'Висока',
      sort_order: 40,
      color: 'bg-orange-900/40 text-orange-400 ring-1 ring-orange-700/50',
      is_active: true,
    },
    {
      id: uuid(),
      name: 'Критична',
      sort_order: 50,
      color: 'bg-red-900/40 text-red-400 ring-1 ring-red-700/50',
      is_active: true,
    },
  ]
  for (const s of severities) await insert('severity_levels', s)

  // --- Brands ---
  const brands: Brand[] = [
    { id: uuid(), name: 'Joko Blend', is_active: true, created_at: now() },
    { id: uuid(), name: 'Skin Lab', is_active: true, created_at: now() },
    { id: uuid(), name: 'Daily Care', is_active: true, created_at: now() },
  ]
  for (const b of brands) await insert('brands', b)

  // --- Products ---
  const products: Product[] = [
    {
      id: uuid(),
      brand_id: brands[0].id,
      name: 'Кавовий скраб',
      sku: 'JB-CSCR-200',
      is_active: true,
      created_at: now(),
    },
    {
      id: uuid(),
      brand_id: brands[0].id,
      name: 'Молочко для тіла',
      sku: 'JB-BMLK-250',
      is_active: true,
      created_at: now(),
    },
    {
      id: uuid(),
      brand_id: brands[1].id,
      name: 'Сироватка з вітаміном C',
      sku: 'SL-SERC-30',
      is_active: true,
      created_at: now(),
    },
    {
      id: uuid(),
      brand_id: brands[2].id,
      name: 'Крем для рук',
      sku: 'DC-HCR-75',
      is_active: true,
      created_at: now(),
    },
  ]
  for (const p of products) await insert('products', p)

  // --- Retail networks ---
  const networks: RetailNetwork[] = [
    { id: uuid(), name: 'EVA', is_active: true, created_at: now() },
    { id: uuid(), name: 'Watsons', is_active: true, created_at: now() },
    { id: uuid(), name: 'Prostor', is_active: true, created_at: now() },
    { id: uuid(), name: 'Rozetka', is_active: true, created_at: now() },
  ]
  for (const n of networks) await insert('retail_networks', n)

  // --- Clients ---
  const clients: Client[] = [
    {
      id: uuid(),
      name: 'Тестовий клієнт',
      contact_person: 'Іван Іванович',
      phone: '+380501112233',
      is_active: true,
      created_at: now(),
    },
  ]
  for (const c of clients) await insert('clients', c)

  // --- Entity definitions (system) ---
  const complaintEntityId = uuid()
  const entities: EntityDefinition[] = [
    {
      id: complaintEntityId,
      entity_key: 'complaints',
      singular_label: 'Скарга',
      plural_label: 'Скарги',
      icon: 'AlertCircle',
      sort_order: 10,
      show_in_navigation: true,
      is_system: true,
      is_active: true,
      is_visible: true,
      deleted_at: null,
      created_at: now(),
      updated_at: now(),
      updated_by: null,
    },
    {
      id: uuid(),
      entity_key: 'clients',
      singular_label: 'Клієнт',
      plural_label: 'Клієнти',
      icon: 'Users',
      sort_order: 20,
      show_in_navigation: true,
      is_system: true,
      is_active: true,
      is_visible: true,
      deleted_at: null,
      created_at: now(),
      updated_at: now(),
      updated_by: null,
    },
    {
      id: uuid(),
      entity_key: 'brands',
      singular_label: 'Бренд',
      plural_label: 'Бренди',
      icon: 'Tag',
      sort_order: 30,
      show_in_navigation: true,
      is_system: true,
      is_active: true,
      is_visible: true,
      deleted_at: null,
      created_at: now(),
      updated_at: now(),
      updated_by: null,
    },
    {
      id: uuid(),
      entity_key: 'products',
      singular_label: 'Продукт',
      plural_label: 'Продукти',
      icon: 'Package',
      sort_order: 40,
      show_in_navigation: true,
      is_system: true,
      is_active: true,
      is_visible: true,
      deleted_at: null,
      created_at: now(),
      updated_at: now(),
      updated_by: null,
    },
    {
      id: uuid(),
      entity_key: 'retail_networks',
      singular_label: 'Торгова мережа',
      plural_label: 'Торгові мережі',
      icon: 'Store',
      sort_order: 50,
      show_in_navigation: true,
      is_system: true,
      is_active: true,
      is_visible: true,
      deleted_at: null,
      created_at: now(),
      updated_at: now(),
      updated_by: null,
    },
    {
      id: uuid(),
      entity_key: 'users',
      singular_label: 'Користувач',
      plural_label: 'Користувачі',
      icon: 'UserCog',
      sort_order: 60,
      show_in_navigation: false,
      is_system: true,
      is_active: true,
      is_visible: true,
      deleted_at: null,
      created_at: now(),
      updated_at: now(),
      updated_by: null,
    },
  ]
  for (const e of entities) await insert('entity_definitions', e)

  // --- Field definitions for complaint ---
  const fields: FieldDefinition[] = [
    sysField(complaintEntityId, 'number', 'Номер', 'text', 10, { details: false }),
    sysField(complaintEntityId, 'created_at', 'Дата створення', 'date', 20, { create: false }),
    sysField(complaintEntityId, 'created_by', 'Створив', 'reference', 30, { create: false }),
    sysField(complaintEntityId, 'manager_id', 'Менеджер', 'reference', 40, { create: false }),
    sysField(complaintEntityId, 'source_type', 'Тип джерела', 'select', 45),
    sysField(complaintEntityId, 'retail_network_id', 'Торгова мережа', 'reference', 50, {
      required: false,
    }),
    sysField(complaintEntityId, 'client_phone', 'Телефон клієнта', 'text', 55, { required: false }),
    sysField(complaintEntityId, 'brand_id', 'Бренд', 'reference', 60),
    sysField(complaintEntityId, 'product_name', 'Назва продукту', 'text', 70),
    sysField(complaintEntityId, 'product_barcode', 'Штрихкод', 'text', 75, { required: false }),
    sysField(complaintEntityId, 'batch_number', 'Номер партії', 'text', 80),
    sysField(complaintEntityId, 'problem_description', 'Суть претензії', 'textarea', 90),
    sysField(complaintEntityId, 'severity_id', 'Критичність', 'reference', 110),
    sysField(complaintEntityId, 'status_id', 'Статус', 'reference', 120),
  ]
  for (const f of fields) await insert('field_definitions', f)

  await upsertSetting('drive.base_folder', { name: 'Complaints', enabled: false }, null)
  await upsertSetting(SEED_FLAG_KEY, true, null)
}

function sysField(
  entityId: string,
  key: string,
  label: string,
  type: FieldDefinition['field_type'],
  order: number,
  visibility: { create?: boolean; details?: boolean; registry?: boolean; required?: boolean } = {},
): FieldDefinition {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    entity_id: entityId,
    field_key: key,
    label,
    field_type: type,
    reference_entity_id: null,
    is_system: true,
    is_required:
      visibility.required ??
      (key !== 'closed_at' &&
        key !== 'drive_folder_id' &&
        key !== 'drive_folder_url' &&
        key !== 'created_at' &&
        key !== 'updated_at' &&
        key !== 'created_by'),
    is_active: true,
    is_visible: true,
    show_in_create: visibility.create ?? true,
    show_in_details: visibility.details ?? true,
    show_in_registry: visibility.registry ?? true,
    sort_order: order,
    options: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  }
}

export async function listUsersForLogin(): Promise<{ pin: string; name: string; role: string }[]> {
  const users = await list('users')
  return users.map((u) => ({ pin: '****', name: u.full_name, role: u.role }))
}

async function migrateProductToText() {
  const done = await getSetting(MIGRATION_FLAG_KEY)
  if (done) return

  // Existing complaints: backfill product_name/product_barcode from product_id lookup
  const products = await list('products')
  const complaints = await list('complaints')
  for (const c of complaints) {
    const old = c as unknown as { product_id?: string | null; product_name?: string; product_barcode?: string }
    if (old.product_name !== undefined) continue
    const prod = old.product_id ? products.find((p) => p.id === old.product_id) : undefined
    await update('complaints', c.id, {
      product_name: prod?.name ?? '',
      product_barcode: prod?.sku ?? '',
    } as unknown as Partial<typeof c>)
  }

  // Field definitions: replace product_id reference with product_name/product_barcode text fields
  const fields = await list('field_definitions')
  const complaintEntity = (await list('entity_definitions')).find((e) => e.entity_key === 'complaints')
  const oldProductField = fields.find((f) => f.field_key === 'product_id' && f.is_system)
  const hasName = fields.some((f) => f.field_key === 'product_name')
  const hasBarcode = fields.some((f) => f.field_key === 'product_barcode')
  if (complaintEntity) {
    if (oldProductField) await remove('field_definitions', oldProductField.id)
    if (!hasName) await insert('field_definitions', sysField(complaintEntity.id, 'product_name', 'Назва продукту', 'text', 70))
    if (!hasBarcode)
      await insert(
        'field_definitions',
        sysField(complaintEntity.id, 'product_barcode', 'Штрихкод', 'text', 75, { required: false }),
      )
  }

  await upsertSetting(MIGRATION_FLAG_KEY, true, null)
}

async function migrateSourceType() {
  const done = await getSetting(MIGRATION_SOURCE_KEY)
  if (done) return

  const complaints = await list('complaints')
  for (const c of complaints) {
    const old = c as unknown as { source_type?: string; client_phone?: string }
    if (old.source_type) continue
    await update('complaints', c.id, {
      source_type: 'network',
      client_phone: old.client_phone ?? '',
    } as unknown as Partial<typeof c>)
  }

  const fields = await list('field_definitions')
  const complaintEntity = (await list('entity_definitions')).find((e) => e.entity_key === 'complaints')
  if (complaintEntity) {
    const hasSource = fields.some((f) => f.field_key === 'source_type')
    const hasPhone = fields.some((f) => f.field_key === 'client_phone')
    if (!hasSource)
      await insert(
        'field_definitions',
        sysField(complaintEntity.id, 'source_type', 'Тип джерела', 'select', 45),
      )
    if (!hasPhone)
      await insert(
        'field_definitions',
        sysField(complaintEntity.id, 'client_phone', 'Телефон клієнта', 'text', 55, {
          required: false,
        }),
      )
    // Update existing retail_network_id field to be non-required
    const networkField = fields.find((f) => f.field_key === 'retail_network_id')
    if (networkField && networkField.is_required) {
      await update('field_definitions', networkField.id, {
        is_required: false,
        updated_at: new Date().toISOString(),
      })
    }
    // Remove obsolete customer_response system field
    const responseField = fields.find((f) => f.field_key === 'customer_response')
    if (responseField) await remove('field_definitions', responseField.id)
  }

  await upsertSetting(MIGRATION_SOURCE_KEY, true, null)
}

const DARK_SEVERITY_COLORS: Record<string, string> = {
  'bg-slate-100 text-slate-700': 'bg-slate-700/40 text-slate-300',
  'bg-emerald-100 text-emerald-700': 'bg-emerald-900/40 text-emerald-400',
  'bg-amber-100 text-amber-700': 'bg-amber-900/40 text-amber-400',
  'bg-orange-100 text-orange-800 ring-1 ring-orange-300': 'bg-orange-900/40 text-orange-400 ring-1 ring-orange-700/50',
  'bg-red-100 text-red-800 ring-1 ring-red-300': 'bg-red-900/40 text-red-400 ring-1 ring-red-700/50',
}

async function migrateSeverityColors() {
  const done = await getSetting(MIGRATION_SEVERITY_COLORS_KEY)
  if (done) return
  const levels = await list('severity_levels')
  for (const s of levels) {
    const next = DARK_SEVERITY_COLORS[s.color]
    if (next) await update('severity_levels', s.id, { color: next })
  }
  await upsertSetting(MIGRATION_SEVERITY_COLORS_KEY, true, null)
}
