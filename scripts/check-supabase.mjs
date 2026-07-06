import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const envPath = path.join(root, '.env.local')

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return {}
  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
      .map((line) => {
        const idx = line.indexOf('=')
        const key = line.slice(0, idx)
        const value = line
          .slice(idx + 1)
          .trim()
          .replace(/^['"]|['"]$/g, '')
        return [key, value]
      }),
  )
}

const env = readEnv(envPath)
const supabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const anonKey = env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const headers = {
  apikey: anonKey,
  authorization: `Bearer ${anonKey}`,
}

async function readText(res) {
  try {
    return (await res.text()).slice(0, 240)
  } catch {
    return ''
  }
}

async function checkAuth() {
  const res = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers })
  return {
    ok: res.ok,
    status: res.status,
  }
}

async function checkTable(table) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
    headers: { ...headers, prefer: 'count=exact' },
  })
  return {
    table,
    ok: res.ok,
    status: res.status,
    visibleRows: res.headers.get('content-range')?.split('/').at(1) ?? null,
    preview: await readText(res),
  }
}

async function checkFunction(name) {
  const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'OPTIONS',
    headers,
  })
  return {
    name,
    ok: res.ok,
    status: res.status,
    preview: await readText(res),
  }
}

async function checkOauthCallback() {
  const res = await fetch(`${supabaseUrl}/functions/v1/google-oauth-callback`, {
    headers,
    redirect: 'manual',
  })
  const location = res.headers.get('location') ?? ''
  return {
    name: 'google-oauth-callback',
    ok: res.status === 302 && location.includes('drive=error'),
    status: res.status,
    preview: location || (await readText(res)),
  }
}

const tables = [
  'users',
  'brands',
  'products',
  'retail_networks',
  'clients',
  'complaint_statuses',
  'severity_levels',
  'entity_definitions',
  'field_definitions',
  'entity_records',
  'complaints',
  'complaint_attachments',
  'complaint_change_log',
  'app_settings',
  'boxes',
]

const result = {
  host: new URL(supabaseUrl).host,
  auth: await checkAuth(),
  tables: await Promise.all(tables.map(checkTable)),
  edgeFunctions: [
    await checkFunction('upload-attachment'),
    await checkOauthCallback(),
  ],
}

console.log(JSON.stringify(result, null, 2))

const failedTables = result.tables.filter((table) => !table.ok)
const failedFunctions = result.edgeFunctions.filter((fn) => !fn.ok)

if (failedTables.length || failedFunctions.length || !result.auth.ok) {
  process.exitCode = 2
}
