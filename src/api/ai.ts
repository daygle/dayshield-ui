import apiClient from './client';
import type {
  ApiResponse,
  ThreatEvent,
  BlockedEntry,
  AiEngineConfig,
  Suggestion,
  Intent,
  AutomationMode,
  TrafficCandidate,
  ApplySuggestionResponse,
  UndoResponse,
  AIAutomationSettings,
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

export const getAiThreatEngineEvents = (limit = 100): Promise<ApiResponse<ThreatEvent[]>> =>
  apiClient
    .get<ApiResponse<ThreatEvent[]>>('/api/ai/threats', { params: { limit } })
    .then((r) => normalizeResponse<ThreatEvent[]>(r.data));

export const getAiThreatEngineEventById = (id: string): Promise<ApiResponse<ThreatEvent>> =>
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

/**
 * Request payload for applying or rejecting an AI suggestion.
 *
 * `apply` is the frontend-facing field name; it is sent to the backend as
 * `approve` (see the POST body mapping in `applyAiSuggestion` below).
 * This asymmetry is intentional — the frontend uses the more intuitive
 * name while the backend uses the domain term from the AI policy engine.
 */
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
): Promise<ApiResponse<ApplySuggestionResponse>> =>
  apiClient
    .post<ApiResponse<ApplySuggestionResponse>>('/api/ai/apply', {
      suggestion_id: payload.suggestion_id,
      // Backend field is `approve`; frontend field is `apply` — intentional naming asymmetry.
      approve: payload.apply,
    })
    .then((r) => normalizeResponse<ApplySuggestionResponse>(r.data));

export const getAiIntents = (): Promise<ApiResponse<Intent[]>> =>
  apiClient.get<ApiResponse<Intent[]>>('/api/ai/intents').then((r) => normalizeResponse<Intent[]>(r.data));

export const saveAiIntents = (intents: Intent[]): Promise<ApiResponse<Intent[]>> =>
  apiClient
    .post<ApiResponse<Intent[]>>('/api/ai/intents', { intents })
    .then((r) => normalizeResponse<Intent[]>(r.data));

/**
 * Fetch the current AI automation mode for the given interface (or the
 * global mode when no interface is specified).
 *
 * The backend returns the raw `AutomationMode` string directly — not a
 * wrapped `{ mode }` object.
 */
export const getAiAutomationMode = (
  iface?: string
): Promise<ApiResponse<AutomationMode>> =>
  apiClient
    .get<ApiResponse<AutomationMode>>('/api/ai/mode', {
      params: iface ? { iface } : undefined,
    })
    .then((r) => normalizeResponse<AutomationMode>(r.data));

/**
 * Set the AI automation mode for the given interface (or globally when no
 * interface is specified).
 *
 * The backend returns the updated `AutomationMode` string directly — not a
 * wrapped `{ mode }` object.
 */
export const setAiAutomationMode = (
  mode: AutomationMode,
  iface?: string
): Promise<ApiResponse<AutomationMode>> =>
  apiClient
    .post<ApiResponse<AutomationMode>>(
      '/api/ai/mode',
      { mode },
      { params: iface ? { iface } : undefined }
    )
    .then((r) => normalizeResponse<AutomationMode>(r.data));

export const getAiAutomationSettings = (): Promise<ApiResponse<AIAutomationSettings>> =>
  apiClient
    .get<ApiResponse<AIAutomationSettings>>('/api/ai/automation_settings')
    .then((r) => normalizeResponse<AIAutomationSettings>(r.data));

export const saveAiAutomationSettings = (
  settings: AIAutomationSettings
): Promise<ApiResponse<AIAutomationSettings>> =>
  apiClient
    .post<ApiResponse<AIAutomationSettings>>('/api/ai/automation_settings', settings)
    .then((r) => normalizeResponse<AIAutomationSettings>(r.data));

export const undoLastAiAction = (): Promise<ApiResponse<UndoResponse>> =>
  apiClient
    .post<ApiResponse<UndoResponse>>('/api/ai/undo_last_action')
    .then((r) => normalizeResponse<UndoResponse>(r.data));
