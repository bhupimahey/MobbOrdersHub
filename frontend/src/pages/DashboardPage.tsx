import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ClipboardList,
  FileWarning,
  Package,
  PauseCircle,
  PackageX,
  Ban,
  UserRound,
  Search,
} from 'lucide-react'
import api from '../api/client'
import WorkflowStepper from '../components/WorkflowStepper'
import OrdersTable from '../components/OrdersTable'
import PageLoader from '../components/PageLoader'
import { DASH_CACHE_KEY } from '../context/AuthContext'
import { matchesStatusFilter, STATUS_FILTER_OPTIONS } from '../lib/orderStatusFilter'
import { readPageCache, writePageCache } from '../lib/pageCache'
import type { DashboardData, Order } from '../types'

function readDashboardCache(): DashboardData | null {
  const fromPage = readPageCache<DashboardData>('dashboard', 15_000)
  if (fromPage) return fromPage
  try {
    const raw = sessionStorage.getItem(DASH_CACHE_KEY)
    return raw ? (JSON.parse(raw) as DashboardData) : null
  } catch {
    return null
  }
}

function orderDay(value: string): string {
  return value.slice(0, 10)
}

function todayTorontoYmd(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

export default function DashboardPage() {
  const cached = readDashboardCache()
  const [data, setData] = useState<DashboardData | null>(cached)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!cached) setLoading(true)
      try {
        const { data: res } = await api.get<DashboardData>('/dashboard')
        if (cancelled) return
        setData(res)
        writePageCache('dashboard', res)
        sessionStorage.setItem(DASH_CACHE_KEY, JSON.stringify(res))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const orders = useMemo(() => {
    let list: Order[] = data?.orders ?? []
    // Default view hides Completed; selecting Completed in the dropdown shows them.
    if (status === 'all') {
      list = list.filter((o) => o.current_phase !== 'completed')
    } else {
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
    return [...list].sort((a, b) =>
      (b.order_date || '').localeCompare(a.order_date || ''),
    )
  }, [data, search, status])

  const stats = data?.stats ?? {
    total_orders: 0,
    in_progress: 0,
    completed_today: 0,
    delayed_orders: 0,
    today_orders: 0,
  }
  const conditions = data?.conditions ?? {
    on_hold: 0,
    backordered: 0,
    cancelled: 0,
    customer_pickup: 0,
  }

  const todayOrders =
    stats.today_orders ??
    (data?.orders ?? []).filter(
      (o) => o.current_phase !== 'completed' && orderDay(o.order_date) === todayTorontoYmd(),
    ).length

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>Mobb Medical Orders Dashboard</h1>
          <p>
            Open orders + today’s Invoiced (same list as Orders)
            {data?.using_mock ? ' · Mock data' : ''}
            {loading && data ? ' · Refreshing…' : ''}
            {!loading ? ` · ${orders.length} shown` : ''}
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
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="stats-row-compact">
        <div className="stat-card compact">
          <div>
            <div className="label">Total Orders</div>
            <div className="value">{stats.total_orders}</div>
            <div className="sub">Open + Sales History today</div>
          </div>
          <div className="stat-icon blue"><ClipboardList size={15} /></div>
        </div>
        <div className="stat-card compact">
          <div>
            <div className="label">In Progress</div>
            <div className="value">{stats.in_progress}</div>
            <div className="sub">Active workflow</div>
          </div>
          <div className="stat-icon orange"><FileWarning size={15} /></div>
        </div>
        <div className="stat-card compact">
          <div>
            <div className="label">Completed Today</div>
            <div className="value">{stats.completed_today}</div>
            <div className="sub">Closed today</div>
          </div>
          <div className="stat-icon green"><CheckCircle2 size={15} /></div>
        </div>
        <div className="stat-card compact">
          <div>
            <div className="label">Today Orders</div>
            <div className="value">{todayOrders}</div>
            <div className="sub">Ordered today</div>
          </div>
          <div className="stat-icon blue"><Package size={15} /></div>
        </div>
        <div className="stat-card compact">
          <div>
            <div className="label">Customer Pickup</div>
            <div className="value">{conditions.customer_pickup}</div>
            <div className="sub">Pickup at warehouse</div>
          </div>
          <div className="stat-icon blue"><UserRound size={15} /></div>
        </div>

        <div className="stat-card compact conditions-group">
          <div className="conditions-group-head">Order Conditions</div>
          <div className="conditions-group-items">
            <div className="condition-mini">
              <span className="stat-icon orange sm"><PauseCircle size={12} /></span>
              <div>
                <span className="label">On Hold</span>
                <strong>{conditions.on_hold}</strong>
              </div>
            </div>
            <div className="condition-mini">
              <span className="stat-icon orange sm"><PackageX size={12} /></span>
              <div>
                <span className="label">Backordered</span>
                <strong>{conditions.backordered}</strong>
              </div>
            </div>
            <div className="condition-mini">
              <span className="stat-icon red sm"><Ban size={12} /></span>
              <div>
                <span className="label">Cancelled</span>
                <strong>{conditions.cancelled}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-body dashboard-body-full">
        <div className="dashboard-center">
          <WorkflowStepper />
          <div className="orders-full">
            {loading && !data ? (
              <PageLoader label="Loading orders" />
            ) : (
              <OrdersTable orders={orders} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
