import { rangeForPeriod, type DatePeriod } from './datePresets'

/** Bumped so prior "today" defaults do not stick after YTD default change. */
const PREFIX = 'san_listing_filters_ytd:'

export type DashboardFilters = {
  search: string
  status: string
  period: DatePeriod
  dateFrom: string
  dateTo: string
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

const ORDER_PERIODS: DatePeriod[] = [
  'today',
  'this_month',
  'last_6_months',
  'this_year',
  'custom',
]

function defaultDateFilters(): Pick<OrdersFilters, 'period' | 'dateFrom' | 'dateTo'> {
  const range = rangeForPeriod('this_year')
  return {
    period: 'this_year',
    dateFrom: range.from,
    dateTo: range.to,
  }
}

export function defaultDashboardFilters(): DashboardFilters {
  return {
    search: '',
    status: 'all',
    ...defaultDateFilters(),
  }
}

export function defaultOrdersFilters(): OrdersFilters {
  return {
    search: '',
    status: 'all',
    ...defaultDateFilters(),
  }
}

function resolveDateFilters(saved: Partial<OrdersFilters> | null): Pick<OrdersFilters, 'period' | 'dateFrom' | 'dateTo'> {
  const defaults = defaultDateFilters()
  if (!saved) return defaults

  const period = (ORDER_PERIODS.includes(saved.period as DatePeriod)
    ? saved.period
    : 'this_year') as DatePeriod

  if (period === 'custom') {
    return {
      period: 'custom',
      dateFrom: typeof saved.dateFrom === 'string' ? saved.dateFrom : defaults.dateFrom,
      dateTo: typeof saved.dateTo === 'string' ? saved.dateTo : defaults.dateTo,
    }
  }

  const range = rangeForPeriod(period)
  return {
    period,
    dateFrom: range.from,
    dateTo: range.to,
  }
}

/** Shared across MOBB/HHC — company switch keeps the same filter selection. */
export function readDashboardFilters(): DashboardFilters {
  const saved = readJson<Partial<DashboardFilters>>('dashboard')
  return {
    search: typeof saved?.search === 'string' ? saved.search : '',
    status: typeof saved?.status === 'string' ? saved.status : 'all',
    ...resolveDateFilters(saved),
  }
}

export function writeDashboardFilters(filters: DashboardFilters): void {
  writeJson('dashboard', filters)
}

export function readOrdersFilters(): OrdersFilters {
  const saved = readJson<Partial<OrdersFilters>>('orders')
  return {
    search: typeof saved?.search === 'string' ? saved.search : '',
    status: typeof saved?.status === 'string' ? saved.status : 'all',
    ...resolveDateFilters(saved),
  }
}

export function writeOrdersFilters(filters: OrdersFilters): void {
  writeJson('orders', filters)
}
