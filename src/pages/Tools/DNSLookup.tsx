import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/Button';
import Card from '../../components/Card';
import FormField from '../../components/FormField';

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'];

export default function DNSLookup() {
  const [hostname, setHostname] = useState('');
  const [recordType, setRecordType] = useState('A');
  const [dnsServer, setDnsServer] = useState('');
  const [querying, setQuerying] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleLookup = () => {
    if (!hostname.trim()) {
      addToast('Please enter a hostname to query.', 'error');
      return;
    }

    setQuerying(true);
    setResult(null);

    setTimeout(() => {
      setQuerying(false);
      setResult(
        `DNS lookup requested for ${hostname} (${recordType}). ` +
          (dnsServer ? `Server: ${dnsServer}. ` : '') +
          'Backend integration is required to display actual DNS records.'
      );
      addToast('DNS query queued.', 'success');
    }, 700);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">DNS Lookup</h1>
          <p className="mt-1 text-sm text-gray-600">
            Query DNS records for a host name and inspect the returned resource records.
          </p>
        </div>
      </div>

      <Card title="DNS Lookup" subtitle="Query DNS record types for a hostname.">
        <div className="space-y-6">
          <FormField
            id="dns-hostname"
            label="Hostname"
            placeholder="example.com"
            value={hostname}
            onChange={(event) => setHostname(event.target.value)}
            required
            hint="Enter the domain name to query."
          />

          <FormField
            id="dns-record-type"
            label="Record Type"
            as="select"
            value={recordType}
            onChange={(event) => setRecordType(event.target.value)}
          >
            {RECORD_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </FormField>

          <FormField
            id="dns-server"
            label="DNS Server (optional)"
            placeholder="8.8.8.8"
            value={dnsServer}
            onChange={(event) => setDnsServer(event.target.value)}
            hint="Leave blank to use the system resolver."
          />

          <div className="flex justify-end">
            <Button type="button" loading={querying} variant="primary" onClick={handleLookup}>
              Run DNS Lookup
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
