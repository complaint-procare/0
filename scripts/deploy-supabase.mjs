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

const required = ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD']
const missing = required.filter((key) => !env[key])

if (!projectRef) missing.push('SUPABASE_PROJECT_REF or VITE_SUPABASE_URL')

if (missing.length) {
  console.error(`Missing required environment values: ${missing.join(', ')}`)
  console.error('')
  console.error('Example:')
  console.error('  export SUPABASE_ACCESS_TOKEN=...')
  console.error('  export SUPABASE_DB_PASSWORD=...')
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

const googleSecretKeys = [
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
  'GOOGLE_DRIVE_ROOT_FOLDER_ID',
]
const googleMissing = googleSecretKeys.filter((key) => !env[key])

if (googleMissing.length) {
  console.warn(`\nSkipping Google Drive secrets; missing: ${googleMissing.join(', ')}`)
} else {
  await run('Set Google Drive Edge Function secrets', [
    'secrets',
    'set',
    `GOOGLE_SERVICE_ACCOUNT_EMAIL=${env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`,
    `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=${env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY}`,
    `GOOGLE_DRIVE_ROOT_FOLDER_ID=${env.GOOGLE_DRIVE_ROOT_FOLDER_ID}`,
  ])
}

await run('Deploy upload-attachment Edge Function', [
  'functions',
  'deploy',
  'upload-attachment',
  '--no-verify-jwt',
])

console.log('\nSupabase deploy complete. Run `npm run check:supabase` to verify.')
