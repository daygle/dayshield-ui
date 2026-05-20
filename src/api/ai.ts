import apiClient from './client';
import type {
  ApiResponse,
  ThreatEvent,
  BlockedEntry,
  AiEngineConfig,
  Suggestion,
  Intent,
  AutomationMode,
  RuleAudit,
  TrafficCandidate,
} from '../types';

function normalizeResponse<T>(payload: unknown): ApiResponse<T> {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    'success' in payload
  ) {
    return payload as ApiResponse<T>;
  }

  return {
    data: payload as T,
    success: true,
  };
}

export const getAiThreats = (limit = 100): Promise<ApiResponse<ThreatEvent[]>> =>
  apiClient
    .get<ApiResponse<ThreatEvent[]>>('/api/ai/threats', { params: { limit } })
    .then((r) => normalizeResponse<ThreatEvent[]>(r.data));

export const getAiThreatById = (id: string): Promise<ApiResponse<ThreatEvent>> =>
  apiClient
    .get<ApiResponse<ThreatEvent>>(`/api/ai/threats/${encodeURIComponent(id)}`)
    .then((r) => normalizeResponse<ThreatEvent>(r.data));

export const getAiBlockedEntries = (): Promise<ApiResponse<BlockedEntry[]>> =>
  apiClient.get<ApiResponse<BlockedEntry[]>>('/api/ai/blocked').then((r) => normalizeResponse<BlockedEntry[]>(r.data));

export const unblockAiIp = (ip: string): Promise<ApiResponse<{ ip: string; unblocked: boolean }>> =>
  apiClient
    .post<
      ApiResponse<{ ip: string; unblocked: boolean }>
    >(`/api/ai/unblock/${encodeURIComponent(ip)}`)
    .then((r) => normalizeResponse<{ ip: string; unblocked: boolean }>(r.data));

export const getAiEngineConfig = (): Promise<ApiResponse<AiEngineConfig>> =>
  apiClient.get<ApiResponse<AiEngineConfig>>('/api/ai/config').then((r) => normalizeResponse<AiEngineConfig>(r.data));

export const updateAiEngineConfig = (
  config: AiEngineConfig
): Promise<ApiResponse<AiEngineConfig>> =>
  apiClient.post<ApiResponse<AiEngineConfig>>('/api/ai/config', config).then((r) => normalizeResponse<AiEngineConfig>(r.data));

export const submitAiFeedback = (
  id: string,
  feedback: 'false_positive' | 'confirmed_malicious'
): Promise<ApiResponse<ThreatEvent>> =>
  apiClient
    .post<ApiResponse<ThreatEvent>>(`/api/ai/feedback/${encodeURIComponent(id)}`, {
      feedback,
    })
    .then((r) => normalizeResponse<ThreatEvent>(r.data));

export interface ApplyAiSuggestionRequest {
  suggestion_id: string;
  apply: boolean;
}

export const getAiTrafficCandidates = (): Promise<ApiResponse<TrafficCandidate[]>> =>
  apiClient
    .get<ApiResponse<TrafficCandidate[]>>('/api/ai/traffic_candidates')
    .then((r) => normalizeResponse<TrafficCandidate[]>(r.data));

export const getAiSuggestions = (): Promise<ApiResponse<Suggestion[]>> =>
  apiClient.get<ApiResponse<Suggestion[]>>('/api/ai/suggestions').then((r) => normalizeResponse<Suggestion[]>(r.data));

export const applyAiSuggestion = (
  payload: ApplyAiSuggestionRequest
): Promise<ApiResponse<RuleAudit | Suggestion | null>> =>
  apiClient
    .post<ApiResponse<RuleAudit | Suggestion | null>>('/api/ai/apply', {
      suggestion_id: payload.suggestion_id,
      approve: payload.apply,
    })
    .then((r) => normalizeResponse<RuleAudit | Suggestion | null>(r.data));

export const getAiIntents = (): Promise<ApiResponse<Intent[]>> =>
  apiClient.get<ApiResponse<Intent[]>>('/api/ai/intents').then((r) => normalizeResponse<Intent[]>(r.data));

export const saveAiIntents = (intents: Intent[]): Promise<ApiResponse<Intent[]>> =>
  apiClient
    .post<ApiResponse<Intent[]>>('/api/ai/intents', { intents })
    .then((r) => normalizeResponse<Intent[]>(r.data));

export const getAiAutomationMode = (
  iface?: string
): Promise<ApiResponse<AutomationMode | { mode: AutomationMode }>> =>
  apiClient
    .get<ApiResponse<AutomationMode | { mode: AutomationMode }>>('/api/ai/mode', {
      params: iface ? { iface } : undefined,
    })
    .then((r) => normalizeResponse<AutomationMode | { mode: AutomationMode }>(r.data));

export const setAiAutomationMode = (
  mode: AutomationMode,
  iface?: string
): Promise<ApiResponse<AutomationMode | { mode: AutomationMode }>> =>
  apiClient
    .post<ApiResponse<AutomationMode | { mode: AutomationMode }>>(
      '/api/ai/mode',
      { mode },
      { params: iface ? { iface } : undefined }
    )
    .then((r) => normalizeResponse<AutomationMode | { mode: AutomationMode }>(r.data));

export const undoLastAiAction = (): Promise<ApiResponse<RuleAudit | null>> =>
  apiClient
    .post<ApiResponse<RuleAudit | null>>('/api/ai/undo_last_action')
    .then((r) => normalizeResponse<RuleAudit | null>(r.data));
