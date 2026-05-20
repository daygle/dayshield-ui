import { useState } from 'react';
import WakeOnLan from './WakeOnLan';
import SMART from './SMART';
import DNSLookup from './DNSLookup';
import TraceRoute from './TraceRoute';
import Ping from './Ping';

type ToolTab = 'wake-on-lan' | 'smart' | 'dns-lookup' | 'trace-route' | 'ping';

const tabs: { id: ToolTab; label: string }[] = [
  { id: 'wake-on-lan', label: 'Wake on LAN' },
  { id: 'smart', label: 'SMART' },
  { id: 'dns-lookup', label: 'DNS Lookup' },
  { id: 'trace-route', label: 'Trace Route' },
  { id: 'ping', label: 'Ping' },
];

export default function Tools() {
  const [activeTab, setActiveTab] = useState<ToolTab>('wake-on-lan');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tools</h1>
          <p className="mt-1 text-sm text-gray-600">
            Utility actions for remote wake and storage health checks.
          </p>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1" aria-label="Tools tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
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
            );
          })}
        </nav>
      </div>

      {activeTab === 'wake-on-lan' && <WakeOnLan />}
      {activeTab === 'smart' && <SMART />}
      {activeTab === 'dns-lookup' && <DNSLookup />}
      {activeTab === 'trace-route' && <TraceRoute />}
      {activeTab === 'ping' && <Ping />}
    </div>
  );
}
