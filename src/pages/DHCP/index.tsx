import Card from '../../components/Card'

// TODO: Implement DHCP server configuration (GET/POST /dhcp/config)
// TODO: Add DHCP pools / ranges management
// TODO: Add static lease management (MAC → IP binding)
// TODO: Show active DHCP leases with expiry times
// TODO: Add DHCP option set management (router, DNS, NTP, etc.)

export default function DHCP() {
  return (
    <Card title="DHCP" subtitle="Dynamic Host Configuration Protocol server">
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <svg
          className="h-14 w-14 mb-4 opacity-40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 12h14M12 5l7 7-7 7"
          />
        </svg>
        <p className="text-sm font-medium">DHCP management coming soon</p>
        <p className="text-xs mt-1">
          Pools · Static leases · Options · Active lease table planned.
        </p>
      </div>
    </Card>
  )
}
