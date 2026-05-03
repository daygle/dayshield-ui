import { useState } from 'react'
import OutboundNAT from './OutboundNAT'
import PortForward from './PortForward'
import NATReflection from './NATReflection'

type Tab = 'outbound' | 'portforward' | 'reflection'

const tabs: { id: Tab; label: string }[] = [
  { id: 'outbound', label: 'Outbound NAT' },
  { id: 'portforward', label: 'Port Forward' },
  { id: 'reflection', label: 'NAT Reflection' },
]

export default function NAT() {
  const [activeTab, setActiveTab] = useState<Tab>('outbound')

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1" aria-label="NAT tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'outbound' && <OutboundNAT />}
      {activeTab === 'portforward' && <PortForward />}
      {activeTab === 'reflection' && <NATReflection />}
    </div>
  )
}
