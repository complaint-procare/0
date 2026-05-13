import localforage from 'localforage'
import { supabase } from './supabase'
import type { Brand, Product } from './types'

const MIGRATION_DONE_KEY = '__indexeddb_to_supabase_migrated__'

const MAIN_STORE = localforage.createInstance({
  name: 'complaint-crm',
  storeName: 'main',
})

const ATTACHMENTS_STORE = localforage.createInstance({
  name: 'complaint-crm',
  storeName: 'attachments_blob',
})

export interface LocalMigrationResult {
  skipped: boolean
  brands: number
  productsUpserted: number
  productsDeleted: number
}

export async function migrateLocalIndexedDbToSupabase(): Promise<LocalMigrationResult> {
  if (!supabase) {
    return { skipped: true, brands: 0, productsUpserted: 0, productsDeleted: 0 }
  }

  if (window.localStorage.getItem(MIGRATION_DONE_KEY)) {
    return { skipped: true, brands: 0, productsUpserted: 0, productsDeleted: 0 }
  }

  const [localBrands, localProducts] = await Promise.all([
    MAIN_STORE.getItem<Brand[]>('brands'),
    MAIN_STORE.getItem<Product[]>('products'),
  ])

  if (!localBrands?.length && !localProducts?.length) {
    window.localStorage.setItem(MIGRATION_DONE_KEY, new Date().toISOString())
    await clearLegacyIndexedDb()
    return { skipped: true, brands: 0, productsUpserted: 0, productsDeleted: 0 }
  }

  const brandIdMap = new Map<string, string>()
  for (const brand of localBrands ?? []) {
    const { data: existing, error: readError } = await supabase
      .from('brands')
      .select('*')
      .eq('name', brand.name)
      .maybeSingle()
    if (readError) throw readError

    if (existing) {
      brandIdMap.set(brand.id, existing.id as string)
      continue
    }

    const { data: inserted, error: insertError } = await supabase
      .from('brands')
      .insert(brand)
      .select('*')
      .single()
    if (insertError) throw insertError
    brandIdMap.set(brand.id, inserted.id as string)
  }

  if (localProducts?.length) {
    const products = localProducts.map((product) => ({
      ...product,
      brand_id: product.brand_id ? brandIdMap.get(product.brand_id) ?? null : null,
    }))
    const { error } = await supabase.from('products').upsert(products, { onConflict: 'id' })
    if (error) throw error

    const keepIds = new Set(products.map((product) => product.id))
    const { data: supabaseProducts, error: listError } = await supabase
      .from('products')
      .select('id')
    if (listError) throw listError

    const deleteIds = (supabaseProducts ?? [])
      .map((product) => product.id as string)
      .filter((id) => !keepIds.has(id))

    if (deleteIds.length) {
      const { error: deleteError } = await supabase.from('products').delete().in('id', deleteIds)
      if (deleteError) throw deleteError
    }

    window.localStorage.setItem(MIGRATION_DONE_KEY, new Date().toISOString())
    await clearLegacyIndexedDb()
    return {
      skipped: false,
      brands: localBrands?.length ?? 0,
      productsUpserted: products.length,
      productsDeleted: deleteIds.length,
    }
  }

  window.localStorage.setItem(MIGRATION_DONE_KEY, new Date().toISOString())
  await clearLegacyIndexedDb()
  return {
    skipped: false,
    brands: localBrands?.length ?? 0,
    productsUpserted: 0,
    productsDeleted: 0,
  }
}

async function clearLegacyIndexedDb() {
  await MAIN_STORE.clear()
  await ATTACHMENTS_STORE.clear()
}
