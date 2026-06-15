import { Outlet, useLocation } from 'react-router-dom'

const TITLES: Record<string, { title: string; subtitle?: string }> = {
  '/settings/clients': { title: 'Клієнти', subtitle: 'Довідник клієнтів' },
  '/settings/brands': { title: 'Бренди', subtitle: 'Довідник брендів косметики' },
  '/settings/products': { title: 'Продукти', subtitle: 'Каталог продуктів' },
  '/settings/networks': { title: 'Торгові мережі', subtitle: 'Довідник мереж' },
  '/settings/users': { title: 'Користувачі', subtitle: 'Користувачі та ролі' },
  '/settings/entities': { title: 'Сутності', subtitle: 'Конструктор кастомних сутностей' },
  '/settings/fields': { title: 'Поля', subtitle: 'Конструктор полів' },
  '/settings/statuses': { title: 'Статуси', subtitle: 'Статуси, критичність і групи скарг' },
  '/settings/general': { title: 'Загальні', subtitle: 'Загальні налаштування' },
}

export function SettingsLayout() {
  const loc = useLocation()
  const t = TITLES[loc.pathname]

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Налаштування</p>
        <h1 className="text-xl font-semibold">{t?.title ?? 'Налаштування'}</h1>
        {t?.subtitle && <p className="text-sm text-muted-foreground">{t.subtitle}</p>}
      </div>
      <Outlet />
    </div>
  )
}
