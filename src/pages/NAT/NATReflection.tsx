import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNatConfig, updateNatConfig } from '../../api/nat'
import { useToast } from '../../context/ToastContext'
import Card from '../../components/Card'

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

  const toggle = () => {
    if (!config) return
    mutation.mutate({ ...config, nat_reflection: !config.nat_reflection })
  }

  return (
    <div className="space-y-6">
      <Card
        title="NAT Reflection"
        subtitle="Controls whether LAN clients can reach internal servers via the WAN (public) IP address"
      >
        {isLoading ? (
          <p className="text-sm text-gray-400">Loadingâ€¦</p>
        ) : (
          <div className="flex items-center justify-between rounded-lg border-2 border-gray-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {config?.nat_reflection ? 'Enabled' : 'Disabled'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {config?.nat_reflection
                  ? 'LAN clients can reach port forwards using the WAN IP (hairpin NAT active).'
                  : 'LAN clients cannot reach port forwards using the WAN IP.'}
              </p>
            </div>
            <button
              onClick={toggle}
              disabled={mutation.isPending}
              className={[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                config?.nat_reflection ? 'bg-blue-600' : 'bg-gray-200',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                  config?.nat_reflection ? 'translate-x-6' : 'translate-x-1',
                ].join(' ')}
              />
            </button>
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
            service will be routed to the WAN gateway instead of the internal server. Enabling NAT
            reflection inserts additional rules so these connections are redirected correctly.
          </p>
        </div>
      </Card>
    </div>
  )
}
