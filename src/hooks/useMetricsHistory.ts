import { useQuery } from '@tanstack/react-query'
import { getMetricsHistory } from '../api/metrics'

export function useMetricsHistory(seconds = 300) {
  return useQuery({
    queryKey: ['metrics', 'history', seconds],
    queryFn: () => getMetricsHistory(seconds).then((r) => r.data),
    refetchInterval: 10000,
    retry: 2,
  })
}
