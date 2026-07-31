import { useEffect, useState, type FormEvent } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [profile, setProfile] = useState({
    name: '',
    email: '',
  })
  const [passwords, setPasswords] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data } = await api.get('/profile')
      setProfile({
        name: data.data.name,
        email: data.data.email,
      })
    }
    void load()
  }, [])

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')
    try {
      await api.put('/profile', {
        name: profile.name,
      })
      await refreshUser()
      setMessage('Profile updated.')
    } catch {
      setError('Failed to update profile.')
    }
  }

  const savePassword = async (e: FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')
    try {
      await api.put('/profile/password', passwords)
      setPasswords({ current_password: '', password: '', password_confirmation: '' })
      setMessage('Password updated.')
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to update password.',
      )
    }
  }

  return (
    <div className="listing-page">
      <div className="page-header">
        <div>
          <h1>Profile</h1>
          <p>View and update your account details</p>
        </div>
      </div>

      {(message || error) && (
        <div style={{ marginBottom: 4, color: error ? '#be123c' : '#047857', fontSize: 13 }}>
          {error || message}
        </div>
      )}

      <div className="profile-grid">
        <form className="page-card" onSubmit={(e) => void saveProfile(e)}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Account Information</h3>
          <div className="form-group">
            <label>Name</label>
            <input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input value={profile.email} disabled />
          </div>
          <div className="form-group">
            <label>Role</label>
            <input value={user?.is_super_admin ? 'Super Admin' : 'Staff'} disabled />
          </div>
          <button type="submit" className="btn btn-primary">
            Save Profile
          </button>
        </form>

        <form className="page-card" onSubmit={(e) => void savePassword(e)}>
          <h3 style={{ marginTop: 0, marginBottom: 16 }}>Change Password</h3>
          <div className="form-group">
            <label>Current Password</label>
            <input
              type="password"
              value={passwords.current_password}
              onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={passwords.password}
              onChange={(e) => setPasswords({ ...passwords, password: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={passwords.password_confirmation}
              onChange={(e) =>
                setPasswords({ ...passwords, password_confirmation: e.target.value })
              }
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Update Password
          </button>
        </form>
      </div>
    </div>
  )
}
