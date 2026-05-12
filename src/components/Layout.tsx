import { type ReactNode, useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  Database,
  LogOut,
  Menu,
  Package,
  Settings,
  Sliders,
  Store,
  Tag,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { ROLE_LABELS } from '@/lib/types'
import { cn } from '@/lib/utils'

interface NavLeaf {
  to: string
  label: string
  icon: typeof AlertCircle
  adminOnly?: boolean
}

interface NavGroup {
  label: string
  icon: typeof AlertCircle
  basePath: string
  children: NavLeaf[]
}

type NavEntry = NavLeaf | NavGroup

function isGroup(e: NavEntry): e is NavGroup {
  return 'children' in e
}

const NAV: NavEntry[] = [
  { to: '/complaints', label: 'Скарги', icon: AlertCircle },
  { to: '/analytics', label: 'Аналітика', icon: BarChart3 },
  {
    label: 'Налаштування',
    icon: Settings,
    basePath: '/settings',
    children: [
      { to: '/settings/clients', label: 'Клієнти', icon: Users },
      { to: '/settings/brands', label: 'Бренди', icon: Tag },
      { to: '/settings/products', label: 'Продукти', icon: Package },
      { to: '/settings/networks', label: 'Торгові мережі', icon: Store },
      { to: '/settings/users', label: 'Користувачі', icon: UserCog, adminOnly: true },
      { to: '/settings/entities', label: 'Сутності', icon: Database, adminOnly: true },
      { to: '/settings/fields', label: 'Поля', icon: Sliders, adminOnly: true },
      { to: '/settings/general', label: 'Загальні', icon: Settings, adminOnly: true },
    ],
  },
]

export function Layout({ children }: { children: ReactNode }) {
  const { session, signOut, isAdmin } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const nav = useNavigate()
  const loc = useLocation()

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar md:flex">
        <div className="flex h-16 items-center gap-2.5 px-6">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground">
            <AlertCircle className="h-4 w-4 text-background" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">Oops!</span>
        </div>

        <nav className="flex-1 space-y-1 px-4 pt-2">
          {NAV.map((entry) =>
            isGroup(entry) ? (
              <NavGroupItem key={entry.basePath} group={entry} isAdmin={isAdmin} />
            ) : (
              <NavLeafLink key={entry.to} item={entry} />
            ),
          )}
        </nav>

        {session && (
          <div className="mx-4 mb-4 mt-1">
            <div className="h-px bg-border mb-3" />
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                {session.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{session.full_name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{ROLE_LABELS[session.role]}</p>
              </div>
              <button
                onClick={async () => {
                  await signOut()
                  nav('/login', { replace: true })
                }}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Вийти"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside
            className="absolute left-0 top-0 flex h-full w-72 flex-col bg-sidebar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-16 items-center justify-between px-5">
              <span className="flex items-center gap-2.5 font-bold tracking-tight text-foreground">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground">
                  <AlertCircle className="h-4 w-4 text-background" />
                </div>
                Oops!
              </span>
              <button onClick={() => setMobileOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 px-4 pt-2">
              {NAV.map((entry) =>
                isGroup(entry) ? (
                  <NavGroupItem
                    key={entry.basePath}
                    group={entry}
                    isAdmin={isAdmin}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ) : (
                  <NavLeafLink
                    key={entry.to}
                    item={entry}
                    onClick={() => setMobileOpen(false)}
                  />
                ),
              )}
            </nav>
            {session && (
              <div className="mx-4 mb-4">
                <div className="h-px bg-border mb-3" />
                <div className="flex items-center gap-3 px-2 py-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                    {session.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{session.full_name}</p>
                    <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[session.role]}</p>
                  </div>
                  <button
                    onClick={async () => {
                      await signOut()
                      nav('/login', { replace: true })
                    }}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between bg-background px-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors md:hidden"
              aria-label="Меню"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/complaints" className="font-bold tracking-tight text-foreground md:hidden">
              Oops!
            </Link>
            <div className="hidden md:block">
              <p className="text-lg font-semibold text-foreground">
                {session ? `Доброго ранку, ${session.full_name.split(' ')[0]}` : pageTitle(loc.pathname)}
              </p>
            </div>
          </div>
          {session && (
            <div className="hidden items-center gap-3 md:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                {session.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="text-sm">
                <p className="font-medium text-foreground leading-tight">{session.full_name}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{ROLE_LABELS[session.role]}</p>
              </div>
            </div>
          )}
          {session && (
            <div className="text-xs text-muted-foreground md:hidden">{session.full_name}</div>
          )}
        </header>
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  )
}

function NavLeafLink({ item, onClick }: { item: NavLeaf; onClick?: () => void }) {
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      end
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150',
          isActive
            ? 'bg-foreground text-background font-semibold'
            : 'font-normal text-muted-foreground hover:bg-accent hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn(
              'h-4 w-4 shrink-0 transition-colors',
              isActive ? 'text-background' : 'text-muted-foreground group-hover:text-foreground',
            )}
          />
          {item.label}
        </>
      )}
    </NavLink>
  )
}

function NavGroupItem({
  group,
  isAdmin,
  onNavigate,
}: {
  group: NavGroup
  isAdmin: boolean
  onNavigate?: () => void
}) {
  const loc = useLocation()
  const isInside =
    loc.pathname === group.basePath || loc.pathname.startsWith(`${group.basePath}/`)
  const [open, setOpen] = useState(isInside)

  useEffect(() => {
    if (isInside) setOpen(true)
  }, [isInside])

  const children = group.children.filter((c) => !c.adminOnly || isAdmin)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150',
          isInside
            ? 'bg-foreground text-background font-semibold'
            : 'font-normal text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <group.icon
          className={cn(
            'h-4 w-4 shrink-0 transition-colors',
            isInside ? 'text-background' : 'text-muted-foreground group-hover:text-foreground',
          )}
        />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform',
            open ? 'rotate-0' : '-rotate-90',
            isInside ? 'text-background' : 'text-muted-foreground',
          )}
        />
      </button>
      {open && (
        <div className="mt-1 space-y-0.5 pl-3">
          <div className="relative pl-3">
            <div className="absolute left-0 top-1 bottom-1 w-px bg-border" />
            {children.map((c) => (
              <NavLink
                key={c.to}
                to={c.to}
                onClick={onNavigate}
                end
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors',
                    isActive
                      ? 'bg-accent text-foreground font-semibold'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <c.icon className="h-3.5 w-3.5 shrink-0" />
                {c.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function pageTitle(path: string): string {
  if (path === '/complaints') return 'Скарги'
  if (path === '/analytics') return 'Аналітика'
  if (path === '/complaints/new') return 'Нова скарга'
  if (path.startsWith('/complaints/')) return 'Скарга'
  if (path.startsWith('/settings')) return 'Налаштування'
  return ''
}
