import { useEffect, useRef, useState } from 'react'
import { Calendar } from 'lucide-react'

function formatRangeLabel(from: string, to: string): string {
  if (!from && !to) return 'Select date range'

  const short = (value: string) => {
    const d = new Date(`${value}T00:00:00`)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  const full = (value: string) => {
    const d = new Date(`${value}T00:00:00`)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (from && to) {
    const fromYear = new Date(`${from}T00:00:00`).getFullYear()
    const toYear = new Date(`${to}T00:00:00`).getFullYear()
    if (fromYear === toYear) {
      return `${short(from)} – ${full(to)}`
    }
    return `${full(from)} – ${full(to)}`
  }

  if (from) return `From ${full(from)}`
  return `Until ${full(to)}`
}

export default function DateRangeFilter({
  dateFrom,
  dateTo,
  onChange,
}: {
  dateFrom: string
  dateTo: string
  onChange: (from: string, to: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(dateFrom)
  const [draftTo, setDraftTo] = useState(dateTo)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setDraftFrom(dateFrom)
      setDraftTo(dateTo)
    }
  }, [open, dateFrom, dateTo])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const apply = () => {
    onChange(draftFrom, draftTo)
    setOpen(false)
  }

  const clear = () => {
    setDraftFrom('')
    setDraftTo('')
    onChange('', '')
    setOpen(false)
  }

  return (
    <div className="date-range-filter" ref={rootRef}>
      <button
        type="button"
        className={`date-range-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span>{formatRangeLabel(dateFrom, dateTo)}</span>
        <Calendar size={15} className="date-range-trigger-icon" />
      </button>

      {open && (
        <div className="date-range-popover" role="dialog" aria-label="Date range">
          <div className="date-range-fields">
            <label>
              <span>From</span>
              <input
                type="date"
                className="input"
                value={draftFrom}
                max={draftTo || undefined}
                onChange={(e) => setDraftFrom(e.target.value)}
              />
            </label>
            <label>
              <span>To</span>
              <input
                type="date"
                className="input"
                value={draftTo}
                min={draftFrom || undefined}
                onChange={(e) => setDraftTo(e.target.value)}
              />
            </label>
          </div>
          <div className="date-range-popover-actions">
            <button type="button" className="btn btn-ghost" onClick={clear}>
              Clear
            </button>
            <button type="button" className="btn btn-primary" onClick={apply}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
