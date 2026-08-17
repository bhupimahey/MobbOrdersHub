import {
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Package,
  Scale,
  ShoppingCart,
} from 'lucide-react'
import { PHASES_META } from '../types'

const icons = [ClipboardList, ShoppingCart, Package, Scale, FileText, CheckCircle2]

/** Brand colors matching the reference workflow artwork */
const colors = ['blue', 'green', 'green', 'purple', 'orange', 'green'] as const

/**
 * Demo progress on the top track:
 * steps 1–3 completed, 4 current, 5–6 upcoming.
 */
const TRACK_STATE = ['done', 'done', 'done', 'current', 'upcoming', 'upcoming'] as const

export default function WorkflowStepper() {
  return (
    <div className="panel workflow-panel">
      <div className="panel-header">Order Process Workflow (6 Main Phases)</div>

      <div className="workflow">
        {PHASES_META.map((phase, index) => {
          const Icon = icons[index]
          const color = colors[index]
          const track = TRACK_STATE[index]
          const isLast = index === PHASES_META.length - 1
          const isCompletedIcon = phase.code === 'completed'

          return (
            <div className={`workflow-step color-${color}`} key={phase.code}>
              <div className="workflow-track">
                <span className={`workflow-node ${track} node-${color}`}>{index + 1}</span>
                {!isLast && (
                  <span
                    className={`workflow-track-line ${
                      TRACK_STATE[index] === 'done' ? 'done' : 'pending'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className="workflow-body">
                <div className={`step-badge ${color} ${isCompletedIcon ? 'solid' : ''}`}>
                  {isCompletedIcon ? <Check size={20} strokeWidth={2.75} /> : <Icon size={18} />}
                </div>

                {!isLast && (
                  <span className="workflow-arrow" aria-hidden="true">
                    <ChevronRight size={16} />
                  </span>
                )}

                <h4>{phase.name}</h4>
                <p>{phase.description}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="legend">
        <span>
          <i className="dot completed">
            <Check size={8} strokeWidth={3} />
          </i>
          Completed
        </span>
        <span>
          <i className="dot current" />
          Current Phase
        </span>
        <span>
          <i className="dot in-progress" />
          In Progress
        </span>
        <span>
          <i className="dot pending" />
          Pending
        </span>
      </div>
    </div>
  )
}
