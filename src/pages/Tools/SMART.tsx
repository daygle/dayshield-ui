import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/Button';
import Card from '../../components/Card';
import FormField from '../../components/FormField';

export default function SMART() {
  const [devicePath, setDevicePath] = useState('/dev/sda');
  const [scanType, setScanType] = useState('health');
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleCheck = () => {
    if (!devicePath.trim()) {
      addToast('Please enter a device path to check.', 'error');
      return;
    }

    setIsChecking(true);
    setResult(null);

    setTimeout(() => {
      setIsChecking(false);
      setResult(
        `SMART check requested for ${devicePath} (${scanType === 'health' ? 'health status' : 'attribute details'}). ` +
          'Backend integration is required to show live SMART values.'
      );
      addToast('SMART check queued.', 'success');
    }, 700);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">SMART</h1>
          <p className="mt-1 text-sm text-gray-600">
            Inspect SMART data for local storage devices and monitor disk health.
          </p>
        </div>
      </div>

      <Card title="SMART Storage Check" subtitle="Query storage device SMART health information." className="max-w-3xl">
        <div className="space-y-6">
          <FormField
            id="smart-device"
            label="Device Path"
            value={devicePath}
            onChange={(event) => setDevicePath(event.target.value)}
            placeholder="/dev/sda"
            required
            hint="Example: /dev/sda or /dev/nvme0n1"
          />

          <FormField id="smart-scan-type" label="Scan Type" as="select" value={scanType} onChange={(event) => setScanType(event.target.value)}>
            <option value="health">Health Status</option>
            <option value="attributes">Attribute Details</option>
          </FormField>

          <div className="flex justify-end">
            <Button type="button" loading={isChecking} variant="primary" onClick={handleCheck}>
              Run SMART Check
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
