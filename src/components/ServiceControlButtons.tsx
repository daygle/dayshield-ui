import { useCallback, useEffect, useRef, useState } from 'react';
import {
  controlSystemService,
  getSystemService,
  type ServiceAction,
  type ServiceActionDescriptor,
  type ServiceRuntimeStatus,
} from '../api/system';

type Tone = 'start' | 'restart' | 'stop';

interface ServiceControlButtonsProps {
  service?: ServiceRuntimeStatus | null;
  busyAction?: ServiceAction | null;
  disabled?: boolean;
  onAction: (action: ServiceAction) => void;
  className?: string;
}

interface ServiceStatusBadgeProps {
  service?: ServiceRuntimeStatus | null;
  loading?: boolean;
}

interface ServiceControlClusterProps {
  serviceId: string;
  disabled?: boolean;
  className?: string;
  onServiceChanged?: (service: ServiceRuntimeStatus) => void;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
}

const ACTION_ORDER: ServiceAction[] = ['start', 'restart', 'stop'];

const ACTION_LABEL: Record<ServiceAction, string> = {
  start: 'Start service',
  restart: 'Restart service',
  stop: 'Stop service',
};

const ACTION_TONE: Record<ServiceAction, Tone> = {
  start: 'start',
  restart: 'restart',
  stop: 'stop',
};

const buttonToneClasses: Record<Tone, string> = {
  start: 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 focus:ring-emerald-500',
  restart: 'text-blue-700 hover:bg-blue-50 hover:text-blue-800 focus:ring-blue-500',
  stop: 'text-red-700 hover:bg-red-50 hover:text-red-800 focus:ring-red-500',
};

const statusToneClasses: Record<string, string> = {
  running: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  stopped: 'border-gray-200 bg-gray-50 text-gray-600',
  notConfigured: 'border-gray-200 bg-gray-50 text-gray-600',
  degraded: 'border-amber-200 bg-amber-50 text-amber-700',
  missing: 'border-red-200 bg-red-50 text-red-700',
  unknown: 'border-gray-200 bg-gray-50 text-gray-600',
};

const statusDotClasses: Record<string, string> = {
  running: 'bg-emerald-500',
  stopped: 'bg-gray-400',
  notConfigured: 'bg-gray-400',
  degraded: 'bg-amber-500',
  missing: 'bg-red-500',
  unknown: 'bg-gray-400',
};

function actionDescriptor(
  service: ServiceRuntimeStatus | null | undefined,
  action: ServiceAction
): ServiceActionDescriptor | undefined {
  return service?.actions.find((item) => item.id === action);
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={3} />
      <path className="opacity-75" fill="currentColor" d="M12 3a9 9 0 019 9h-3a6 6 0 00-6-6V3z" />
    </svg>
  );
}

function StartIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.25 6.75v10.5a.75.75 0 001.14.64l8.25-5.25a.75.75 0 000-1.28L9.39 6.11a.75.75 0 00-1.14.64z"
        fill="currentColor"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.25}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12a8 8 0 10-2.34 5.66" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12V8m0 4h-4" />
    </svg>
  );
}

function actionIcon(action: ServiceAction, busy: boolean) {
  if (busy) return <SpinnerIcon />;
  if (action === 'start') return <StartIcon />;
  if (action === 'stop') return <StopIcon />;
  return <RestartIcon />;
}

export function ServiceStatusBadge({ service, loading = false }: ServiceStatusBadgeProps) {
  const status = loading ? 'unknown' : service?.status || 'unknown';
  const label = loading ? 'Loading' : service?.statusLabel || 'Unknown';
  const tone = statusToneClasses[status] ?? statusToneClasses.unknown;
  const dot = statusDotClasses[status] ?? statusDotClasses.unknown;

  return (
    <span
      className={`inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold ${tone}`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export default function ServiceControlButtons({
  service,
  busyAction = null,
  disabled = false,
  onAction,
  className = '',
}: ServiceControlButtonsProps) {
  return (
    <div
      className={`inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}
      role="group"
      aria-label="Service controls"
    >
      {ACTION_ORDER.map((action, index) => {
        const descriptor = actionDescriptor(service, action);
        const actionDisabled =
          disabled || busyAction !== null || !service || descriptor?.enabled === false;
        const label = descriptor?.label || ACTION_LABEL[action];
        const title = descriptor?.disabledReason || label;
        const isBusy = busyAction === action;

        return (
          <button
            key={action}
            type="button"
            disabled={actionDisabled}
            onClick={() => onAction(action)}
            title={title}
            aria-label={label}
            aria-busy={isBusy}
            className={[
              'inline-flex h-8 w-9 items-center justify-center bg-white text-sm transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-inset disabled:cursor-not-allowed disabled:text-gray-300',
              index > 0 ? 'border-l border-gray-200' : '',
              actionDisabled ? 'text-gray-300' : buttonToneClasses[ACTION_TONE[action]],
            ].join(' ')}
          >
            {actionIcon(action, isBusy)}
          </button>
        );
      })}
    </div>
  );
}

export function ServiceControlCluster({
  serviceId,
  disabled = false,
  className = '',
  onServiceChanged,
  onError,
  onSuccess,
}: ServiceControlClusterProps) {
  const [service, setService] = useState<ServiceRuntimeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<ServiceAction | null>(null);
  const onErrorRef = useRef(onError);
  const onSuccessRef = useRef(onSuccess);
  const onServiceChangedRef = useRef(onServiceChanged);

  useEffect(() => {
    onErrorRef.current = onError;
    onSuccessRef.current = onSuccess;
    onServiceChangedRef.current = onServiceChanged;
  }, [onError, onServiceChanged, onSuccess]);

  const loadService = useCallback(() => {
    setLoading(true);
    getSystemService(serviceId)
      .then((res) => {
        setService(res.data);
        onServiceChangedRef.current?.(res.data);
      })
      .catch((err: Error) => onErrorRef.current?.(`Failed to load service status: ${err.message}`))
      .finally(() => setLoading(false));
  }, [serviceId]);

  useEffect(() => {
    loadService();
  }, [loadService]);

  const runAction = useCallback(
    (action: ServiceAction) => {
      const descriptor = actionDescriptor(service, action);
      if (descriptor?.requiresConfirmation) {
        const confirmed = window.confirm(
          `${descriptor.label} for ${service?.title ?? 'this service'}?`
        );
        if (!confirmed) return;
      }

      setBusyAction(action);
      controlSystemService(serviceId, action)
        .then((res) => {
          setService(res.data.service);
          onServiceChangedRef.current?.(res.data.service);
          onSuccessRef.current?.(res.data.message);
        })
        .catch((err: Error) => onErrorRef.current?.(err.message))
        .finally(() => setBusyAction(null));
    },
    [service, serviceId]
  );

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <ServiceStatusBadge service={service} loading={loading} />
      <ServiceControlButtons
        service={service}
        busyAction={busyAction}
        disabled={disabled || loading}
        onAction={runAction}
      />
    </div>
  );
}
