import type { Order } from '../types'
import { PHASES_META } from '../types'
import { isInvoicedOrder } from './orderSearch'

/** Condition labels stored on each order (any phase). */
export const CONDITION_FILTERS = [
  { value: 'cond:On Hold', label: 'On Hold' },
  { value: 'cond:Backordered', label: 'Backordered' },
  { value: 'cond:Cancelled', label: 'Cancelled' },
  { value: 'cond:Customer Pickup', label: 'Customer Pickup' },
] as const

/** Status dropdown: workflow phases (no Completed) + order conditions. */
export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  ...PHASES_META.filter((p) => p.code !== 'completed').map((p) => ({
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

  // Invoiced = phase Invoiced OR Sales History row (even if phase markers are incomplete).
  if (status === 'invoiced') {
    return isInvoicedOrder(order)
  }

  return order.current_phase === status
}
