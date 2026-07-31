import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Power, Trash2, UserRound } from 'lucide-react'
import api from '../api/client'
import { readPageCache, writePageCache } from '../lib/pageCache'
import type { AuthUser, Phase } from '../types'

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'staff',
  is_active: true,
  phase_ids: [] as number[],
}

export default function UsersPage() {
  const cached = readPageCache<{ users: AuthUser[]; phases: Phase[] }>('users', 120_000)
  const [users, setUsers] = useState<AuthUser[]>(cached?.users ?? [])
  const [phases, setPhases] = useState<Phase[]>(cached?.phases ?? [])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AuthUser | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [usersRes, phasesRes] = await Promise.all([api.get('/users'), api.get('/phases')])
    setUsers(usersRes.data.data)
    setPhases(phasesRes.data.data)
    writePageCache('users', {
      users: usersRes.data.data,
      phases: phasesRes.data.data,
    })
  }

  useEffect(() => {
    void load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setOpen(true)
  }

  const openEdit = (user: AuthUser) => {
    setEditing(user)
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      is_active: user.is_active,
      phase_ids: user.phase_ids || user.phases.map((p) => p.id),
    })
    setError('')
    setOpen(true)
  }

  const togglePhase = (id: number) => {
    setForm((prev) => ({
      ...prev,
      phase_ids: prev.phase_ids.includes(id)
        ? prev.phase_ids.filter((x) => x !== id)
        : [...prev.phase_ids, id],
    }))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        is_active: form.is_active,
        phase_ids: form.role === 'staff' ? form.phase_ids : [],
        password: form.password || undefined,
      }
      if (editing) {
        await api.put(`/users/${editing.id}`, payload)
      } else {
        await api.post('/users', payload)
      }
      setOpen(false)
      await load()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Unable to save user.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const removeUser = async (user: AuthUser) => {
    if (!confirm(`Delete user ${user.name}?`)) return
    await api.delete(`/users/${user.id}`)
    await load()
  }

  const toggleActive = async (user: AuthUser) => {
    await api.post(`/users/${user.id}/toggle-active`)
    await load()
  }

  return (
    <div className="listing-page">
      <div className="page-header">
        <div>
          <h1>User Management</h1>
          <p>Create staff accounts and assign one or more order-processing phases</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} />
          Add User
        </button>
      </div>

      <div className="listing-card">
        <div className="table-wrap">
          <table className="data listing-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Phases</th>
                <th>Status</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar">{user.avatar_initials || 'U'}</div>
                      <div className="user-name">{user.name}</div>
                    </div>
                  </td>
                  <td className="cell-muted">{user.email}</td>
                  <td>
                    <span className={`badge ${user.is_super_admin ? 'purple' : 'blue'}`}>
                      {user.is_super_admin ? 'Super Admin' : 'Staff'}
                    </span>
                  </td>
                  <td>
                    {user.is_super_admin ? (
                      <span className="phase-chip">All phases</span>
                    ) : user.phases.length ? (
                      <div className="phase-chips">
                        {user.phases.map((p) => (
                          <span key={p.id} className="phase-chip">{p.name}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-dot ${user.is_active ? 'on' : 'off'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="col-actions">
                    {user.is_super_admin ? (
                      <span className="cell-muted">—</span>
                    ) : (
                      <div className="icon-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          title="Edit"
                          onClick={() => openEdit(user)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className={`icon-btn ${user.is_active ? 'warn' : 'ok'}`}
                          title={user.is_active ? 'Deactivate' : 'Activate'}
                          onClick={() => void toggleActive(user)}
                        >
                          <Power size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          title="Delete"
                          onClick={() => void removeUser(user)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="listing-empty">
                      <UserRound size={28} />
                      <p>No users found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="modal-backdrop">
          <form className="modal modal-user" onSubmit={(e) => void onSubmit(e)}>
            <h2>{editing ? 'Edit User' : 'Create User'}</h2>
            {error && <div className="form-error">{error}</div>}

            <div className="form-row-2">
              <div className="form-group">
                <label>Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label>Password {editing && '(leave blank to keep)'}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editing}
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="staff">Staff</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </div>

            {form.role === 'staff' && (
              <div className="form-group">
                <label>
                  Assigned Phases
                  <span className="label-hint">
                    {form.phase_ids.length} selected
                  </span>
                </label>
                <div className="phase-assign-list">
                  {phases.map((phase) => {
                    const checked = form.phase_ids.includes(phase.id)
                    return (
                      <label
                        key={phase.id}
                        className={`phase-assign-item ${checked ? 'selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePhase(phase.id)}
                        />
                        <span className="phase-num">{phase.sort_order}</span>
                        <span className="phase-label">{phase.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save User'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
