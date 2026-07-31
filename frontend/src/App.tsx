import { Suspense, lazy, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import PageLoader from './components/PageLoader'
import { useAuth } from './context/AuthContext'
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
    return <Navigate to="/dashboard" replace />
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
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="orders" element={<OrdersPage />} />
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
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
