import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, ShieldCheck, Package, Truck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const LOGO = '/mobb-logo.png'

export default function LoginPage() {
  const { login, user, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string; errors?: { email?: string[] } } } })
          ?.response?.data?.message ||
        (err as { response?: { data?: { errors?: { email?: string[] } } } })?.response?.data?.errors
          ?.email?.[0] ||
        'Login failed. Please check your credentials.'
      setError(message)
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-atmosphere" aria-hidden="true" />

      <aside className="login-brand">
        <div className="login-brand-inner">
          <img src={LOGO} alt="MOBB" className="login-brand-logo" />
          <p className="login-brand-kicker">Proudly Canadian · Serving Canadians</p>
          <h1 className="login-brand-title">MOBB</h1>
          <p className="login-brand-tagline">
            Orders Hub — the command center for fulfillment, shipping, and team workflow.
          </p>

          <ul className="login-brand-points">
            <li>
              <Package size={16} aria-hidden="true" />
              <span>Track every order phase in real time</span>
            </li>
            <li>
              <Truck size={16} aria-hidden="true" />
              <span>Ship with confidence across Canada</span>
            </li>
            <li>
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Secure access for your operations team</span>
            </li>
          </ul>
        </div>
      </aside>

      <main className="login-panel">
        <form className="login-form" onSubmit={(e) => void onSubmit(e)}>
          <div className="login-form-top">
            <p className="login-form-eyebrow">Team access</p>
            <h2>Sign in</h2>
            <p className="login-form-sub">Enter your work credentials to continue.</p>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="you@company.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="pass-field">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="pass-toggle"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={submitting}
          >
            <span>{submitting ? 'Signing in…' : 'Sign in to Orders Hub'}</span>
            {!submitting && <ArrowRight size={16} aria-hidden="true" />}
          </button>

          <p className="login-help">Need access? Contact your Super Admin.</p>
        </form>
      </main>
    </div>
  )
}
