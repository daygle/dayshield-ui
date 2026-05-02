import { useLocation } from 'react-router-dom'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/interfaces': 'Network Interfaces',
  '/firewall': 'Firewall Rules',
  '/vpn': 'VPN',
  '/dns': 'DNS',
  '/dhcp': 'DHCP',
  '/system': 'System',
}

export default function TopBar() {
  const { pathname } = useLocation()
  const title = pageTitles[pathname] ?? 'DayShield'

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-gray-200 shrink-0">
      <h1 className="text-base font-semibold text-gray-800">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Status indicator */}
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Connected to core
        </span>

        {/* User avatar placeholder */}
        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold select-none">
          DS
        </div>
      </div>
    </header>
  )
}
