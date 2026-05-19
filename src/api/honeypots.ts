import apiClient from './client';
import type {
  ApiResponse,
  HoneypotConfig,
  HoneypotEvent,
  HoneypotRecommendation,
  HoneypotSourceIp,
} from '../types';

export const getHoneypotConfig = (): Promise<ApiResponse<HoneypotConfig>> =>
  apiClient.get<ApiResponse<HoneypotConfig>>('/honeypots/config').then((r) => r.data);

export const updateHoneypotConfig = (
  config: HoneypotConfig
): Promise<ApiResponse<HoneypotConfig>> =>
  apiClient.post<ApiResponse<HoneypotConfig>>('/honeypots/config', config).then((r) => r.data);

export const getHoneypotEvents = (limit = 100): Promise<ApiResponse<HoneypotEvent[]>> =>
  apiClient
    .get<ApiResponse<HoneypotEvent[]>>('/honeypots/events', { params: { limit } })
    .then((r) => r.data);

export const getHoneypotSourceIps = (limit = 1000): Promise<ApiResponse<HoneypotSourceIp[]>> =>
  apiClient
    .get<ApiResponse<HoneypotSourceIp[]>>('/honeypots/ips', { params: { limit } })
    .then((r) => r.data);

export const getHoneypotRecommendations = (): Promise<
  ApiResponse<HoneypotRecommendation[]>
> =>
  apiClient
    .get<ApiResponse<HoneypotRecommendation[]>>('/honeypots/recommendations')
    .then((r) => r.data);
