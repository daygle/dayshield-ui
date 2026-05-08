import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig, type AxiosHeaders } from 'axios'

const apiClient = axios.create({
  baseURL: '/',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  withCredentials: true,
})

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'dayshield_token'

/**
 * Persist (or remove) the JWT token in sessionStorage.
 * sessionStorage is scoped to the browser tab and is cleared when the tab
 * closes, limiting the window of exposure compared to localStorage.
 */
export function setAuthToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token)
  } else {
    sessionStorage.removeItem(TOKEN_KEY)
  }
}

/** Read the stored JWT token, or null if none. */
export function getAuthToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

// ---------------------------------------------------------------------------
// Unauthorised-logout callback
// ---------------------------------------------------------------------------

// Callback invoked on HTTP 401 – registered by AuthContext to trigger logout
let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

// ---------------------------------------------------------------------------
// Interceptors
// ---------------------------------------------------------------------------

// Attach Bearer token on every request when one is available
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAuthToken()
    if (token) {
      const headers = config.headers ?? {}
      const rawHeaders = headers as AxiosHeaders
      rawHeaders.Authorization = `Bearer ${token}`
      config.headers = rawHeaders
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

// Response interceptor for error normalisation
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<unknown>) => {
    const status = error.response?.status
    const requestUrl = (error.config?.url ?? '').toLowerCase()
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/logout') ||
      requestUrl.includes('/auth/status')

    // Only auto-logout on 401 for protected endpoints when a token exists.
    // This avoids loops/noise on intentional unauthenticated auth endpoints.
    if (status === 401 && !isAuthEndpoint && getAuthToken()) {
      unauthorizedHandler?.()
    }

    if (!error.response) {
      return Promise.reject(new Error('Network error: could not reach DayShield API'))
    }

    const responseData = error.response?.data as Record<string, unknown> | undefined
    const message =
      (responseData?.error as string | undefined) ??
      (responseData?.message as string | undefined) ?? error.message ?? 'Unknown error'
    return Promise.reject(new Error(message))
  },
)

export default apiClient
