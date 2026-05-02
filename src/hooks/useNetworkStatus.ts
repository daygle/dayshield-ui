import { useQuery } from '@tanstack/react-query'
import { getDashboardNetworkStatus } from '../api/system'

export function useNetworkStatus() {
  return useQuery({
    queryKey: ['dashboard', 'network'],
    queryFn: () => getDashboardNetworkStatus().then((r) => r.data),
    refetchInterval: 5000,
    retry: 2,
  })
}
