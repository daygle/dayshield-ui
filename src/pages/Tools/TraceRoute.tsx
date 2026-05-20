import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/Button';
import Card from '../../components/Card';
import FormField from '../../components/FormField';

export default function TraceRoute() {
  const [target, setTarget] = useState('');
  const [maxHops, setMaxHops] = useState(30);
  const [tracing, setTracing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleTrace = () => {
    if (!target.trim()) {
      addToast('Please enter a target host or IP address.', 'error');
      return;
    }

    setTracing(true);
    setResult(null);

    setTimeout(() => {
      setTracing(false);
      setResult(
        `Trace route requested for ${target} with max ${maxHops} hops. ` +
          'Backend integration is required to show actual hop results.'
      );
      addToast('Trace route queued.', 'success');
    }, 700);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Trace Route</h1>
          <p className="mt-1 text-sm text-gray-600">
            Trace the network path to a remote host and inspect hop latency.
          </p>
        </div>
      </div>

      <Card title="Trace Route" subtitle="Trace the route to a remote host or IP address.">
        <div className="space-y-6">
          <FormField
            id="traceroute-target"
            label="Target Host or IP"
            placeholder="example.com"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            required
          />

          <FormField
            id="traceroute-max-hops"
            label="Maximum Hops"
            type="number"
            min={1}
            max={64}
            value={maxHops}
            onChange={(event) => setMaxHops(Number(event.target.value))}
            required
            hint="Limit the number of hops the trace route will follow."
          />

          <div className="flex justify-end">
            <Button type="button" loading={tracing} variant="primary" onClick={handleTrace}>
              Run Trace Route
            </Button>
          </div>

          {result && (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Result</p>
              <p className="mt-1 whitespace-pre-line">{result}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
