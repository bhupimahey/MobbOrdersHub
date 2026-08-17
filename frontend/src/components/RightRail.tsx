import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  ClipboardList,
  Clock3,
  PackageX,
  PauseCircle,
  UserRound,
} from 'lucide-react'
import type { DashboardData } from '../types'

type Conditions = DashboardData['conditions']
type Today = DashboardData['today']

const defaultConditions: Conditions = {
  on_hold: 8,
  backordered: 8,
  cancelled: 8,
  customer_pickup: 6,
}

const defaultToday: Today = {
  orders_received: 32,
  orders_in_progress: 42,
  orders_completed: 96,
  delayed_orders: 5,
}

export default function RightRail({
  conditions = defaultConditions,
  today = defaultToday,
}: {
  conditions?: Conditions
  today?: Today
}) {
  return (
    <aside className="right-rail">
      <div className="rail-panel">
        <div className="head">
          <h3>Today&apos;s Summary</h3>
        </div>
        <div className="summary-list">
          <div>
            <span className="label"><ClipboardList size={14} color="#2563eb" /> Orders Received</span>
            <strong>{today.orders_received}</strong>
          </div>
          <div>
            <span className="label"><Clock3 size={14} color="#f59e0b" /> In Progress</span>
            <strong>{today.orders_in_progress}</strong>
          </div>
          <div>
            <span className="label"><CheckCircle2 size={14} color="#16a34a" /> Completed</span>
            <strong>{today.orders_completed}</strong>
          </div>
          <div>
            <span className="label"><AlertTriangle size={14} color="#ef4444" /> Delayed</span>
            <strong style={{ color: '#dc2626' }}>{today.delayed_orders}</strong>
          </div>
        </div>
        <div className="summary-link">
          <span>View Full Reports</span>
          <ArrowRight size={14} />
        </div>
      </div>

      <div className="rail-panel">
        <div className="head">
          <h3>Order Conditions</h3>
          <span className="subtle">Any phase</span>
        </div>
        <div className="condition-list">
          <div className="condition-item">
            <span className="icon orange"><PauseCircle size={15} /></span>
            <div>
              On Hold
              <div className="desc">Temporarily paused</div>
            </div>
            <span className="count">{conditions.on_hold}</span>
          </div>
          <div className="condition-item">
            <span className="icon red"><PackageX size={15} /></span>
            <div>
              Backordered
              <div className="desc">Items unavailable</div>
            </div>
            <span className="count">{conditions.backordered}</span>
          </div>
          <div className="condition-item">
            <span className="icon red"><Ban size={15} /></span>
            <div>
              Cancelled
              <div className="desc">Order cancelled</div>
            </div>
            <span className="count">{conditions.cancelled}</span>
          </div>
          <div className="condition-item">
            <span className="icon blue"><UserRound size={15} /></span>
            <div>
              Customer Pickup
              <div className="desc">Pickup at warehouse</div>
            </div>
            <span className="count">{conditions.customer_pickup}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
