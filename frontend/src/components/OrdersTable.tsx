import {
  Check,
  ClipboardList,
  Copy,
  FileText,
  Package,
  Scale,
  ShoppingCart,
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
        <Check size={15} strokeWidth={2.75} />
      </span>
    )
  }

  return (
    <span
      className="item-line-status item-line-backorder"
      title={isBackordered ? 'Backordered' : 'In progress'}
      aria-label={isBackordered ? 'Backordered' : 'In progress'}
    >
      <Package size={16} strokeWidth={2.25} className="item-line-backorder-box" />
      <span className="item-line-backorder-badge" aria-hidden="true">
        !
      </span>
    </span>
  )
}

const ITEMS_PREVIEW_LIMIT = 4

function OrderItemsTable({
  items,
  compact = false,
}: {
  items: OrderItem[]
  compact?: boolean
}) {
  return (
    <table className={`order-items-table${compact ? ' order-items-table-compact' : ''}`}>
      <thead>
        <tr>
          <th className="col-sku">SKU</th>
          <th className="col-item">Item</th>
          <th className="col-qty">Order Qty</th>
          <th className="col-qty">Commited Qty</th>
          <th className="col-qty">Bckorder Qty</th>
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

function OrderItemsCards({ items }: { items: OrderItem[] }) {
  return (
    <ul className="order-items-cards">
      {items.map((item, index) => (
        <li key={`${item.sku}-${item.item}-${index}`} className="order-item-card">
          <div className="order-item-card-top">
            <span className="order-item-sku">{item.sku}</span>
            <ItemLineStatus status={item.status} boQty={item.bo_qty} />
          </div>
          <div className="order-item-name">{item.item}</div>
          <div className="order-item-qtys">
            <div>
              <span>Order Qty</span>
              <strong>{formatQty(item.ordered)}</strong>
            </div>
            <div>
              <span>Commited Qty</span>
              <strong>{formatQty(item.ship_qty)}</strong>
            </div>
            <div>
              <span>Bckorder Qty</span>
              <strong>{formatQty(item.bo_qty)}</strong>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function OrderItemsViews({
  items,
  compact = false,
}: {
  items: OrderItem[]
  compact?: boolean
}) {
  return (
    <>
      <div className="items-view-table">
        <OrderItemsTable items={items} compact={compact} />
      </div>
      <div className="items-view-cards">
        <OrderItemsCards items={items} />
      </div>
    </>
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
  const preview = visibleItems.slice(0, ITEMS_PREVIEW_LIMIT)
  const hasMore = visibleItems.length > ITEMS_PREVIEW_LIMIT

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
      <div className="detail-card detail-card-items">
        <div className="items-panel-head">
          <h5>Order Items ({loading && visibleItems.length === 0 ? '…' : visibleItems.length})</h5>
        </div>
        {loading && visibleItems.length === 0 ? (
          <div className="items-empty text-muted">Loading line items…</div>
        ) : visibleItems.length === 0 ? (
          <div className="items-empty">
            <Package size={18} strokeWidth={1.75} />
            <p>No line items on this order yet.</p>
          </div>
        ) : (
          <>
            <OrderItemsViews items={preview} compact />
            {hasMore ? (
              <button
                type="button"
                className="btn-view-all-items"
                onClick={() => setItemsModalOpen(true)}
              >
                View all {visibleItems.length} items
              </button>
            ) : null}
          </>
        )}
      </div>

      {itemsModalOpen && visibleItems.length > 0
        ? createPortal(
            <div
              className="modal-backdrop modal-backdrop-items"
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
                  <OrderItemsViews items={visibleItems} />
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
  const allDone =
    currentPhase === 'completed' ||
    currentPhase === 'invoiced' ||
    states.every((s) => s === 'completed')

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
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const loadedDetails = useRef<Set<string>>(new Set())

  useEffect(() => {
    setRows(orders)
    loadedDetails.current = new Set()
  }, [orders])


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


  const renderDetails = (order: Order) => (
    <div className="detail-grid">
      <OrderItemsPanel
        orderNumber={order.order_number}
        items={order.items}
        loading={detailLoadingId === order.id}
      />

      <div className="detail-card detail-card-shipping">
        <h5>Shipping Info</h5>
        <div className="kv kv-stack">
          <div><span>Sales Order #</span><strong>{order.additional.sales_order || '—'}</strong></div>
          <div><span>Customer PO #</span><strong>{order.additional.customer_po || '—'}</strong></div>
          <div><span>Created By</span><strong>{order.additional.created_by || '—'}</strong></div>
          <div><span>Warehouse</span><strong>{order.additional.warehouse || '—'}</strong></div>
          <div><span>Carrier</span><strong>{order.shipping?.carrier || '—'}</strong></div>
          <div><span>Service</span><strong>{order.shipping?.service || '—'}</strong></div>
          <div>
            <span>Tracking #</span>
            <strong className="tracking-row">
              {order.shipping?.tracking || '—'}
              {order.shipping?.tracking && order.shipping.tracking !== '—' ? (
                <button
                  type="button"
                  className="btn btn-icon btn-ghost"
                  style={{ height: 18, width: 18 }}
                  onClick={() => void copyTracking(order.shipping!.tracking)}
                  aria-label="Copy tracking"
                >
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                </button>
              ) : null}
            </strong>
          </div>
          <div><span>Weight</span><strong>{order.shipping?.weight || '—'}</strong></div>
          <div><span>Est. Delivery</span><strong>{order.shipping?.est_delivery || '—'}</strong></div>
        </div>
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
    </div>
  )

  return (
    <div className="panel">
      <div className="table-wrap orders-desktop">
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
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => {
              const open = expanded === order.id
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
                  </tr>
                  {open && (
                    <tr className="expanded-row">
                      <td colSpan={8}>{renderDetails(order)}</td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="empty">No orders found for your assigned phases.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="orders-mobile">
        {rows.length === 0 ? (
          <div className="empty">No orders found for your assigned phases.</div>
        ) : (
          rows.map((order) => {
            const open = expanded === order.id
            return (
              <article
                key={`m-${order.id}`}
                className={`order-card ${open ? 'is-open' : ''}`}
              >
                <button
                  type="button"
                  className="order-card-main"
                  onClick={() => toggleExpand(order)}
                >
                  <div className="order-card-top">
                    <span className="order-link">{order.order_number}</span>
                    <PhaseBadge code={order.current_phase} />
                  </div>
                  <div className="order-card-customer">{order.customer}</div>
                  <div className="order-card-meta">
                    <span className="order-card-date">{order.order_date}</span>
                    {formatElapsed(order.elapsed_time)}
                  </div>
                  {order.conditions.length > 0 ? (
                    <div className="order-card-conditions">
                      {order.conditions.map((c) => (
                        <ConditionBadge key={c} label={c} />
                      ))}
                    </div>
                  ) : null}
                </button>
                {open ? <div className="order-card-details">{renderDetails(order)}</div> : null}
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}
