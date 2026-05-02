import { useQuery } from '@tanstack/react-query'
import { getDashboardSystemStatus } from '../api/system'

export function useSystemStatus() {
  return useQuery({
    queryKey: ['dashboard', 'system'],
    queryFn: () => getDashboardSystemStatus().then((r) => r.data),
    refetchInterval: 5000,
    retry: 2,
  })
}
