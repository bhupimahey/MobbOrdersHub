import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileWarning,
  Search,
} from 'lucide-react'
import api from '../api/client'
import WorkflowStepper from '../components/WorkflowStepper'
import OrdersTable from '../components/OrdersTable'
import PageLoader from '../components/PageLoader'
import RightRail from '../components/RightRail'
import { DASH_CACHE_KEY } from '../context/AuthContext'
import { readPageCache, writePageCache } from '../lib/pageCache'
import type { DashboardData, Order } from '../types'
import { PHASES_META } from '../types'

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
    // Hide fully Completed only — today's Invoiced stay visible with progress done.
    list = list.filter((o) => o.current_phase !== 'completed')
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
    return [...list].sort((a, b) =>
      (b.order_date || '').localeCompare(a.order_date || ''),
    )
  }, [data, search, status])

  const stats = data?.stats ?? {
    total_orders: 0,
    in_progress: 0,
    completed_today: 0,
    delayed_orders: 0,
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>Mobb Medical Orders Dashboard</h1>
          <p>
            Open orders + today’s Invoiced
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
            <option value="all">All Status</option>
            {PHASES_META.filter((p) => p.code !== 'completed').map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div>
            <div className="label">Total Orders</div>
            <div className="value">{stats.total_orders}</div>
            <div className="sub">All Time</div>
          </div>
          <div className="stat-icon blue"><ClipboardList size={18} /></div>
        </div>
        <div className="stat-card">
          <div>
            <div className="label">In Progress</div>
            <div className="value">{stats.in_progress}</div>
            <div className="sub">Active workflow</div>
          </div>
          <div className="stat-icon orange"><FileWarning size={18} /></div>
        </div>
        <div className="stat-card">
          <div>
            <div className="label">Completed Today</div>
            <div className="value">{stats.completed_today}</div>
            <div className="sub">Closed today</div>
          </div>
          <div className="stat-icon green"><CheckCircle2 size={18} /></div>
        </div>
        <div className="stat-card">
          <div>
            <div className="label">Delayed Orders</div>
            <div className="value">{stats.delayed_orders}</div>
            <div className="sub">Need Attention</div>
          </div>
          <div className="stat-icon red"><Clock3 size={18} /></div>
        </div>
      </div>

      <div className="dashboard-body">
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
        <RightRail
          conditions={data?.conditions}
          today={data?.today}
        />
      </div>
    </div>
  )
}
