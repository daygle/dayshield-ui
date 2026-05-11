import { useQuery } from '@tanstack/react-query'
import { getMetrics } from '../api/metrics'

export function useMetrics() {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: () => getMetrics().then((r) => r.data),
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
    retry: 2,
  })
}
