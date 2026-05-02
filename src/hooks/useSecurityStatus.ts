import { useQuery } from '@tanstack/react-query'
import { getDashboardSecurityStatus } from '../api/system'

export function useSecurityStatus() {
  return useQuery({
    queryKey: ['dashboard', 'security'],
    queryFn: () => getDashboardSecurityStatus().then((r) => r.data),
    refetchInterval: 5000,
    retry: 2,
  })
}
