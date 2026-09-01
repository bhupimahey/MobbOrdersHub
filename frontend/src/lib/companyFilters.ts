import { rangeForPeriod, type DatePeriod } from './datePresets'
import type { CompanySlug } from './companies'

const PREFIX = 'san_company_filters:'

export type DashboardFilters = {
  search: string
  status: string
}

export type OrdersFilters = {
  search: string
  status: string
  period: DatePeriod
  dateFrom: string
  dateTo: string
}

function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, data: unknown): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(data))
  } catch {
    // ignore quota
  }
}

export function defaultDashboardFilters(): DashboardFilters {
  return { search: '', status: 'all' }
}

export function defaultOrdersFilters(): OrdersFilters {
  const range = rangeForPeriod('today')
  return {
    search: '',
    status: 'all',
    period: 'today',
    dateFrom: range.from,
    dateTo: range.to,
  }
}

export function readDashboardFilters(company: CompanySlug): DashboardFilters {
  const saved = readJson<Partial<DashboardFilters>>(`dashboard:${company}`)
  return {
    ...defaultDashboardFilters(),
    ...(saved ?? {}),
    search: typeof saved?.search === 'string' ? saved.search : '',
    status: typeof saved?.status === 'string' ? saved.status : 'all',
  }
}

export function writeDashboardFilters(company: CompanySlug, filters: DashboardFilters): void {
  writeJson(`dashboard:${company}`, filters)
}

const ORDER_PERIODS: DatePeriod[] = ['today', 'yesterday', 'this_week', 'this_month', 'custom']

export function readOrdersFilters(company: CompanySlug): OrdersFilters {
  const saved = readJson<Partial<OrdersFilters>>(`orders:${company}`)
  const defaults = defaultOrdersFilters()
  if (!saved) return defaults

  const period = (ORDER_PERIODS.includes(saved.period as DatePeriod)
    ? saved.period
    : 'today') as DatePeriod

  if (period === 'custom') {
    return {
      search: typeof saved.search === 'string' ? saved.search : '',
      status: typeof saved.status === 'string' ? saved.status : 'all',
      period: 'custom',
      dateFrom: typeof saved.dateFrom === 'string' ? saved.dateFrom : defaults.dateFrom,
      dateTo: typeof saved.dateTo === 'string' ? saved.dateTo : defaults.dateTo,
    }
  }

  const range = rangeForPeriod(period)
  return {
    search: typeof saved.search === 'string' ? saved.search : '',
    status: typeof saved.status === 'string' ? saved.status : 'all',
    period,
    dateFrom: range.from,
    dateTo: range.to,
  }
}

export function writeOrdersFilters(company: CompanySlug, filters: OrdersFilters): void {
  writeJson(`orders:${company}`, filters)
}
