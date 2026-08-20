export type Role = 'super_admin' | 'staff'

export interface Phase {
  id: number
  code: string
  name: string
  description?: string
  sort_order: number
  color?: string
  icon?: string
}

export interface AuthUser {
  id: number
  name: string
  email: string
  role: Role
  job_title?: string | null
  phone?: string | null
  avatar_initials: string
  is_active: boolean
  is_super_admin: boolean
  phases: Phase[]
  phase_ids?: number[]
}

export interface OrderItem {
  item: string
  sku: string
  ordered: number
  ship_qty: number
  bo_qty: number
  status: string
}

export interface Order {
  id: string
  order_number: string
  customer: string
  order_date: string
  current_phase: string
  current_phase_index: number
  phase_states: string[]
  skipped_phases: string[]
  elapsed_time: string
  conditions: string[]
  last_updated: string
  is_completed: boolean
  is_delayed: boolean
  completed_today: boolean
  items: OrderItem[]
  shipping: {
    carrier: string
    service: string
    tracking: string
    weight: string
    est_delivery: string
  } | null
  financial?: {
    freight: string
    discount: string
    total_discount: string
    surcharge: string
    subtotal: string
    subtotal_ordered: string
    total: string
    total_ordered: string
    gross_profit: string
    gross_profit_margin: string
    weight: string
    currency: string
    terms_code: string
    terms_text: string
    backordered: boolean
    total_backorder_qty: string
    required_date: string | null
  }
  timeline: { phase: string; at: string }[]
  additional: {
    sales_order: string
    customer_po: string
    created_by: string
    warehouse: string
    notes: string
    terms?: string
    salesperson?: string
  }
}

export interface DashboardData {
  stats: {
    total_orders: number
    in_progress: number
    completed_today: number
    delayed_orders: number
    today_orders?: number
  }
  conditions: {
    on_hold: number
    backordered: number
    cancelled: number
    customer_pickup: number
  }
  today: {
    orders_received: number
    orders_in_progress: number
    orders_completed: number
    delayed_orders: number
  }
  orders: Order[]
  using_mock: boolean
}

export interface ActivityLog {
  id: number
  user_id: number | null
  order_reference: string
  phase_code: string | null
  action: string
  previous_status: string | null
  updated_status: string | null
  created_at: string
  user?: { id: number; name: string; email: string } | null
  phase?: { id: number; code: string; name: string } | null
}

export interface AppSetting {
  id: number
  key: string
  value: string | boolean | null
  has_value: boolean
  type: string
  group: string
  label: string | null
  is_encrypted: boolean
}

export const PHASES_META = [
  { code: 'received', name: 'Received', description: 'Order received in the system', color: 'blue' },
  { code: 'ready_to_pick', name: 'Ready to Pick', description: 'Order is verified and ready for picking', color: 'orange' },
  { code: 'picked_packed', name: 'Picked & Packed', description: 'Items picked and packed', color: 'green' },
  { code: 'shipping_preparation', name: 'Shipping Preparation', description: 'Order is weighed and prepared for shipping (label & carrier)', color: 'purple' },
  { code: 'invoiced', name: 'Invoiced', description: 'Invoice has been created for the order', color: 'purple' },
  { code: 'completed', name: 'Completed', description: 'Order is successfully closed after invoicing', color: 'green' },
] as const

export function phaseLabel(code: string): string {
  return PHASES_META.find((p) => p.code === code)?.name ?? code
}

export function phaseColor(code: string): string {
  return PHASES_META.find((p) => p.code === code)?.color ?? 'gray'
}
