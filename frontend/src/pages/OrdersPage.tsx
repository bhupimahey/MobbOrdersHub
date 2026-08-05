import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react'
import api from '../api/client'
import DateRangeFilter from '../components/DateRangeFilter'
import OrdersTable from '../components/OrdersTable'
import PageLoader from '../components/PageLoader'
import { readPageCache, writePageCache } from '../lib/pageCache'
import type { Order } from '../types'
import { PHASES_META } from '../types'

const CACHE_KEY = 'orders'
const PAGE_SIZE = 50

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
  const [page, setPage] = useState(1)
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
        // Pull a larger pool; UI paginates at 50 after local filters.
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
    let list = allOrders
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    setPage(1)
  }, [search, status, dateFrom, dateTo])

  const pageOrders = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  const fromIdx = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const toIdx = Math.min(safePage * PAGE_SIZE, filtered.length)

  return (
    <div className="listing-page">
      <div className="page-header">
        <div>
          <h1>Orders</h1>
          <p>
            All orders from the ERP API
            {usingMock ? ' · Mock data' : ''}
            {loading && allOrders.length > 0 ? ' · Refreshing…' : ''}
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
            {PHASES_META.map((p) => (
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
          <>
            <OrdersTable
              key={`${reloadKey}-${status}-${dateFrom}-${dateTo}-${safePage}-${pageOrders[0]?.id ?? 'none'}`}
              orders={pageOrders}
            />
            <div className="pagination-bar">
              <div className="pagination-info">
                Showing {fromIdx}–{toIdx} of {filtered.length}
                {' · '}
                {PAGE_SIZE} per page
              </div>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <span className="pagination-page">
                  Page {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ordersEmpty(orders: Order[]) {
  return orders.length === 0
}
