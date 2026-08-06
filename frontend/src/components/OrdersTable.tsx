import {
  Check,
  ClipboardList,
  Copy,
  FileCode2,
  FileText,
  MoreVertical,
  Package,
  PackageX,
  Scale,
  ShoppingCart,
  Truck,
  UserRound,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import api from '../api/client'
import type { Order, OrderItem } from '../types'
import { PHASES_META, phaseColor, phaseLabel } from '../types'

function formatQty(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return String(value)
}

function ItemLineStatus({ status, boQty }: { status: string; boQty: number }) {
  const key = status.trim().toLowerCase()
  const isDone = key === 'done' || key === 'completed' || key === 'complete'
  const isBackordered = key === 'backordered' || boQty > 0

  if (isDone && !isBackordered) {
    return (
      <span className="item-line-status item-line-done" title="Fulfilled" aria-label="Fulfilled">
        <Check size={14} strokeWidth={2.5} />
      </span>
    )
  }

  return (
    <span
      className="item-line-status item-line-backorder"
      title={isBackordered ? 'Backordered' : 'In progress'}
      aria-label={isBackordered ? 'Backordered' : 'In progress'}
    >
      <PackageX size={14} strokeWidth={2.25} />
    </span>
  )
}

function OrderItemsTable({ items }: { items: OrderItem[] }) {
  return (
    <table className="order-items-table">
      <thead>
        <tr>
          <th className="col-sku">SKU</th>
          <th className="col-item">Item</th>
          <th className="col-qty">Ord.</th>
          <th className="col-qty">ShipQty</th>
          <th className="col-qty">BOQty</th>
          <th className="col-status">Status</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => (
          <tr key={`${item.sku}-${item.item}-${index}`}>
            <td className="col-sku">{item.sku}</td>
            <td className="col-item">{item.item}</td>
            <td className="col-qty">{formatQty(item.ordered)}</td>
            <td className="col-qty">{formatQty(item.ship_qty)}</td>
            <td className="col-qty">{formatQty(item.bo_qty)}</td>
            <td className="col-status">
              <ItemLineStatus status={item.status} boQty={item.bo_qty} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function isRealOrderItem(item: OrderItem): boolean {
  const sku = item.sku?.trim() ?? ''
  const name = item.item?.trim() ?? ''
  if (!sku || sku === '—') return false
  if (!name && Number(item.ordered) <= 0) return false
  return true
}

function OrderItemsPanel({
  orderNumber,
  items,
  loading,
}: {
  orderNumber: string
  items: OrderItem[]
  loading: boolean
}) {
  const [itemsModalOpen, setItemsModalOpen] = useState(false)
  const visibleItems = items.filter(isRealOrderItem)
  const canOpen = visibleItems.length > 0

  useEffect(() => {
    if (!itemsModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setItemsModalOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [itemsModalOpen])

  return (
    <>
      <div className="detail-card detail-card-items detail-card-items-cta">
        <button
          type="button"
          className="btn-order-items"
          onClick={() => setItemsModalOpen(true)}
          disabled={!canOpen || (loading && !canOpen)}
        >
          <Package size={16} strokeWidth={2.25} />
          <span>
            Order Items ({loading && !canOpen ? '…' : visibleItems.length})
          </span>
        </button>
        {!loading && !canOpen ? (
          <p className="items-empty-inline">No line items on this order yet.</p>
        ) : null}
        {loading && !canOpen ? (
          <p className="items-empty-inline text-muted">Loading line items…</p>
        ) : null}
      </div>

      {itemsModalOpen && canOpen
        ? createPortal(
            <div
              className="modal-backdrop"
              onClick={() => setItemsModalOpen(false)}
              role="presentation"
            >
              <div
                className="modal modal-items"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="order-items-modal-title"
              >
                <div className="modal-json-header">
                  <div>
                    <h2 id="order-items-modal-title">
                      Order Items ({visibleItems.length})
                    </h2>
                    <p>{orderNumber}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-icon btn-ghost"
                    onClick={() => setItemsModalOpen(false)}
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="modal-items-body">
                  <OrderItemsTable items={visibleItems} />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

const PHASE_ICONS: Record<string, typeof Check> = {
  received: ClipboardList,
  ready_to_pick: ShoppingCart,
  picked_packed: Package,
  shipping_preparation: Scale,
  invoiced: FileText,
  shipped: Truck,
  completed: Check,
}

function MiniProgress({
  states,
  currentPhase,
  skipped = [],
}: {
  states: string[]
  currentPhase: string
  skipped?: string[]
}) {
  const activeColor = phaseColor(currentPhase)
  const allDone = currentPhase === 'completed' || states.every((s) => s === 'completed')

  return (
    <div className="mini-progress" aria-label="Order progress">
      {states.map((state, index) => {
        const phaseCode = PHASES_META[index]?.code
        const isSkipped = phaseCode ? skipped.includes(phaseCode) : false
        const isDone = state === 'completed' || (allDone && !isSkipped)
        const isCurrent = state === 'current' || state === 'in_progress' || state === 'in-progress'
        const isLast = index === states.length - 1
        const showCheck = isDone && isLast && allDone

        let nodeClass = 'pending'
        if (isSkipped) nodeClass = 'skipped'
        else if (isDone) nodeClass = 'completed'
        else if (isCurrent) nodeClass = `current current-${activeColor}`

        let lineClass = ''
        if (index > 0) {
          const prev = states[index - 1]
          if (prev === 'completed' || allDone) lineClass = 'done'
          else if (prev === 'current' || prev === 'in_progress' || prev === 'in-progress') {
            lineClass = `current line-${activeColor}`
          }
        }

        return (
          <span className="mini-step" key={`${phaseCode ?? 'step'}-${index}`}>
            {index > 0 ? <span className={`mini-line ${lineClass}`} aria-hidden="true" /> : null}
            <span className={`mini-node ${nodeClass}`} title={PHASES_META[index]?.name}>
              {showCheck ? <Check size={9} strokeWidth={3} /> : index + 1}
            </span>
          </span>
        )
      })}
    </div>
  )
}

function PhaseBadge({ code }: { code: string }) {
  const color = phaseColor(code)
  const Icon = PHASE_ICONS[code] ?? ClipboardList
  return (
    <span className={`badge phase-badge ${color}`}>
      <Icon size={12} strokeWidth={2.25} />
      {phaseLabel(code)}
    </span>
  )
}

function conditionBadgeClass(condition: string) {
  if (condition === 'On Hold') return 'orange'
  if (condition === 'Backordered') return 'red'
  if (condition === 'Cancelled') return 'red'
  if (condition === 'Customer Pickup') return 'orange'
  return 'gray'
}

function ConditionBadge({ label }: { label: string }) {
  const Icon = label === 'Customer Pickup' ? UserRound : undefined
  return (
    <span className={`badge phase-badge ${conditionBadgeClass(label)}`} style={{ marginRight: 4 }}>
      {Icon ? <Icon size={12} strokeWidth={2.25} /> : null}
      {label}
    </span>
  )
}

function formatElapsed(value: string): ReactNode {
  const hot = /h|min/i.test(value) && !/^0/.test(value)
  return <span className={hot ? 'elapsed-hot' : 'text-muted'}>{value}</span>
}

function formatUpdated(value: string): ReactNode {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})/)
  if (match) {
    const d = new Date(`${match[1]}T${match[2]}:00`)
    if (!Number.isNaN(d.getTime())) {
      return (
        <div className="updated-stack">
          <strong>
            {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </strong>
          <span>
            {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>
      )
    }
  }
  return <span className="text-muted">{value}</span>
}

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export { todayISO }

export default function OrdersTable({ orders }: { orders: Order[] }) {
  const [rows, setRows] = useState<Order[]>(orders)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [jsonOrder, setJsonOrder] = useState<Order | null>(null)
  const [jsonPayload, setJsonPayload] = useState<unknown>(null)
  const [jsonLoading, setJsonLoading] = useState(false)
  const [jsonError, setJsonError] = useState('')
  const [jsonCopied, setJsonCopied] = useState(false)
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const loadedDetails = useRef<Set<string>>(new Set())

  useEffect(() => {
    setRows(orders)
    loadedDetails.current = new Set()
  }, [orders])

  useEffect(() => {
    if (!menuFor) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuFor(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuFor(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuFor])

  const loadOrderDetail = async (order: Order) => {
    if (loadedDetails.current.has(order.id)) return
    setDetailLoadingId(order.id)
    try {
      const { data } = await api.get(`/orders/${encodeURIComponent(order.id)}`)
      const full = data.data as Order | undefined
      if (full) {
        loadedDetails.current.add(order.id)
        setRows((prev) => prev.map((row) => (row.id === order.id ? { ...row, ...full } : row)))
      }
    } catch {
      // keep list row as-is
    } finally {
      setDetailLoadingId(null)
    }
  }

  const toggleExpand = (order: Order) => {
    const next = expanded === order.id ? null : order.id
    setExpanded(next)
    if (next) void loadOrderDetail(order)
  }

  const copyTracking = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // ignore
    }
  }

  const openOrderJson = async (order: Order) => {
    setMenuFor(null)
    setJsonOrder(order)
    setJsonPayload(null)
    setJsonError('')
    setJsonLoading(true)
    setJsonCopied(false)
    try {
      const { data } = await api.get(`/orders/${encodeURIComponent(order.id)}/raw`)
      setJsonPayload(data.data ?? data)
    } catch {
      try {
        const { data } = await api.get(`/orders/${encodeURIComponent(order.order_number)}/raw`)
        setJsonPayload(data.data ?? data)
      } catch {
        setJsonError('Could not load full Spire JSON for this order.')
      }
    } finally {
      setJsonLoading(false)
    }
  }

  const copyJson = async () => {
    if (!jsonPayload) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(jsonPayload, null, 2))
      setJsonCopied(true)
      setTimeout(() => setJsonCopied(false), 1500)
    } catch {
      setJsonError('Could not copy JSON.')
    }
  }

  return (
    <div className="panel">
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Order Date</th>
              <th>Order Progress</th>
              <th>Current Phase</th>
              <th>Elapsed Time</th>
              <th>Conditions</th>
              <th>Last Updated</th>
              <th style={{ width: 48 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => {
              const open = expanded === order.id
              const menuOpen = menuFor === order.id
              return (
                <Fragment key={order.id}>
                  <tr
                    className={`clickable ${open ? 'expanded' : ''}`}
                    onClick={() => toggleExpand(order)}
                  >
                    <td><span className="order-link">{order.order_number}</span></td>
                    <td className="customer-name">{order.customer}</td>
                    <td className="text-muted">{order.order_date}</td>
                    <td>
                      <MiniProgress
                        states={order.phase_states}
                        currentPhase={order.current_phase}
                        skipped={order.skipped_phases}
                      />
                    </td>
                    <td>
                      <PhaseBadge code={order.current_phase} />
                    </td>
                    <td>{formatElapsed(order.elapsed_time)}</td>
                    <td>
                      {order.conditions.length === 0 && <span className="text-muted">—</span>}
                      {order.conditions.map((c) => (
                        <ConditionBadge key={c} label={c} />
                      ))}
                    </td>
                    <td>{formatUpdated(order.last_updated)}</td>
                    <td className="actions-cell">
                      <div
                        className="row-actions"
                        ref={menuOpen ? menuRef : undefined}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="btn btn-icon btn-ghost actions-btn"
                          onClick={() => setMenuFor(menuOpen ? null : order.id)}
                          aria-label="More actions"
                          aria-expanded={menuOpen}
                        >
                          <MoreVertical size={18} />
                        </button>
                        {menuOpen && (
                          <div className="row-actions-menu">
                            <button
                              type="button"
                              onClick={() => void openOrderJson(order)}
                            >
                              <FileCode2 size={14} />
                              Order JSON
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className="expanded-row">
                      <td colSpan={9}>
                        <div className="detail-grid">
                          <OrderItemsPanel
                            orderNumber={order.order_number}
                            items={order.items}
                            loading={detailLoadingId === order.id}
                          />

                          <div className="detail-card detail-card-shipping">
                            <h5>Shipping Info</h5>
                            {order.shipping ? (
                              <div className="kv kv-stack">
                                <div><span>Carrier</span><strong>{order.shipping.carrier}</strong></div>
                                <div><span>Service</span><strong>{order.shipping.service}</strong></div>
                                <div>
                                  <span>Tracking #</span>
                                  <strong className="tracking-row">
                                    {order.shipping.tracking}
                                    <button
                                      type="button"
                                      className="btn btn-icon btn-ghost"
                                      style={{ height: 18, width: 18 }}
                                      onClick={() => void copyTracking(order.shipping!.tracking)}
                                      aria-label="Copy tracking"
                                    >
                                      {copied ? <Check size={10} /> : <Copy size={10} />}
                                    </button>
                                  </strong>
                                </div>
                                <div><span>Weight</span><strong>{order.shipping.weight}</strong></div>
                                <div><span>Est. Delivery</span><strong>{order.shipping.est_delivery}</strong></div>
                              </div>
                            ) : (
                              <div className="text-muted" style={{ fontSize: 11 }}>
                                No shipping details yet.
                              </div>
                            )}
                          </div>

                          <div className="detail-card detail-card-timeline">
                            <h5>Order Timeline</h5>
                            <div className="timeline timeline-compact">
                              {order.timeline.map((t, i) => (
                                <div
                                  className={`timeline-item ${
                                    i === order.timeline.length - 1 ? 'current' : 'done'
                                  }`}
                                  key={`${t.phase}-${t.at}`}
                                >
                                  <i />
                                  <div className="timeline-text">
                                    <strong>{t.phase}</strong>
                                    <div className="when">{t.at}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="detail-card detail-card-additional">
                            <h5>Additional Info</h5>
                            <div className="kv kv-stack">
                              <div><span>Sales Order #</span><strong>{order.additional.sales_order}</strong></div>
                              <div><span>Customer PO #</span><strong>{order.additional.customer_po}</strong></div>
                              <div><span>Created By</span><strong>{order.additional.created_by}</strong></div>
                              <div><span>Warehouse</span><strong>{order.additional.warehouse}</strong></div>
                              <div><span>Notes</span><strong>{order.additional.notes || '—'}</strong></div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <div className="empty">No orders found for your assigned phases.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {jsonOrder && (
        <div
          className="modal-backdrop"
          onClick={() => setJsonOrder(null)}
          role="presentation"
        >
          <div
            className="modal modal-json"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-json-title"
          >
            <div className="modal-json-header">
              <div>
                <h2 id="order-json-title">Order JSON</h2>
                <p>
                  {jsonOrder.order_number}
                  {jsonOrder.customer ? ` · ${jsonOrder.customer}` : ''}
                  {' · full Spire payload'}
                </p>
              </div>
              <div className="modal-json-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void copyJson()}
                  disabled={!jsonPayload || jsonLoading}
                >
                  <Copy size={14} />
                  {jsonCopied ? 'Copied' : 'Copy JSON'}
                </button>
                <button
                  type="button"
                  className="btn btn-icon btn-ghost"
                  onClick={() => setJsonOrder(null)}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            {jsonLoading && <div className="empty">Loading Spire JSON…</div>}
            {jsonError && <div className="form-error">{jsonError}</div>}
            {!jsonLoading && jsonPayload != null ? (
              <pre className="order-json-pre">{JSON.stringify(jsonPayload, null, 2)}</pre>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
