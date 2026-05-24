import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  AxiosHeaders,
} from 'axios';
import type { ApiResponse } from '../types';


function formatApiErrorMessage(rawData: unknown, fallback: string): string {
  const responseData =
    rawData !== null && typeof rawData === 'object' ? (rawData as Record<string, unknown>) : undefined;

  const primary =
    (responseData?.error as string | undefined) ??
    (responseData?.message as string | undefined) ??
    (typeof rawData === 'string' && rawData.trim().length > 0 ? rawData.trim() : undefined) ??
    fallback;

  const detailCandidates = [
    responseData?.detail,
    responseData?.details,
    responseData?.reason,
    responseData?.cause,
  ]
    .filter((candidate): candidate is string => typeof candidate === 'string')
    .map((candidate) => candidate.trim())
    .filter(Boolean);

  const detailSuffix = detailCandidates.find((detail) => !primary.includes(detail));
  const combined = detailSuffix ? `${primary}: ${detailSuffix}` : primary;

  const lower = combined.toLowerCase();
  const mentionsLegacyLeasePath = combined.includes('/run/dayshield/kea');
  const mentionsCurrentLeasePath = combined.includes('/var/lib/kea');

  if ((mentionsLegacyLeasePath || mentionsCurrentLeasePath) && lower.includes('read-only file system')) {
    return `${combined}. The backend lease database path is read-only; ensure /var/lib/kea is writable by Kea.`;
  }

  if (mentionsLegacyLeasePath && lower.includes('invalid path specified')) {
    return `${combined}. This Kea build only supports lease files under /var/lib/kea.`;
  }

  return combined;
}

const apiClient = axios.create({
  baseURL: '/',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  withCredentials: true,
});

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'dayshield_token';

let authBootstrapInProgress = false;

export function setAuthBootstrapInProgress(inProgress: boolean): void {
  authBootstrapInProgress = inProgress;
}

/**
 * Persist (or remove) the JWT token in sessionStorage.
 * sessionStorage is scoped to the browser tab and is cleared when the tab
 * closes, limiting the window of exposure compared to localStorage.
 */
export function setAuthToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

/** Read the stored JWT token, or null if none. */
export function getAuthToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Unauthorised-logout callback
// ---------------------------------------------------------------------------

// Callback invoked on HTTP 401 – registered by AuthContext to trigger logout
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

// ---------------------------------------------------------------------------
// Interceptors
// ---------------------------------------------------------------------------

// Attach Bearer token on every request when one is available
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAuthToken();
    if (token) {
      const headers = AxiosHeaders.from(config.headers);
      headers.set('Authorization', `Bearer ${token}`);
      config.headers = headers;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor for error normalisation
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const responseType = response.config.responseType;

    // Leave non-JSON payloads alone so blob downloads continue to work.
    if (responseType && responseType !== 'json') {
      return response;
    }

    const payload = response.data;
    const isEnvelope =
      payload !== null && typeof payload === 'object' && 'success' in payload && 'data' in payload;

    if (!isEnvelope) {
      response.data = {
        success: true,
        data: payload,
      } as ApiResponse<unknown>;
    }

    return response;
  },
  (error: AxiosError<unknown>) => {
    const status = error.response?.status;
    const requestUrl = (error.config?.url ?? '').toLowerCase();
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/logout') ||
      requestUrl.includes('/auth/status');

    // Only auto-logout on 401 for protected endpoints when a token exists.
    // This avoids loops/noise on intentional unauthenticated auth endpoints.
    if (status === 401 && !isAuthEndpoint && getAuthToken()) {
      if (authBootstrapInProgress) {
        // Let bootstrap finish before forcing sign-out on protected-endpoint 401s.
      } else {
        unauthorizedHandler?.();
      }
    }

    if (!error.response) {
      return Promise.reject(new Error('Network error: could not reach DayShield API'));
    }

    const rawData = error.response?.data;
    const message = formatApiErrorMessage(rawData, error.message ?? 'Unknown error');
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
