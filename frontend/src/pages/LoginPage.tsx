import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
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
      // Navigate immediately — dashboard paints from cache / loads in parallel
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
      <div className="login-center">
        <form className="login-card" onSubmit={(e) => void onSubmit(e)}>
          <div className="login-card-top">
            <div className="login-card-logo-wrap">
              <img src={LOGO} alt="MOBB" className="login-card-logo" />
            </div>
            <h1>Welcome back</h1>
            <p className="sub">Sign in to continue to your workspace</p>
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
            {submitting ? 'Signing in...' : 'Sign in to dashboard'}
          </button>

          <div className="login-help">
            Need access? Contact your Super Admin.
          </div>
        </form>
      </div>
    </div>
  )
}
