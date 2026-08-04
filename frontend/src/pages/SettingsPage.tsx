import { useEffect, useState, type FormEvent } from 'react'
import api from '../api/client'
import type { AppSetting } from '../types'

type SpireTestStep = {
  name: string
  label: string
  ok: boolean
  detail?: string
}

type SpireLogEntry = Record<string, unknown>

type SpireTestResult = {
  success?: boolean
  message?: string
  steps?: SpireTestStep[]
  log?: SpireLogEntry[]
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
  started_at?: string
  finished_at?: string
  detail?: string
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
  const [copied, setCopied] = useState(false)

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
    setCopied(false)
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

  const copyLog = async () => {
    if (!testResult) return
    const text = JSON.stringify(testResult, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy log to clipboard.')
    }
  }

  const groups = Array.from(new Set(settings.map((s) => s.group)))
  const logText = testResult ? JSON.stringify(testResult, null, 2) : ''

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

      {(testing || testResult) && (
        <div className={`spire-log-panel ${testResult?.success ? 'ok' : testResult ? 'bad' : ''}`}>
          <div className="spire-log-header">
            <div>
              <h3>Spire connection log</h3>
              <p>
                {testing
                  ? 'Calling Spire APIs…'
                  : testResult?.success
                    ? 'Test finished — share this log with Spire admin support'
                    : 'Test finished with errors — share this log with Spire admin support'}
              </p>
            </div>
            {testResult && (
              <button type="button" className="btn btn-ghost" onClick={() => void copyLog()}>
                {copied ? 'Copied' : 'Copy full log'}
              </button>
            )}
          </div>

          {testResult?.message && (
            <div className={`spire-log-summary ${testResult.success ? 'ok' : 'bad'}`}>
              {testResult.message}
            </div>
          )}

          {Array.isArray(testResult?.steps) && testResult.steps.length > 0 && (
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

          {Array.isArray(testResult?.log) &&
            testResult.log
              .filter((entry) => entry.step === 'http_request')
              .map((entry, index) => {
                const request = (entry.request ?? {}) as Record<string, unknown>
                const response = (entry.response ?? {}) as Record<string, unknown>
                return (
                  <div className="spire-http-block" key={`http-${index}`}>
                    <div className="spire-http-title">
                      API call {index + 1}: {String(request.method ?? 'GET')}{' '}
                      {String(request.url ?? '')}
                    </div>
                    <div className="spire-http-grid">
                      <div>
                        <h5>Request</h5>
                        <pre>{JSON.stringify(request, null, 2)}</pre>
                      </div>
                      <div>
                        <h5>
                          Response{' '}
                          {response.status != null ? `(HTTP ${String(response.status)})` : ''}
                          {response.duration_ms != null
                            ? ` · ${String(response.duration_ms)} ms`
                            : ''}
                        </h5>
                        <pre>{JSON.stringify(response.body ?? response, null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                )
              })}

          {testResult && (
            <details className="spire-log-raw" open>
              <summary>Full JSON log (for Spire admin)</summary>
              <pre>{logText}</pre>
            </details>
          )}
        </div>
      )}

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
