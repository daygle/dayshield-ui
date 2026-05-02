import { useQuery } from '@tanstack/react-query'
import { getDashboardAcmeStatus } from '../api/system'

export function useAcmeStatus() {
  return useQuery({
    queryKey: ['dashboard', 'acme'],
    queryFn: () => getDashboardAcmeStatus().then((r) => r.data),
    refetchInterval: 5000,
    retry: 2,
  })
}
