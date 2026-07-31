import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import api from '../api/client'
import PageLoader from '../components/PageLoader'
import { readPageCache, writePageCache } from '../lib/pageCache'
import type { ActivityLog } from '../types'

export default function ActivityPage() {
  const cached = readPageCache<ActivityLog[]>('activity', 60_000)
  const [logs, setLogs] = useState<ActivityLog[]>(cached ?? [])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    const load = async () => {
      if (!cached || search) setLoading(true)
      try {
        const { data } = await api.get('/activity-logs', { params: { search } })
        const list = data.data ?? []
        setLogs(list)
        if (!search) writePageCache('activity', list)
      } finally {
        setLoading(false)
      }
    }
    const timer = setTimeout(() => void load(), search ? 250 : 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  return (
    <div className="listing-page">
      <div className="page-header">
        <div>
          <h1>Activity Report</h1>
          <p>Audit trail of staff actions on orders (Super Admin only)</p>
        </div>
        <div className="search-wrap">
          <Search size={15} className="search-icon" />
          <input
            className="input"
            placeholder="Search order / action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="listing-card">
        {loading ? (
          <PageLoader label="Loading activity" />
        ) : (
          <div className="table-wrap">
            <table className="data listing-table">
              <thead>
                <tr>
                  <th>Date / Time</th>
                  <th>User</th>
                  <th>Order</th>
                  <th>Phase</th>
                  <th>Action</th>
                  <th>Previous</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="cell-muted">{new Date(log.created_at).toLocaleString()}</td>
                    <td>
                      <div className="user-name">{log.user?.name ?? '—'}</div>
                    </td>
                    <td><span className="order-link">{log.order_reference}</span></td>
                    <td>
                      {log.phase?.name || log.phase_code ? (
                        <span className="phase-chip">{log.phase?.name || log.phase_code}</span>
                      ) : (
                        <span className="cell-muted">—</span>
                      )}
                    </td>
                    <td><span className="action-chip">{log.action}</span></td>
                    <td className="cell-muted">{log.previous_status || '—'}</td>
                    <td className="cell-muted">{log.updated_status || '—'}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="listing-empty">No activity recorded yet.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
