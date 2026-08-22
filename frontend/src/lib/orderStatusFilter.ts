import type { Order } from '../types'
import { PHASES_META } from '../types'

/** Condition labels stored on each order (any phase). */
export const CONDITION_FILTERS = [
  { value: 'cond:On Hold', label: 'On Hold' },
  { value: 'cond:Backordered', label: 'Backordered' },
  { value: 'cond:Cancelled', label: 'Cancelled' },
  { value: 'cond:Customer Pickup', label: 'Customer Pickup' },
] as const

/** Status dropdown: all workflow phases + order conditions. */
export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  ...PHASES_META.map((p) => ({
    value: p.code,
    label: p.name,
  })),
  ...CONDITION_FILTERS.map((c) => ({ value: c.value, label: c.label })),
] as const

export function matchesStatusFilter(order: Order, status: string): boolean {
  if (!status || status === 'all') return true

  if (status.startsWith('cond:')) {
    const label = status.slice(5)
    return (order.conditions ?? []).includes(label)
  }

  return order.current_phase === status
}
