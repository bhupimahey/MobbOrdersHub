import {
  Check,
  ClipboardList,
  Copy,
  FileCode2,
  FileText,
  MoreVertical,
  Package,
  Scale,
  ShoppingCart,
  Truck,
  UserRound,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import api from '../api/client'
import type { Order } from '../types'
import { PHASES_META, phaseColor, phaseLabel } from '../types'

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
  const [expanded, setExpanded] = useState<string | null>(orders[0]?.id ?? null)
  const [copied, setCopied] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [jsonOrder, setJsonOrder] = useState<Order | null>(null)
  const [jsonPayload, setJsonPayload] = useState<unknown>(null)
  const [jsonLoading, setJsonLoading] = useState(false)
  const [jsonError, setJsonError] = useState('')
  const [jsonCopied, setJsonCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
            {orders.map((order) => {
              const open = expanded === order.id
              const menuOpen = menuFor === order.id
              return (
                <Fragment key={order.id}>
                  <tr
                    className={`clickable ${open ? 'expanded' : ''}`}
                    onClick={() => setExpanded(open ? null : order.id)}
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
                          <div className="detail-card detail-card-items">
                            <h5>Order Items ({order.items.length})</h5>
                            <table>
                              <thead>
                                <tr>
                                  <th>Item</th>
                                  <th>SKU</th>
                                  <th>Ord.</th>
                                  <th>Picked</th>
                                  <th>Packed</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items.map((item) => (
                                  <tr key={item.sku}>
                                    <td>{item.item}</td>
                                    <td className="text-muted">{item.sku}</td>
                                    <td>{item.ordered}</td>
                                    <td>{item.picked}</td>
                                    <td>{item.packed}</td>
                                    <td>
                                      {item.status === 'done' ? (
                                        <Check size={14} color="#16a34a" />
                                      ) : (
                                        <span className="text-muted">{item.status}</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

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
            {orders.length === 0 && (
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
            {!jsonLoading && jsonPayload && (
              <pre className="order-json-pre">{JSON.stringify(jsonPayload, null, 2)}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
