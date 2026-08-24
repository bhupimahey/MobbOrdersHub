import type { Order } from '../types'

/** Match listing search against order #, customer, Customer PO, or Sales Order. */
export function matchesOrderSearch(order: Order, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const fields = [
    order.order_number,
    order.customer,
    order.additional?.customer_po,
    order.additional?.sales_order,
  ]

  return fields.some((value) => {
    if (value == null || value === '' || value === '—') return false
    return String(value).toLowerCase().includes(q)
  })
}
