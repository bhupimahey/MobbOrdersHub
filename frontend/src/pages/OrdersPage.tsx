import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { RefreshCw, Search } from 'lucide-react'
import api from '../api/client'
import CompanySwitcher from '../components/CompanySwitcher'
import DateRangeFilter from '../components/DateRangeFilter'
import ListingPagination from '../components/ListingPagination'
import OrdersTable from '../components/OrdersTable'
import PageLoader from '../components/PageLoader'
import {
  DATE_PERIOD_OPTIONS,
  rangeForPeriod,
  type DatePeriod,
} from '../lib/datePresets'
import { pageCacheKey, resolveCompanySlug } from '../lib/companies'
import { matchesStatusFilter, STATUS_FILTER_OPTIONS } from '../lib/orderStatusFilter'
import { matchesOrderSearch, listingDay } from '../lib/orderSearch'
import { readPageCache, writePageCache } from '../lib/pageCache'
import { ORDERS_POLL_MS, usePollingWhenVisible } from '../lib/usePollingWhenVisible'
import type { Order } from '../types'

/** Rows per page on Orders listing (client-side over filtered results). */
const PAGE_SIZE = 200

export default function OrdersPage() {
  const { company: companyParam } = useParams()
  const company = resolveCompanySlug(companyParam)
  const cacheKey = pageCacheKey('orders', company)
  const cached = readPageCache<{ orders: Order[]; usingMock: boolean }>(cacheKey, 15_000)
  const [allOrders, setAllOrders] = useState<Order[]>(cached?.orders ?? [])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [period, setPeriod] = useState<DatePeriod>('today')
  const initialRange = rangeForPeriod('today')
  const [dateFrom, setDateFrom] = useState(initialRange.from)
  const [dateTo, setDateTo] = useState(initialRange.to)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const hasLoadedOnceRef = useRef(Boolean(cached))

  // Reset when company changes so MOBB / HHC never mix in the UI.
  useEffect(() => {
    const next = readPageCache<{ orders: Order[]; usingMock: boolean }>(cacheKey, 15_000)
    setAllOrders(next?.orders ?? [])
    setSearch('')
    setStatus('all')
    setPeriod('today')
    const range = rangeForPeriod('today')
    setDateFrom(range.from)
    setDateTo(range.to)
    setPage(1)
    setError('')
    hasLoadedOnceRef.current = Boolean(next)
    setLoading(!next)
  }, [company, cacheKey])

  const loadOrders = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent)
    setLoading(true)
    if (!silent) setError('')
    try {
      const { data } = await api.get('/orders', {
        params: { limit: 200, page: 1, fresh: 1, company },
      })
      const list = data.data ?? []
      setAllOrders(list)
      hasLoadedOnceRef.current = true
      writePageCache(cacheKey, {
        orders: list,
        usingMock: Boolean(data.meta?.using_mock),
      })
      const parts: string[] = []
      if (data.meta?.error) parts.push(String(data.meta.error))
      if (data.meta?.invoice_error) parts.push(String(data.meta.invoice_error))
      setError(parts.join(' · '))
    } catch {
      if (!silent && !hasLoadedOnceRef.current) setAllOrders([])
      if (!silent) setError('Failed to load orders from the API.')
    } finally {
      setLoading(false)
    }
  }, [company, cacheKey])

  useEffect(() => {
    void loadOrders({ silent: hasLoadedOnceRef.current })
  }, [loadOrders])

  usePollingWhenVisible(() => {
    void loadOrders({ silent: true })
  }, ORDERS_POLL_MS)

  const onPeriodChange = (next: DatePeriod) => {
    setPeriod(next)
    setPage(1)
    if (next === 'custom') return
    const range = rangeForPeriod(next)
    setDateFrom(range.from)
    setDateTo(range.to)
  }

  const onStatusChange = (next: string) => {
    setStatus(next)
    setPage(1)
  }

  const filtered = useMemo(() => {
    let list = [...allOrders]
    if (status !== 'all') {
      list = list.filter((o) => matchesStatusFilter(o, status))
    }
    if (search.trim()) {
      list = list.filter((o) => matchesOrderSearch(o, search))
    }
    if (dateFrom) list = list.filter((o) => listingDay(o) >= dateFrom)
    if (dateTo) list = list.filter((o) => listingDay(o) <= dateTo)
    return [...list].sort((a, b) =>
      (listingDay(b) + (b.order_date || '')).localeCompare(listingDay(a) + (a.order_date || '')),
    )
  }, [allOrders, search, status, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  const pageOrders = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  return (
    <div className="listing-page">
      <CompanySwitcher basePath="/orders" disabled={loading} />

      <div className="page-header listing-page-header">
        <div className="listing-page-title">
          <div className="listing-title-row">
            <h1>Orders</h1>
            <span className="listing-count-badge" title="Records matching current filters">
              <strong>{filtered.length}</strong>
              <span>records</span>
            </span>
          </div>
        </div>
        <div className="toolbar orders-toolbar">
          <div className="search-wrap">
            <Search size={15} className="search-icon" />
            <input
              className="input"
              placeholder="Search order #, customer, PO, sales order..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <select className="select" value={status} onChange={(e) => onStatusChange(e.target.value)}>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            className="select orders-period-select"
            value={period}
            onChange={(e) => onPeriodChange(e.target.value as DatePeriod)}
            aria-label="Date period"
          >
            {DATE_PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className={`orders-custom-range ${period === 'custom' ? 'is-visible' : ''}`}>
            {period === 'custom' ? (
              <DateRangeFilter
                dateFrom={dateFrom}
                dateTo={dateTo}
                onChange={(from, to) => {
                  setDateFrom(from)
                  setDateTo(to)
                  setPage(1)
                }}
              />
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void loadOrders({ silent: false })}
            title="Refresh listing"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="form-error" style={{ marginBottom: 0 }}>
          {error}
        </div>
      )}

      <div className="orders-full">
        {loading && allOrders.length === 0 ? (
          <PageLoader label="Loading orders" />
        ) : (
          <>
            <OrdersTable
              key={`${company}-${status}-${period}-${dateFrom}-${dateTo}-${safePage}`}
              orders={pageOrders}
              company={company}
            />
            <ListingPagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  )
}
