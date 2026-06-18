import type {
  Brand,
  Complaint,
  ComplaintStatus,
  Product,
  RetailNetwork,
  SeverityLevel,
  User,
} from '@/lib/types'

export type AnalyticsPeriod = 'day' | 'week' | 'month'

export interface AnalyticsFilters {
  brandIds: string[]
  productNames: string[]
  statusIds: string[]
  severityIds: string[]
  networkIds: string[]
  managerIds: string[]
}

export interface AnalyticsData {
  complaints: Complaint[]
  statuses: ComplaintStatus[]
  severities: SeverityLevel[]
  brands: Brand[]
  products: Product[]
  networks: RetailNetwork[]
  users: User[]
}

export const EMPTY_ANALYTICS_FILTERS: AnalyticsFilters = {
  brandIds: [],
  productNames: [],
  statusIds: [],
  severityIds: [],
  networkIds: [],
  managerIds: [],
}
