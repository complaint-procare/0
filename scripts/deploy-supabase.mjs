import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

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

const localEnv = readEnvFile(path.join(root, '.env.local'))
const env = { ...localEnv, ...process.env }

const supabaseUrl = env.SUPABASE_URL || localEnv.VITE_SUPABASE_URL
const projectRef =
  env.SUPABASE_PROJECT_REF ||
  (supabaseUrl ? new URL(supabaseUrl).host.replace(/\.supabase\.co$/, '') : '')

const required = [
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
]
const missing = required.filter((key) => !env[key])

if (!projectRef) missing.push('SUPABASE_PROJECT_REF or VITE_SUPABASE_URL')

if (missing.length) {
  console.error(`Missing required environment values: ${missing.join(', ')}`)
  console.error('')
  console.error('Example:')
  console.error('  export SUPABASE_ACCESS_TOKEN=...')
  console.error('  export SUPABASE_DB_PASSWORD=...')
  console.error('  export GOOGLE_OAUTH_CLIENT_ID=...')
  console.error('  export GOOGLE_OAUTH_CLIENT_SECRET=...')
  console.error('  npm run deploy:supabase')
  process.exit(1)
}

function run(label, args, options = {}) {
  console.log(`\n> ${label}`)
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['supabase', ...args], {
      cwd: root,
      env,
      stdio: 'inherit',
      ...options,
    })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${label} failed with exit code ${code}`))
    })
  })
}

await run('Link Supabase project', ['link', '--project-ref', projectRef])
await run('Push database migrations', ['db', 'push'])
await run('Seed linked database', ['db', 'query', '--linked', '--file', 'supabase/seed.sql'])

await run('Set Google OAuth Edge Function secrets', [
  'secrets',
  'set',
  `GOOGLE_OAUTH_CLIENT_ID=${env.GOOGLE_OAUTH_CLIENT_ID}`,
  `GOOGLE_OAUTH_CLIENT_SECRET=${env.GOOGLE_OAUTH_CLIENT_SECRET}`,
])

await run('Deploy upload-attachment Edge Function', [
  'functions',
  'deploy',
  'upload-attachment',
  '--no-verify-jwt',
])

await run('Deploy google-oauth-callback Edge Function', [
  'functions',
  'deploy',
  'google-oauth-callback',
  '--no-verify-jwt',
])

console.log('\nSupabase deploy complete. Run `npm run check:supabase` to verify.')
