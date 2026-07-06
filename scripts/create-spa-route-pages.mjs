import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const distDir = path.resolve('dist')
const indexPath = path.join(distDir, 'index.html')

// GitHub Pages serves static files only. These routes get real entry pages so
// direct navigation returns 200; dynamic routes still fall back to 404.html.
const routes = [
  'login',
  'complaints',
  'complaints/new',
  'analytics',
  'boxes',
  'settings',
  'settings/clients',
  'settings/brands',
  'settings/products',
  'settings/networks',
  'settings/users',
  'settings/entities',
  'settings/fields',
  'settings/statuses',
  'settings/general',
  'clients',
  'brands',
  'products',
  'retail-networks',
  'admin/users',
  'admin/entities',
  'admin/fields',
  'admin/statuses',
  'admin/settings',
]

const indexHtml = await readFile(indexPath, 'utf8')

await writeFile(path.join(distDir, '404.html'), indexHtml)

for (const route of routes) {
  const routeDir = path.join(distDir, route)
  await mkdir(routeDir, { recursive: true })
  await writeFile(path.join(routeDir, 'index.html'), htmlForRoute(indexHtml, route))
}

console.log(`Created ${routes.length} SPA route entry pages and 404 fallback.`)

function htmlForRoute(html, route) {
  const depth = route.split('/').length
  const prefix = '../'.repeat(depth)

  return html.replace(/(src|href)="\.\/(assets\/[^"]+)"/g, `$1="${prefix}$2"`)
}
