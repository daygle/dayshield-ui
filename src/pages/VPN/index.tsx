import Card from '../../components/Card'

// TODO: Implement VPN tunnel list (GET /vpn/tunnels)
// TODO: Add WireGuard peer management
// TODO: Add OpenVPN server configuration
// TODO: Add IPSec site-to-site tunnel support
// TODO: Show tunnel status and traffic statistics

export default function VPN() {
  return (
    <Card title="VPN" subtitle="Virtual Private Network configuration">
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
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <p className="text-sm font-medium">VPN management coming soon</p>
        <p className="text-xs mt-1">
          WireGuard · OpenVPN · IPSec support planned.
        </p>
      </div>
    </Card>
  )
}
