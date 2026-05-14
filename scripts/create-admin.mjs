import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const roles = new Set(['manager', 'supervisor', 'admin', 'product_manager', 'qa'])
const [fullName, pin, role = 'admin'] = process.argv.slice(2)

if (!fullName || !pin) {
  console.error('Usage: npm run create:admin -- "Full Name" 1234 [role]')
  process.exit(1)
}

if (!/^\d{4}$/.test(pin)) {
  console.error('PIN must be exactly 4 digits.')
  process.exit(1)
}

if (!roles.has(role)) {
  console.error(`Role must be one of: ${Array.from(roles).join(', ')}`)
  process.exit(1)
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const raw = fs.readFileSync(filePath, 'utf8')
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .map((line) => line.replace(/^export\s+/, ''))
      .filter((line) => line && !line.startsWith('#') && /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
      .map((line) => {
        const idx = line.indexOf('=')
        const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
        return value ? [line.slice(0, idx), value] : null
      })
      .filter(Boolean),
  )
}

function hashPin(value) {
  return createHash('sha256').update(`complaint-crm:${value}`).digest('hex')
}

async function request(url, options = {}) {
  const res = await fetch(url, options)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res
}

const env = { ...readEnvFile(path.join(root, '.env.local')), ...process.env }
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
const pinHash = hashPin(pin)

const existing = await request(
  `${supabaseUrl}/rest/v1/users?select=id&pin_hash=eq.${pinHash}&limit=1`,
  { headers },
).then((res) => res.json())

if (existing.length) {
  console.error('A user with this PIN already exists.')
  process.exit(1)
}

const now = new Date().toISOString()
const user = {
  id: randomUUID(),
  full_name: fullName.trim(),
  role,
  pin_hash: pinHash,
  is_active: true,
  created_at: now,
  updated_at: now,
}

const created = await request(`${supabaseUrl}/rest/v1/users`, {
  method: 'POST',
  headers: {
    ...headers,
    'content-type': 'application/json',
    prefer: 'return=representation',
  },
  body: JSON.stringify(user),
}).then((res) => res.json())

console.log(`Created ${created[0].role} user "${created[0].full_name}" (${created[0].id}).`)
