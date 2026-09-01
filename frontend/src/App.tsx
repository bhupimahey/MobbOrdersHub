import { Suspense, lazy, type ReactNode } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import PageLoader from './components/PageLoader'
import { useAuth } from './context/AuthContext'
import { DEFAULT_COMPANY, isCompanySlug } from './lib/companies'
import LoginPage from './pages/LoginPage'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const OrdersPage = lazy(() => import('./pages/OrdersPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const ActivityPage = lazy(() => import('./pages/ActivityPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function PageFallback() {
  return <PageLoader label="Loading page" full />
}

function Protected({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, token } = useAuth()

  if (!user && !token) {
    return <Navigate to="/login" replace />
  }

  if (!user && token) {
    return <PageLoader label="Signing you in" full />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && !user.is_super_admin) {
    return <Navigate to={`/dashboard/${DEFAULT_COMPANY}`} replace />
  }

  return children
}

function CompanyGate({ base, children }: { base: 'dashboard' | 'orders'; children: ReactNode }) {
  const { company } = useParams()
  if (!isCompanySlug(company)) {
    return <Navigate to={`/${base}/${DEFAULT_COMPANY}`} replace />
  }
  return children
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <Protected>
              <AppLayout />
            </Protected>
          }
        >
          <Route index element={<Navigate to={`/dashboard/${DEFAULT_COMPANY}`} replace />} />
          <Route path="dashboard" element={<Navigate to={`/dashboard/${DEFAULT_COMPANY}`} replace />} />
          <Route
            path="dashboard/:company"
            element={
              <CompanyGate base="dashboard">
                <DashboardPage />
              </CompanyGate>
            }
          />
          <Route path="orders" element={<Navigate to={`/orders/${DEFAULT_COMPANY}`} replace />} />
          <Route
            path="orders/:company"
            element={
              <CompanyGate base="orders">
                <OrdersPage />
              </CompanyGate>
            }
          />
          <Route path="profile" element={<ProfilePage />} />
          <Route
            path="users"
            element={
              <Protected adminOnly>
                <UsersPage />
              </Protected>
            }
          />
          <Route
            path="activity"
            element={
              <Protected adminOnly>
                <ActivityPage />
              </Protected>
            }
          />
          <Route
            path="settings"
            element={
              <Protected adminOnly>
                <SettingsPage />
              </Protected>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to={`/dashboard/${DEFAULT_COMPANY}`} replace />} />
      </Routes>
    </Suspense>
  )
}
