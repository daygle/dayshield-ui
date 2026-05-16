import { useState } from 'react'
import Suricata from '../Suricata'
import CrowdSec from '../CrowdSec'
import AIThreats from '../AIThreats'

type Tab = 'suricata' | 'crowdsec' | 'ai'

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'suricata', label: 'Suricata' },
  { id: 'crowdsec', label: 'CrowdSec' },
  { id: 'ai', label: 'AI Threat Engine' },
]

export default function Security() {
  const [activeTab, setActiveTab] = useState<Tab>('suricata')

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1" aria-label="Security tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
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

      {activeTab === 'suricata' && <Suricata />}
      {activeTab === 'crowdsec' && <CrowdSec />}
      {activeTab === 'ai' && <AIThreats />}
    </div>
  )
}
