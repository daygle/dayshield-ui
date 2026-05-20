import type { AutomationMode } from '../../types';
import Card from '../../components/Card';
import { AUTOMATION_MODE_OPTIONS } from './constants';

interface AutomationModeSelectorProps {
  mode: AutomationMode;
  loading: boolean;
  saving: boolean;
  onSelect: (mode: AutomationMode) => void;
}

export default function AutomationModeSelector({
  mode,
  loading,
  saving,
  onSelect,
}: AutomationModeSelectorProps) {
  return (
    <Card title="Automation Mode" subtitle="Control how aggressively AI can update firewall policy">
      {loading ? (
        <p className="text-sm text-gray-500">Loading current mode...</p>
      ) : (
        <div className="space-y-2">
          {AUTOMATION_MODE_OPTIONS.map((option) => {
            const selected = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={[
                  'w-full rounded-lg border px-4 py-3 text-left transition-colors',
                  selected
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700',
                ].join(' ')}
                onClick={() => onSelect(option.value)}
                disabled={saving}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                  </div>
                  <span
                    className={[
                      'inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs',
                      selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-transparent',
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                </div>
              </button>
            );
          })}

          <p className="pt-1 text-xs text-gray-500">{saving ? 'Saving mode...' : 'Mode saves instantly.'}</p>
        </div>
      )}
    </Card>
  );
}
