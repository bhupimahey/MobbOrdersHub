import type { Order } from '../types'

/** True when order is Invoiced or comes from Spire Sales History. */
export function isInvoicedOrder(order: Order): boolean {
  if (order.current_phase === 'invoiced' || order.current_phase === 'completed') return true
  if (order.spire?.source === 'invoice') return true
  if ((order.invoice_date || '').trim()) return true
  if ((order.spire?.invoice_no || '').trim()) return true
  return false
}

/** Calendar day used for period filters — Invoice Date for Sales History rows. */
export function listingDay(order: Order): string {
  const invoice = (order.invoice_date || '').slice(0, 10)
  if (invoice) return invoice
  if (isInvoicedOrder(order)) {
    return (order.order_date || '').slice(0, 10)
  }
  return (order.order_date || '').slice(0, 10)
}

/** Match listing search against order #, customer, Customer PO, or Sales Order. */
export function matchesOrderSearch(order: Order, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const fields = [
    order.order_number,
    order.customer,
    order.additional?.customer_po,
    order.additional?.sales_order,
    order.spire?.invoice_no,
  ]

  return fields.some((value) => {
    if (value == null || value === '' || value === '—') return false
    return String(value).toLowerCase().includes(q)
  })
}
