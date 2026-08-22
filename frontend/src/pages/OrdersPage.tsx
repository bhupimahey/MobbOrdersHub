import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import api from '../api/client'
import DateRangeFilter from '../components/DateRangeFilter'
import OrdersTable from '../components/OrdersTable'
import PageLoader from '../components/PageLoader'
import {
  DATE_PERIOD_OPTIONS,
  rangeForPeriod,
  type DatePeriod,
} from '../lib/datePresets'
import { matchesStatusFilter, STATUS_FILTER_OPTIONS } from '../lib/orderStatusFilter'
import { readPageCache, writePageCache } from '../lib/pageCache'
import type { Order } from '../types'

const CACHE_KEY = 'orders'

function orderDay(value: string): string {
  return value.slice(0, 10)
}

export default function OrdersPage() {
  const cached = readPageCache<{ orders: Order[]; usingMock: boolean }>(CACHE_KEY, 15_000)
  const [allOrders, setAllOrders] = useState<Order[]>(cached?.orders ?? [])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [period, setPeriod] = useState<DatePeriod>('today')
  const initialRange = rangeForPeriod('today')
  const [dateFrom, setDateFrom] = useState(initialRange.from)
  const [dateTo, setDateTo] = useState(initialRange.to)
  const [loading, setLoading] = useState(!cached)
  const [usingMock, setUsingMock] = useState(cached?.usingMock ?? false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!cached) setLoading(true)
      setError('')
      try {
        // fresh=1 bypasses Spire list cache so Hub matches portal quickly after invoice/save.
        const { data } = await api.get('/orders', { params: { limit: 200, page: 1, fresh: 1 } })
        if (cancelled) return
        const list = data.data ?? []
        setAllOrders(list)
        setUsingMock(Boolean(data.meta?.using_mock))
        writePageCache(CACHE_KEY, {
          orders: list,
          usingMock: Boolean(data.meta?.using_mock),
        })
        if (data.meta?.error) setError(String(data.meta.error))
      } catch {
        if (!cancelled) {
          if (!cached) setAllOrders([])
          setError('Failed to load orders from the API.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey])

  const onPeriodChange = (next: DatePeriod) => {
    setPeriod(next)
    if (next === 'custom') return
    const range = rangeForPeriod(next)
    setDateFrom(range.from)
    setDateTo(range.to)
  }

  const filtered = useMemo(() => {
    // Show all phases including Completed / Invoiced; filters apply on top.
    let list = [...allOrders]
    if (status !== 'all') {
      list = list.filter((o) => matchesStatusFilter(o, status))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q),
      )
    }
    if (dateFrom) list = list.filter((o) => orderDay(o.order_date) >= dateFrom)
    if (dateTo) list = list.filter((o) => orderDay(o.order_date) <= dateTo)
    return [...list].sort((a, b) =>
      (b.order_date || '').localeCompare(a.order_date || ''),
    )
  }, [allOrders, search, status, dateFrom, dateTo])

  const periodLabel =
    DATE_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? 'Today'

  return (
    <div className="listing-page">
      <div className="page-header listing-page-header">
        <div className="listing-page-title">
          <h1>Orders</h1>
          <p>
            All orders from the ERP API (includes Completed & Invoiced)
            {usingMock ? ' · Mock data' : ''}
            {loading && allOrders.length > 0 ? ' · Refreshing…' : ''}
            {!loading ? ` · ${filtered.length} shown` : ''}
            {` · ${periodLabel}`}
          </p>
        </div>
        <div className="toolbar orders-toolbar">
          <div className="search-wrap">
            <Search size={15} className="search-icon" />
            <input
              className="input"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
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
                }}
              />
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setReloadKey((k) => k + 1)}
            title="Refresh"
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
        {loading && ordersEmpty(allOrders) ? (
          <PageLoader label="Loading orders" />
        ) : (
          <OrdersTable
            key={`${reloadKey}-${status}-${period}-${dateFrom}-${dateTo}-${filtered[0]?.id ?? 'none'}`}
            orders={filtered}
          />
        )}
      </div>
    </div>
  )
}

function ordersEmpty(orders: Order[]) {
  return orders.length === 0
}
