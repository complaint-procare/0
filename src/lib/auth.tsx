import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { getSession, list, setSession, update } from './db'
import { hashPin, legacyHashPin } from './utils'
import type { AuthSession, Role } from './types'
import { ensureSeed } from './seed'
import { migrateLocalIndexedDbToSupabase } from './localMigration'

interface AuthContextValue {
  session: AuthSession | null
  loading: boolean
  signIn: (pin: string) => Promise<{ ok: true } | { ok: false; error: string }>
  signOut: () => Promise<void>
  isAdmin: boolean
  hasRole: (...roles: Role[]) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        await migrateLocalIndexedDbToSupabase()
        await ensureSeed()
        const s = await getSession()
        const validSession = s ? await normalizeSession(s) : null
        if (active) setSessionState(validSession)
      } catch (error) {
        console.error(error)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(async (pin: string) => {
    if (!/^\d{4}$/.test(pin)) {
      return { ok: false as const, error: 'PIN має складатись з 4 цифр' }
    }
    const hash = await hashPin(pin)
    const legacyHash = await legacyHashPin(pin)
    const users = await list('users')
    const user = users.find((u) => u.pin_hash === hash || u.pin_hash === legacyHash)
    if (!user) return { ok: false as const, error: 'Невірний PIN' }
    if (!user.is_active) return { ok: false as const, error: 'Користувач неактивний' }
    if (user.pin_hash === legacyHash) {
      await update('users', user.id, { pin_hash: hash })
    }
    const newSession: AuthSession = {
      user_id: user.id,
      full_name: user.full_name,
      role: user.role,
      signed_in_at: new Date().toISOString(),
    }
    await setSession(newSession)
    setSessionState(newSession)
    return { ok: true as const }
  }, [])

  const signOut = useCallback(async () => {
    await setSession(null)
    setSessionState(null)
  }, [])

  const value: AuthContextValue = {
    session,
    loading,
    signIn,
    signOut,
    isAdmin: session?.role === 'admin',
    hasRole: (...roles) => (session ? roles.includes(session.role) : false),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

async function normalizeSession(session: AuthSession): Promise<AuthSession | null> {
  const users = await list('users')
  const exactUser = users.find((user) => user.id === session.user_id)
  const user =
    exactUser ??
    users.find((candidate) => candidate.full_name === session.full_name && candidate.role === session.role)

  if (!user || !user.is_active) {
    await setSession(null)
    return null
  }

  if (user.id === session.user_id) return session

  const next: AuthSession = {
    ...session,
    user_id: user.id,
    full_name: user.full_name,
    role: user.role,
  }
  await setSession(next)
  return next
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
