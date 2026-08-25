import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { matchesOrderSearch } from '../lib/orderSearch'
import { readPageCache, writePageCache } from '../lib/pageCache'
import { ORDERS_POLL_MS, usePollingWhenVisible } from '../lib/usePollingWhenVisible'
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

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const { data: res } = await api.get<DashboardData>('/dashboard')
      setData(res)
      writePageCache('dashboard', res)
      sessionStorage.setItem(DASH_CACHE_KEY, JSON.stringify(res))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  usePollingWhenVisible(() => {
    void loadDashboard()
  }, ORDERS_POLL_MS)

  const orders = useMemo(() => {
    let list: Order[] = data?.orders ?? []
    // Include Invoiced (sales history / phaseId). Completed is not a filter — treat as Invoiced.
    if (status !== 'all') {
      list = list.filter((o) => matchesStatusFilter(o, status))
    }
    if (search.trim()) {
      list = list.filter((o) => matchesOrderSearch(o, search))
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

  // Prefer live listing length so Total Orders always matches the table when unfiltered.
  const listingTotal = data?.orders?.length ?? stats.total_orders
  const openWorkflow = stats.open_workflow
  const salesHistoryTotal = stats.sales_history_total

  const todayOrders =
    stats.today_orders ??
    (data?.orders ?? []).filter(
      (o) =>
        o.current_phase !== 'completed' &&
        o.current_phase !== 'invoiced' &&
        orderDay(o.order_date) === todayTorontoYmd(),
    ).length

  const totalSub =
    openWorkflow != null && salesHistoryTotal != null
      ? `${openWorkflow} open + ${salesHistoryTotal} Sales History`
      : 'Open + Sales History in list'

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <div className="listing-title-row">
            <h1>Mobb Medical Orders Dashboard</h1>
            <span className="listing-count-badge" title="Records matching current filters">
              <strong>{orders.length}</strong>
              <span>records</span>
            </span>
          </div>
        </div>
        <div className="toolbar">
          <div className="search-wrap">
            <Search size={15} className="search-icon" />
            <input
              className="input"
              placeholder="Search order #, customer, PO, sales order..."
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
            <div className="value">{listingTotal}</div>
            <div className="sub">{totalSub}</div>
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
            <div className="sub">Invoiced / closed today</div>
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
