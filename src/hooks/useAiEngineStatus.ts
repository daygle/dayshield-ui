import { useQuery } from '@tanstack/react-query'
import { getAiEngineConfig } from '../api/ai'

export function useAiEngineStatus() {
  return useQuery({
    queryKey: ['dashboard', 'ai-engine'],
    queryFn: () => getAiEngineConfig().then((r) => r.data),
    refetchInterval: 5000,
    retry: 2,
  })
}
