import { useEffect, useState, type FormEvent } from 'react'
import api from '../api/client'
import type { AppSetting } from '../types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSetting[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await api.get('/settings')
      const list: AppSetting[] = data.data
      setSettings(list)
      const map: Record<string, string> = {}
      list.forEach((s) => {
        if (s.is_encrypted) {
          map[s.key] = ''
        } else if (typeof s.value === 'boolean') {
          map[s.key] = s.value ? '1' : '0'
        } else {
          map[s.key] = s.value ?? ''
        }
      })
      setValues(map)
    }
    void load()
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const payload = {
        settings: settings.map((s) => ({
          key: s.key,
          value: values[s.key] ?? '',
        })),
      }
      const { data } = await api.put('/settings', payload)
      setSettings(data.data)
      setMessage('Settings saved successfully.')
      // Clear password fields after save (keep placeholders)
      setValues((prev) => ({
        ...prev,
        spire_username: '',
        spire_password: '',
      }))
    } catch {
      setError('Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  const testSpire = async () => {
    setTesting(true)
    setMessage('')
    setError('')
    try {
      // Save first so test uses latest values (except blank secrets)
      await api.put('/settings', {
        settings: settings.map((s) => ({
          key: s.key,
          value: values[s.key] ?? '',
        })),
      })
      const { data } = await api.post('/settings/test-spire')
      setMessage(data.message || 'Spire connection OK.')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Spire connection test failed.'
      setError(msg)
    } finally {
      setTesting(false)
    }
  }

  const groups = Array.from(new Set(settings.map((s) => s.group)))

  return (
    <div className="listing-page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Configure Spire ERP connection and application options</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void testSpire()}
          disabled={testing}
        >
          {testing ? 'Testing...' : 'Test Spire Connection'}
        </button>
      </div>

      <form className="page-card" onSubmit={(e) => void onSubmit(e)}>
        {message && (
          <div style={{ marginBottom: 12, color: '#047857', fontSize: 13 }}>{message}</div>
        )}
        {error && (
          <div style={{ marginBottom: 12, color: '#be123c', fontSize: 13 }}>{error}</div>
        )}

        {groups.map((group) => (
          <div key={group} style={{ marginBottom: 24 }}>
            <h3
              style={{
                textTransform: 'uppercase',
                fontSize: 12,
                color: '#6b7280',
                letterSpacing: '0.05em',
              }}
            >
              {group === 'spire' ? 'Spire ERP API' : group}
            </h3>
            {group === 'spire' && (
              <p style={{ marginTop: 0, marginBottom: 14, color: '#6b7280', fontSize: 12.5 }}>
                Base: https://square-sales-8907.spirelan.com:10880 · Company: MOB_MED2 · Auth: Basic
                (username/password). Keep mock enabled until the firewall and credentials are
                verified.
              </p>
            )}
            {settings
              .filter((s) => s.group === group)
              .map((setting) => (
                <div className="form-group" key={setting.key}>
                  <label>{setting.label || setting.key}</label>
                  {setting.type === 'boolean' ? (
                    <select
                      value={values[setting.key] ?? '0'}
                      onChange={(e) => setValues({ ...values, [setting.key]: e.target.value })}
                    >
                      <option value="1">Enabled</option>
                      <option value="0">Disabled</option>
                    </select>
                  ) : (
                    <input
                      type={setting.is_encrypted ? 'password' : 'text'}
                      value={values[setting.key] ?? ''}
                      autoComplete={setting.is_encrypted ? 'new-password' : 'off'}
                      placeholder={
                        setting.is_encrypted && setting.has_value
                          ? '•••••••• (leave blank to keep)'
                          : ''
                      }
                      onChange={(e) => setValues({ ...values, [setting.key]: e.target.value })}
                    />
                  )}
                </div>
              ))}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void testSpire()}
            disabled={testing}
          >
            {testing ? 'Testing...' : 'Test Spire Connection'}
          </button>
        </div>
      </form>
    </div>
  )
}
