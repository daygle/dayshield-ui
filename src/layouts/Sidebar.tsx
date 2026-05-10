import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

interface NavItem {
  type?: 'item'
  to: string
  label: string
  icon: React.ReactNode
  level?: 0 | 1 | 2
}

interface NavSection {
  type: 'section'
  label: string
}

type NavEntry = NavItem | NavSection

function QueryNavLink({
  to,
  label,
  icon,
  level = 1,
}: {
  to: string
  label: string
  icon?: React.ReactNode
  level?: 1 | 2
}) {
  const location = useLocation()
  const [pathname, search = ''] = to.split('?')
  const targetParams = new URLSearchParams(search)
  const currentParams = new URLSearchParams(location.search)

  const active = location.pathname === pathname && Array.from(targetParams.entries()).every(
    ([key, value]) => currentParams.get(key) === value,
  )

  const className = [
    level === 2 ? 'sidebar-sub-link-nested' : 'sidebar-sub-link',
    active ? 'active' : '',
  ].join(' ')

  return (
    <Link to={to} className={className}>
      {icon}
      {label}
    </Link>
  )
}

const navEntries: NavEntry[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" />
      </svg>
    ),
  },
  {
    to: '/metrics',
    label: 'Metrics',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16l4-4 4 4 4-8" />
      </svg>
    ),
  },
  {
    to: '/interfaces',
    label: 'Interfaces',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
      </svg>
    ),
  },
  {
    to: '/gateways',
    label: 'Gateways',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    to: '/firewall',
    label: 'Firewall',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5h-3m3 3h-3m3-6h-3M8.25 4.5h7.5a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0115.75 19.5h-7.5A2.25 2.25 0 016 17.25V6.75A2.25 2.25 0 018.25 4.5z" />
      </svg>
    ),
  },
  {
    to: '/vpn',
    label: 'VPN',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    to: '/dns',
    label: 'DNS',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
      </svg>
    ),
  },
  {
    to: '/dhcp',
    label: 'DHCP',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    ),
  },
  {
    to: '/ntp',
    label: 'NTP',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
    ),
  },
  {
    to: '/cloudflared',
    label: 'Cloudflared',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18h11.5a3.5 3.5 0 000-7 5 5 0 00-9.7-1.5A4 4 0 006 18z" />
      </svg>
    ),
  },
  {
    to: '/suricata',
    label: 'Suricata',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    to: '/crowdsec',
    label: 'CrowdSec',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
  {
    to: '/acme',
    label: 'ACME / TLS',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    to: '/live-logs',
    label: 'Live Logs',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5M3.75 6.75h16.5M3.75 17.25h10.5" />
      </svg>
    ),
  },
  {
    to: '/backup',
    label: 'Backup / Restore',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  {
    to: '/notifications',
    label: 'Notifications',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    to: '/system',
    label: 'System',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const location = useLocation()
  const [isFirewallMenuOpen, setIsFirewallMenuOpen] = useState(false)
  const [isDnsMenuOpen, setIsDnsMenuOpen] = useState(false)
  const [isSystemMenuOpen, setIsSystemMenuOpen] = useState(false)

  return (
    <aside className="flex flex-col h-full w-60 bg-[#0f172a] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <img src="/shield.svg" alt="DayShield" className="h-8 w-8" />
        <div>
          <span className="text-white font-bold text-base leading-none">DayShield</span>
          <span className="block text-[10px] text-blue-400 mt-0.5 tracking-widest uppercase">Firewall</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navEntries.map((entry, idx) => {
          if (entry.type === 'section') {
            return (
              <p
                key={`section-${idx}`}
                className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500"
              >
                {entry.label}
              </p>
            )
          }
          const item = entry as NavItem
          const level = item.level ?? 0
          const itemClassName = level === 0 ? 'sidebar-link' : level === 2 ? 'sidebar-sub-link-nested' : 'sidebar-sub-link'
          return (
            <div key={item.to}>
              {item.to.includes('?') ? (
                <QueryNavLink
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  level={level === 2 ? 2 : 1}
                />
              ) : (
                <NavLink
                  to={item.to}
                  onClick={
                    item.to === '/firewall' || item.to === '/dns' || item.to === '/system'
                      ? (event) => {
                          if (location.pathname === item.to) {
                            event.preventDefault()
                          }
                          if (item.to === '/firewall') setIsFirewallMenuOpen((open) => !open)
                          if (item.to === '/dns') setIsDnsMenuOpen((open) => !open)
                          if (item.to === '/system') setIsSystemMenuOpen((open) => !open)
                        }
                      : undefined
                  }
                  className={({ isActive }) =>
                    [itemClassName, isActive ? 'active' : ''].join(' ')
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              )}

              {item.to === '/dns' && isDnsMenuOpen && (
                <div className="mt-1 space-y-0.5">
                  <QueryNavLink to="/dns?section=settings" label="Settings" level={1} />
                  <QueryNavLink to="/dns?section=overrides" label="Overrides" level={1} />
                </div>
              )}

              {item.to === '/firewall' && isFirewallMenuOpen && (
                <div className="mt-1 space-y-0.5">
                  <QueryNavLink to="/firewall?section=rules" label="Rules" level={1} />
                  <QueryNavLink to="/firewall?section=aliases" label="Aliases" level={1} />
                  <QueryNavLink to="/firewall?section=settings" label="Settings" level={1} />
                </div>
              )}

              {item.to === '/system' && isSystemMenuOpen && (
                <div className="mt-1 space-y-0.5">
                  <QueryNavLink to="/system?section=updates" label="Updates" level={1} />
                  <QueryNavLink to="/system?section=reboot" label="Reboot" level={1} />
                  <QueryNavLink to="/admin-security" label="Security" level={1} />
                  <QueryNavLink to="/change-password" label="Change Password" level={1} />
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10 text-xs text-slate-500">
        v0.1.0
      </div>
    </aside>
  )
}
