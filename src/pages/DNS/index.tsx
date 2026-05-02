import Card from '../../components/Card'

// TODO: Implement DNS resolver configuration (GET/POST /dns/config)
// TODO: Add DNS forwarders list
// TODO: Add local DNS host overrides
// TODO: Add DNS blocklist management
// TODO: Show DNS query statistics

export default function DNS() {
  return (
    <Card title="DNS" subtitle="Domain Name System configuration and resolver">
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
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"
          />
        </svg>
        <p className="text-sm font-medium">DNS management coming soon</p>
        <p className="text-xs mt-1">
          Resolver · Forwarders · Host overrides · Blocklists planned.
        </p>
      </div>
    </Card>
  )
}
