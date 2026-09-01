import { rangeForPeriod, type DatePeriod } from './datePresets'

const PREFIX = 'san_listing_filters:'

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

/** Shared across MOBB/HHC — company switch keeps the same filter selection. */
export function readDashboardFilters(): DashboardFilters {
  const saved = readJson<Partial<DashboardFilters>>('dashboard')
  return {
    ...defaultDashboardFilters(),
    search: typeof saved?.search === 'string' ? saved.search : '',
    status: typeof saved?.status === 'string' ? saved.status : 'all',
  }
}

export function writeDashboardFilters(filters: DashboardFilters): void {
  writeJson('dashboard', filters)
}

const ORDER_PERIODS: DatePeriod[] = [
  'today',
  'this_month',
  'last_6_months',
  'this_year',
  'custom',
]

export function readOrdersFilters(): OrdersFilters {
  const saved = readJson<Partial<OrdersFilters>>('orders')
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

export function writeOrdersFilters(filters: OrdersFilters): void {
  writeJson('orders', filters)
}
