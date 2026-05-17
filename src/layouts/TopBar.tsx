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
  '/captive-portal': 'Captive Portal',
  '/system': 'System',
  '/change-password': 'Change Password',
}

interface TopBarProps {
  onOpenSidebar: () => void
}

export default function TopBar({ onOpenSidebar }: TopBarProps) {
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
    <header className="flex min-h-14 items-center justify-between gap-3 bg-white px-3 py-2 border-b border-gray-200 shrink-0 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          aria-label="Open navigation"
          className="rounded-md border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 lg:hidden"
          onClick={onOpenSidebar}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <h1 className="truncate text-sm font-semibold text-gray-800 sm:text-base">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* Status indicator */}
        <span className="hidden items-center gap-1.5 text-xs text-gray-500 sm:inline-flex">
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
