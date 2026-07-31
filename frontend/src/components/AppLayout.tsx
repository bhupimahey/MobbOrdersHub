import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  UserCircle,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { prefetchRoute } from '../lib/pageCache'

const LOGO = '/mobb-logo.png'

function warm(path: string) {
  if (path === '/dashboard') prefetchRoute(() => import('../pages/DashboardPage'))
  if (path === '/orders') prefetchRoute(() => import('../pages/OrdersPage'))
  if (path === '/users') prefetchRoute(() => import('../pages/UsersPage'))
  if (path === '/activity') prefetchRoute(() => import('../pages/ActivityPage'))
  if (path === '/settings') prefetchRoute(() => import('../pages/SettingsPage'))
  if (path === '/profile') prefetchRoute(() => import('../pages/ProfilePage'))
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.is_super_admin

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo-wrap">
            <img src={LOGO} alt="MOBB" className="brand-logo" />
          </div>
        </div>

        <nav className="nav-list">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title="Dashboard"
            data-tip="Dashboard"
            onMouseEnter={() => warm('/dashboard')}
          >
            <LayoutDashboard size={20} strokeWidth={1.75} />
          </NavLink>

          <NavLink
            to="/orders"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title="Orders"
            data-tip="Orders"
            onMouseEnter={() => warm('/orders')}
          >
            <ClipboardList size={20} strokeWidth={1.75} />
          </NavLink>

          {isAdmin && (
            <>
              <NavLink
                to="/activity"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title="Activity Report"
                data-tip="Activity"
                onMouseEnter={() => warm('/activity')}
              >
                <Activity size={20} strokeWidth={1.75} />
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title="Settings"
                data-tip="Settings"
                onMouseEnter={() => warm('/settings')}
              >
                <Settings size={20} strokeWidth={1.75} />
              </NavLink>
              <NavLink
                to="/users"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title="Users"
                data-tip="Users"
                onMouseEnter={() => warm('/users')}
              >
                <Users size={20} strokeWidth={1.75} />
              </NavLink>
            </>
          )}

          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title="Profile"
            data-tip="Profile"
            onMouseEnter={() => warm('/profile')}
          >
            <UserCircle size={20} strokeWidth={1.75} />
          </NavLink>

          <button
            type="button"
            className="nav-item"
            onClick={handleLogout}
            title="Logout"
            data-tip="Logout"
          >
            <LogOut size={20} strokeWidth={1.75} />
          </button>
        </nav>

        <div className="sidebar-user" title={user?.name} data-tip={user?.name ?? 'User'}>
          <div className="avatar">{user?.avatar_initials ?? 'U'}</div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
