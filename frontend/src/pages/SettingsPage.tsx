import { useEffect, useState, type FormEvent } from 'react'
import api from '../api/client'
import type { AppSetting } from '../types'

type SpireTestStep = {
  name: string
  label: string
  ok: boolean
  detail?: string
}

type SpireTestResult = {
  success?: boolean
  message?: string
  steps?: SpireTestStep[]
  sample_order?: {
    id?: string | number | null
    order_no?: string | null
    customer?: string | null
    customer_po?: string | null
    order_date?: string | null
    status?: string | number | null
  } | null
  resolved_ip?: string | null
  office_lan_only?: boolean
  order_count?: number | null
  company?: string
  base_url?: string
}

const SETTING_ORDER = [
  'spire_base_url',
  'spire_company',
  'spire_username',
  'spire_password',
  'spire_verify_ssl',
  'use_mock_orders',
  'app_name',
]

function sortSettings(list: AppSetting[]): AppSetting[] {
  return [...list].sort((a, b) => {
    const ai = SETTING_ORDER.indexOf(a.key)
    const bi = SETTING_ORDER.indexOf(b.key)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSetting[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<SpireTestResult | null>(null)

  const applySettings = (list: AppSetting[]) => {
    const ordered = sortSettings(list)
    setSettings(ordered)
    const map: Record<string, string> = {}
    ordered.forEach((s) => {
      if (typeof s.value === 'boolean') {
        map[s.key] = s.value ? '1' : '0'
      } else {
        map[s.key] = s.value ?? ''
      }
    })
    setValues(map)
  }

  useEffect(() => {
    const load = async () => {
      const { data } = await api.get('/settings')
      applySettings(data.data)
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
      applySettings(data.data)
      setMessage('Settings saved successfully.')
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
    setTestResult(null)
    try {
      const { data: saved } = await api.put('/settings', {
        settings: settings.map((s) => ({
          key: s.key,
          value: values[s.key] ?? '',
        })),
      })
      applySettings(saved.data)
      const { data } = await api.post<SpireTestResult>('/settings/test-spire')
      setTestResult(data)
      setMessage(data.message || 'Spire connection OK.')
    } catch (err: unknown) {
      const data = (err as { response?: { data?: SpireTestResult } })?.response?.data
      if (data) {
        setTestResult(data)
      }
      const msg = data?.message || 'Spire connection test failed.'
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
                      type="text"
                      value={values[setting.key] ?? ''}
                      autoComplete="off"
                      onChange={(e) => setValues({ ...values, [setting.key]: e.target.value })}
                    />
                  )}
                </div>
              ))}
          </div>
        ))}

        {testResult && (
          <div className={`spire-test-result ${testResult.success ? 'ok' : 'bad'}`}>
            <h4>{testResult.success ? 'Spire test passed' : 'Spire test failed'}</h4>
            {(testResult.base_url || testResult.resolved_ip) && (
              <p className="spire-test-meta">
                {testResult.base_url}
                {testResult.resolved_ip ? ` → ${testResult.resolved_ip}` : ''}
                {testResult.company ? ` · ${testResult.company}` : ''}
              </p>
            )}
            {Array.isArray(testResult.steps) && testResult.steps.length > 0 && (
              <ul className="spire-test-steps">
                {testResult.steps.map((step) => (
                  <li key={step.name} className={step.ok ? 'ok' : 'bad'}>
                    <span className="spire-step-mark">{step.ok ? '✓' : '✗'}</span>
                    <div>
                      <strong>{step.label}</strong>
                      {step.detail && <div className="spire-step-detail">{step.detail}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {testResult.sample_order && (
              <div className="spire-sample-order">
                <strong>Sample order synced</strong>
                <div>
                  #{String(testResult.sample_order.order_no ?? testResult.sample_order.id ?? '—')}
                  {testResult.sample_order.customer
                    ? ` · ${testResult.sample_order.customer}`
                    : ''}
                  {testResult.sample_order.customer_po
                    ? ` · PO ${testResult.sample_order.customer_po}`
                    : ''}
                </div>
              </div>
            )}
          </div>
        )}

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
            {testing ? 'Testing Spire…' : 'Test Spire Connection'}
          </button>
        </div>
      </form>
    </div>
  )
}
