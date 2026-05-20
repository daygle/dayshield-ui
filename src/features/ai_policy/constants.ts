import type { AutomationMode, DecisionAction } from '../../types';

export const AUTOMATION_MODE_OPTIONS: Array<{
  value: AutomationMode;
  label: string;
  description: string;
}> = [
  {
    value: 'monitor_only',
    label: 'Monitor Only',
    description: 'Observe events and generate insights without changing rules.',
  },
  {
    value: 'suggest_edits',
    label: 'Suggest Edits',
    description: 'Generate allow/deny/edit suggestions for operator approval.',
  },
  {
    value: 'full_ai_control',
    label: 'Full AI Control',
    description: 'Automatically apply high-confidence AI policy actions.',
  },
];

export function normalizeAutomationMode(value: unknown): AutomationMode {
  if (value === 'monitor_only' || value === 'MonitorOnly') return 'monitor_only';
  if (value === 'suggest_edits' || value === 'SuggestEdits') return 'suggest_edits';
  if (value === 'full_ai_control' || value === 'FullAIControl') return 'full_ai_control';
  return 'monitor_only';
}

export function actionToLabel(action: DecisionAction): string {
  switch (action) {
    case 'Allow':
      return 'Allow';
    case 'Deny':
      return 'Deny';
    case 'SuggestAllow':
      return 'Suggest Allow';
    case 'SuggestDeny':
      return 'Suggest Deny';
    case 'EditRule':
      return 'Edit Rule';
    case 'RemoveRule':
      return 'Remove Rule';
    default:
      return action;
  }
}

export function confidenceClass(confidence: number): string {
  if (confidence >= 0.85) return 'bg-green-100 text-green-700';
  if (confidence >= 0.6) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}
