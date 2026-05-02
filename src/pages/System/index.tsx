import Card from '../../components/Card'

// TODO: Implement system settings (GET/PUT /system/config)
// TODO: Add admin password / user management
// TODO: Add firmware / update management (GET /system/updates)
// TODO: Add backup and restore configuration (GET/POST /system/backup)
// TODO: Add system reboot / shutdown controls
// TODO: Add NTP server configuration
// TODO: Add SSH access settings

export default function System() {
  return (
    <Card title="System" subtitle="System settings and administration">
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
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <p className="text-sm font-medium">System settings coming soon</p>
        <p className="text-xs mt-1">
          Users · NTP · SSH · Backup · Updates planned.
        </p>
      </div>
    </Card>
  )
}
