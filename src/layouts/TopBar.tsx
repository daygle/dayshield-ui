import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Button from '../components/Button'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/interfaces': 'Network Interfaces',
  '/firewall': 'Firewall Rules',
  '/vpn': 'VPN',
  '/dns': 'DNS',
  '/dhcp': 'DHCP',
  '/system': 'System',
  '/change-password': 'Change Password',
}

export default function TopBar() {
  const { pathname } = useLocation()
  const title = pageTitles[pathname] ?? 'DayShield'
  const { user, signOut } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    addToast('You have been signed out.', 'info')
    navigate('/login', { replace: true })
  }

  // Derive initials from username
  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'DS'

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-gray-200 shrink-0">
      <h1 className="text-base font-semibold text-gray-800">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Status indicator */}
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Connected
        </span>

        {/* Username + change-password link */}
        {user && (
          <Link
            to="/change-password"
            className="text-xs text-gray-500 hover:text-blue-600 hidden sm:inline"
            title="Change password"
          >
            {user.username}
          </Link>
        )}

        {/* User avatar */}
        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold select-none">
          {initials}
        </div>

        {/* Logout button */}
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Sign out
        </Button>
      </div>
    </header>
  )
}
