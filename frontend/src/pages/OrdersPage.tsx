import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import api from '../api/client'
import DateRangeFilter from '../components/DateRangeFilter'
import OrdersTable from '../components/OrdersTable'
import PageLoader from '../components/PageLoader'
import { readPageCache, writePageCache } from '../lib/pageCache'
import type { Order } from '../types'
import { PHASES_META } from '../types'

const CACHE_KEY = 'orders'

function orderDay(value: string): string {
  return value.slice(0, 10)
}

export default function OrdersPage() {
  const cached = readPageCache<{ orders: Order[]; usingMock: boolean }>(CACHE_KEY, 90_000)
  const [allOrders, setAllOrders] = useState<Order[]>(cached?.orders ?? [])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
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
        const { data } = await api.get('/orders', { params: { limit: 200, page: 1 } })
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

  const filtered = useMemo(() => {
    // Open workflow only — hide invoiced/completed orders from the listing.
    let list = allOrders.filter(
      (o) =>
        o.current_phase !== 'completed' &&
        o.current_phase !== 'invoiced' &&
        !o.is_completed,
    )
    if (status !== 'all') {
      list = list.filter((o) => o.current_phase === status)
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

  return (
    <div className="listing-page">
      <div className="page-header">
        <div>
          <h1>Orders</h1>
          <p>
            All orders from the ERP API (excludes Completed / Invoiced)
            {usingMock ? ' · Mock data' : ''}
            {loading && allOrders.length > 0 ? ' · Refreshing…' : ''}
            {!loading ? ` · ${filtered.length} shown` : ''}
          </p>
        </div>
        <div className="toolbar">
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
            <option value="all">All Status</option>
            {PHASES_META.filter((p) => p.code !== 'completed' && p.code !== 'invoiced').map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
          <DateRangeFilter
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChange={(from, to) => {
              setDateFrom(from)
              setDateTo(to)
            }}
          />
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
            key={`${reloadKey}-${status}-${dateFrom}-${dateTo}-${filtered[0]?.id ?? 'none'}`}
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
