import type { AxiosResponse } from 'axios';
import apiClient from './client';
import type { ApiResponse } from '../types';

export interface UiLogRequest {
  component: string;
  level: string;
  message: string;
  route?: string;
  url?: string;
  stack?: string;
  details?: unknown;
}

/**
 * Send a UI/browser log record to the backend. Fire-and-forget; errors are
 * swallowed to avoid noisy failures during normal app operation.
 */
export async function ingestUiLog(payload: UiLogRequest): Promise<void> {
  try {
    (await apiClient.post('/logs/ui', payload)) as AxiosResponse<unknown>;
  } catch {
    // Intentionally ignore errors when reporting logs so we don't cause
    // additional user-visible failures.
  }
}

export type HistoricalLogQuery = {
  from: string;
  to: string;
  source?: 'all' | 'system' | 'firewall' | 'suricata' | 'ui' | 'updates';
  q?: string;
  limit?: number;
};

export const searchLogs = (query: HistoricalLogQuery): Promise<ApiResponse<unknown[]>> =>
  apiClient.get<ApiResponse<unknown[]>>('/logs/search', { params: query }).then((r) => r.data);

export default { ingestUiLog, searchLogs };
