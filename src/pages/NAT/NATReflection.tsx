import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNatConfig, updateNatConfig } from '../../api/nat'
import { useToast } from '../../context/ToastContext'
import type { NatReflectionMode } from '../../types'
import Card from '../../components/Card'

const modes: { value: NatReflectionMode; label: string; desc: string }[] = [
  {
    value: 'disabled',
    label: 'Disabled',
    desc: 'NAT reflection is off. LAN clients cannot reach port forwards using the WAN IP.',
  },
  {
    value: 'purenat',
    label: 'Pure NAT',
    desc: 'Uses NAT rules to redirect packets from LAN clients destined for the WAN IP back to the internal host. Compatible with all setups.',
  },
]

export default function NATReflection() {
  const qc = useQueryClient()
  const { addToast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['nat', 'config'],
    queryFn: getNatConfig,
  })

  const config = data?.data

  const mutation = useMutation({
    mutationFn: updateNatConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nat', 'config'] })
      addToast('NAT reflection setting updated', 'success')
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  })

  return (
    <div className="space-y-6">
      <Card
        title="NAT Reflection"
        subtitle="Controls whether LAN clients can reach internal servers via the WAN (public) IP address"
      >
        {isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="space-y-3">
            {modes.map((m) => {
              const active = config?.reflection === m.value
              return (
                <button
                  key={m.value}
                  onClick={() => mutation.mutate({ reflection: m.value })}
                  disabled={mutation.isPending}
                  className={[
                    'w-full text-left rounded-lg border-2 px-4 py-3 transition-colors',
                    active
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-blue-300',
                  ].join(' ')}
                >
                  <p className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-800'}`}>
                    {m.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{m.desc}</p>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      <Card title="About NAT Reflection">
        <div className="prose prose-sm text-gray-600 max-w-none">
          <p>
            NAT reflection (also called NAT loopback or hairpin NAT) allows hosts on your LAN to
            connect to servers on the same LAN using the firewall's WAN IP address or hostname.
          </p>
          <p className="mt-2">
            Without NAT reflection, a LAN client connecting to your public IP for a port-forwarded
            service will be routed to the WAN gateway instead of the internal server. Enabling{' '}
            <strong>Pure NAT</strong> inserts additional NAT rules so these connections are
            redirected correctly.
          </p>
        </div>
      </Card>
    </div>
  )
}
