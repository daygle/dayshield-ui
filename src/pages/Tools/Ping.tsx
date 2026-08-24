import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/Button';
import Card from '../../components/Card';
import FormField from '../../components/FormField';

export default function Ping() {
  const [target, setTarget] = useState('');
  const [count, setCount] = useState(4);
  const [packetSize, setPacketSize] = useState(56);
  const [pinging, setPinging] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { addToast } = useToast();

  const handlePing = () => {
    if (!target.trim()) {
      addToast('Please enter a target host or IP address.', 'error');
      return;
    }

    const safeCount = Math.max(1, Math.min(20, Math.trunc(count) || 4));
    const safePacketSize = Math.max(16, Math.min(1024, Math.trunc(packetSize) || 56));
    setCount(safeCount);
    setPacketSize(safePacketSize);
    setPinging(true);
    setResult(null);
    addToast('Ping is not available because no backend tool endpoint is configured.', 'error');
    setPinging(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ping</h1>
          <p className="mt-1 text-sm text-gray-600">
            Send ICMP echo requests to a host and measure round-trip latency.
          </p>
        </div>
      </div>

      <Card title="Ping" subtitle="Measure connectivity and latency to a network host.">
        <div className="space-y-6">
          <FormField
            id="ping-target"
            label="Target Host or IP"
            placeholder="example.com"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            required
          />

          <FormField
            id="ping-count"
            label="Packet Count"
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            required
            hint="Number of echo requests to send."
          />

          <FormField
            id="ping-packet-size"
            label="Packet Size (bytes)"
            type="number"
            min={16}
            max={1024}
            value={packetSize}
            onChange={(event) => setPacketSize(Number(event.target.value))}
            required
            hint="ICMP payload size in bytes."
          />

          <div className="flex justify-end">
            <Button type="button" size="sm" loading={pinging} variant="primary" onClick={handlePing}>
              Run Ping
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
