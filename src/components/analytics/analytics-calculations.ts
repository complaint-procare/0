import type { Brand, Complaint, ComplaintStatus, Product } from '@/lib/types'
import type { AnalyticsFilters, AnalyticsPeriod } from './analytics-types'

export function filterComplaints(complaints: Complaint[], filters: AnalyticsFilters) {
  return complaints.filter((complaint) => {
    if (filters.brandIds.length && !filters.brandIds.includes(complaint.brand_id ?? '')) return false
    if (filters.productNames.length && !filters.productNames.includes(complaint.product_name)) return false
    if (filters.statusIds.length && !filters.statusIds.includes(complaint.status_id ?? '')) return false
    if (filters.severityIds.length && !filters.severityIds.includes(complaint.severity_id ?? '')) return false
    if (filters.networkIds.length && !filters.networkIds.includes(complaint.retail_network_id ?? '')) {
      return false
    }
    if (filters.managerIds.length && !filters.managerIds.includes(complaint.manager_id)) return false
    return true
  })
}

export function uniqueProductNames(complaints: Complaint[], products: Product[]) {
  const names = new Set<string>()
  for (const complaint of complaints) {
    if (complaint.product_name) names.add(complaint.product_name)
  }
  for (const product of products) {
    if (product.name) names.add(product.name)
  }
  return Array.from(names)
    .sort((a, b) => a.localeCompare(b, 'uk'))
    .map((name) => ({ value: name, label: name }))
}

export function computeAnalyticsStats(complaints: Complaint[], statuses: ComplaintStatus[]) {
  const closedIds = new Set(statuses.filter((status) => status.is_closed).map((status) => status.id))
  const openId = findStatusId(statuses, ['Новий', 'Нова'])
  const inProgressId = findStatusId(statuses, ['В роботі'])
  const now = Date.now()
  const week = 7 * 24 * 60 * 60 * 1000
  const last7 = complaints.filter((complaint) => now - new Date(complaint.created_at).getTime() < week)
  const prev7 = complaints.filter((complaint) => {
    const age = now - new Date(complaint.created_at).getTime()
    return age >= week && age < 2 * week
  })
  const delta = (current: number, previous: number) =>
    previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100

  return {
    total: complaints.length,
    open: complaints.filter((complaint) => complaint.status_id === openId).length,
    inProgress: complaints.filter((complaint) => complaint.status_id === inProgressId).length,
    closed: complaints.filter((complaint) => closedIds.has(complaint.status_id ?? '')).length,
    deltaTotal: delta(last7.length, prev7.length),
    deltaOpen: delta(
      last7.filter((complaint) => complaint.status_id === openId).length,
      prev7.filter((complaint) => complaint.status_id === openId).length,
    ),
    deltaInProgress: delta(
      last7.filter((complaint) => complaint.status_id === inProgressId).length,
      prev7.filter((complaint) => complaint.status_id === inProgressId).length,
    ),
    deltaClosed: delta(
      last7.filter((complaint) => closedIds.has(complaint.status_id ?? '')).length,
      prev7.filter((complaint) => closedIds.has(complaint.status_id ?? '')).length,
    ),
  }
}

export function computeAnalyticsBuckets(complaints: Complaint[], period: AnalyticsPeriod) {
  const now = new Date()
  const buckets: { label: string; value: number; isPeak?: boolean; key: string }[] = []

  if (period === 'day') {
    for (let offset = 13; offset >= 0; offset--) {
      const date = new Date(now)
      date.setDate(date.getDate() - offset)
      buckets.push({
        label: `${date.getDate()}.${date.getMonth() + 1}`,
        value: 0,
        key: date.toISOString().slice(0, 10),
      })
    }
    for (const complaint of complaints) {
      const bucket = buckets.find((item) => item.key === complaint.created_at.slice(0, 10))
      if (bucket) bucket.value++
    }
  } else if (period === 'week') {
    for (let offset = 7; offset >= 0; offset--) {
      const date = new Date(now)
      date.setDate(date.getDate() - offset * 7)
      const key = isoWeekKey(date)
      buckets.push({ label: `W${key.slice(-2)}`, value: 0, key })
    }
    for (const complaint of complaints) {
      const bucket = buckets.find((item) => item.key === isoWeekKey(new Date(complaint.created_at)))
      if (bucket) bucket.value++
    }
  } else {
    for (let offset = 11; offset >= 0; offset--) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1)
      buckets.push({
        label: monthShort(date.getMonth()),
        value: 0,
        key: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`,
      })
    }
    for (const complaint of complaints) {
      const date = new Date(complaint.created_at)
      const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
      const bucket = buckets.find((item) => item.key === key)
      if (bucket) bucket.value++
    }
  }

  const max = Math.max(...buckets.map((bucket) => bucket.value))
  for (const bucket of buckets) bucket.isPeak = bucket.value === max && max > 0
  return buckets
}

export function analyticsPeriodLabel(period: AnalyticsPeriod) {
  return period === 'day' ? 'За 14 днів' : period === 'week' ? 'За 8 тижнів' : 'За 12 місяців'
}

export function breakdownByStatus(complaints: Complaint[], statuses: ComplaintStatus[]) {
  const tones: Record<string, string> = {
    'Новий': 'bg-emerald-400',
    'Нова': 'bg-emerald-400',
    'В роботі': 'bg-amber-400',
    'В роботі виробництво': 'bg-amber-400',
    'В роботі ВКЯ': 'bg-amber-400',
    'В роботі продакт-менеджер': 'bg-amber-400',
    'Очікує відповідь клієнта': 'bg-violet-400',
    'Очікує ВКЯ': 'bg-violet-500',
    'Закрито': 'bg-slate-400',
    'Закрита': 'bg-slate-400',
    'Відхилено': 'bg-rose-400',
    'Відхилена': 'bg-rose-400',
  }
  return statuses
    .map((status) => ({
      label: status.name,
      value: complaints.filter((complaint) => complaint.status_id === status.id).length,
      color: normalizeHexColor(status.color) ?? undefined,
      tone: tones[status.name] ?? 'bg-foreground',
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
}

export function breakdownByBrand(complaints: Complaint[], brands: Brand[]) {
  return brands
    .map((brand) => ({
      label: brand.name,
      value: complaints.filter((complaint) => complaint.brand_id === brand.id).length,
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}

function findStatusId(statuses: ComplaintStatus[], names: string[]) {
  return statuses.find((status) => names.includes(status.name))?.id
}

function isoWeekKey(value: Date) {
  const date = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-${week.toString().padStart(2, '0')}`
}

function monthShort(month: number) {
  return ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'][month]
}

function normalizeHexColor(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const match = /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.exec(trimmed)
  if (!match) return null
  const raw = match[1].toUpperCase()
  return raw.length === 3
    ? `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`
    : `#${raw}`
}
