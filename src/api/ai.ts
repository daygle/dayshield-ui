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
} from '../types';

export const getAiThreats = (limit = 100): Promise<ApiResponse<ThreatEvent[]>> =>
  apiClient
    .get<ApiResponse<ThreatEvent[]>>('/api/ai/threats', { params: { limit } })
    .then((r) => r.data);

export const getAiThreatById = (id: string): Promise<ApiResponse<ThreatEvent>> =>
  apiClient
    .get<ApiResponse<ThreatEvent>>(`/api/ai/threats/${encodeURIComponent(id)}`)
    .then((r) => r.data);

export const getAiBlockedEntries = (): Promise<ApiResponse<BlockedEntry[]>> =>
  apiClient.get<ApiResponse<BlockedEntry[]>>('/api/ai/blocked').then((r) => r.data);

export const unblockAiIp = (ip: string): Promise<ApiResponse<{ ip: string; unblocked: boolean }>> =>
  apiClient
    .post<
      ApiResponse<{ ip: string; unblocked: boolean }>
    >(`/api/ai/unblock/${encodeURIComponent(ip)}`)
    .then((r) => r.data);

export const getAiEngineConfig = (): Promise<ApiResponse<AiEngineConfig>> =>
  apiClient.get<ApiResponse<AiEngineConfig>>('/api/ai/config').then((r) => r.data);

export const updateAiEngineConfig = (
  config: AiEngineConfig
): Promise<ApiResponse<AiEngineConfig>> =>
  apiClient.post<ApiResponse<AiEngineConfig>>('/api/ai/config', config).then((r) => r.data);

export const submitAiFeedback = (
  id: string,
  feedback: 'false_positive' | 'confirmed_malicious'
): Promise<ApiResponse<ThreatEvent>> =>
  apiClient
    .post<ApiResponse<ThreatEvent>>(`/api/ai/feedback/${encodeURIComponent(id)}`, {
      feedback,
    })
    .then((r) => r.data);

export interface ApplyAiSuggestionRequest {
  suggestion_id: string;
  apply: boolean;
}

export const getAiSuggestions = (): Promise<ApiResponse<Suggestion[]>> =>
  apiClient.get<ApiResponse<Suggestion[]>>('/api/ai/suggestions').then((r) => r.data);

export const applyAiSuggestion = (
  payload: ApplyAiSuggestionRequest
): Promise<ApiResponse<RuleAudit | Suggestion | null>> =>
  apiClient.post<ApiResponse<RuleAudit | Suggestion | null>>('/api/ai/apply', payload).then((r) => r.data);

export const getAiIntents = (): Promise<ApiResponse<Intent[]>> =>
  apiClient.get<ApiResponse<Intent[]>>('/api/ai/intents').then((r) => r.data);

export const saveAiIntents = (intents: Intent[]): Promise<ApiResponse<Intent[]>> =>
  apiClient.post<ApiResponse<Intent[]>>('/api/ai/intents', intents).then((r) => r.data);

export const getAiAutomationMode = (): Promise<ApiResponse<AutomationMode | { mode: AutomationMode }>> =>
  apiClient.get<ApiResponse<AutomationMode | { mode: AutomationMode }>>('/api/ai/mode').then((r) => r.data);

export const setAiAutomationMode = (
  mode: AutomationMode
): Promise<ApiResponse<AutomationMode | { mode: AutomationMode }>> =>
  apiClient.post<ApiResponse<AutomationMode | { mode: AutomationMode }>>('/api/ai/mode', { mode }).then((r) => r.data);

export const undoLastAiAction = (): Promise<ApiResponse<RuleAudit | null>> =>
  apiClient.post<ApiResponse<RuleAudit | null>>('/api/ai/undo_last_action').then((r) => r.data);
