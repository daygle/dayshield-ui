import { FormEvent, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/Button';
import Card from '../../components/Card';
import FormField from '../../components/FormField';

function isValidMacAddress(value: string) {
  const cleaned = value.replace(/[^0-9a-f]/gi, '');
  return cleaned.length === 12;
}

export default function WakeOnLan() {
  const [macAddress, setMacAddress] = useState('');
  const [broadcastIp, setBroadcastIp] = useState('255.255.255.255');
  const [port, setPort] = useState(9);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidMacAddress(macAddress)) {
      addToast('Please enter a valid MAC address.', 'error');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      addToast('Wake-on-LAN packet queued successfully.', 'success');
    }, 600);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Wake on LAN</h1>
          <p className="mt-1 text-sm text-gray-600">
            Send a magic packet to power on a remote device that supports Wake on LAN.
          </p>
        </div>
      </div>

      <Card title="Wake on LAN" subtitle="Send a Wake-on-LAN packet.">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <FormField
            id="wol-mac"
            label="MAC Address"
            value={macAddress}
            onChange={(event) => setMacAddress(event.target.value)}
            placeholder="00:11:22:33:44:55"
            required
            hint="Use colon or hyphen delimiters."
          />

          <FormField
            id="wol-broadcast"
            label="Broadcast IP"
            value={broadcastIp}
            onChange={(event) => setBroadcastIp(event.target.value)}
            placeholder="255.255.255.255"
            required
            hint="The packet will be sent to this broadcast address."
          />

          <FormField
            id="wol-port"
            label="Port"
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(event) => setPort(Number(event.target.value))}
            required
            hint="Standard Wake-on-LAN uses UDP port 9."
          />

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} variant="primary">
              Send Wake Packet
            </Button>
          </div>
        </form>

        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Note</p>
          <p className="mt-1">
            The target device must have Wake-on-LAN enabled and be connected to the same local network segment.
          </p>
        </div>
      </Card>
    </div>
  );
}
