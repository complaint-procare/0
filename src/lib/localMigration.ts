import localforage from 'localforage'
import { supabase } from './supabase'
import type { AuthSession, Brand, Product } from './types'

const SESSION_KEY = '__auth_session__'
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

  const [localBrands, localProducts, localSession] = await Promise.all([
    MAIN_STORE.getItem<Brand[]>('brands'),
    MAIN_STORE.getItem<Product[]>('products'),
    MAIN_STORE.getItem<AuthSession>(SESSION_KEY),
  ])

  if (localSession) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(localSession))
  }

  if (!localBrands?.length && !localProducts?.length) {
    window.localStorage.setItem(MIGRATION_DONE_KEY, new Date().toISOString())
    await clearLegacyIndexedDb()
    return { skipped: true, brands: 0, productsUpserted: 0, productsDeleted: 0 }
  }

  if (localBrands?.length) {
    const { error } = await supabase.from('brands').upsert(localBrands, { onConflict: 'id' })
    if (error) throw error
  }

  if (localProducts?.length) {
    const { error } = await supabase.from('products').upsert(localProducts, { onConflict: 'id' })
    if (error) throw error

    const keepIds = new Set(localProducts.map((product) => product.id))
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
      productsUpserted: localProducts.length,
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
