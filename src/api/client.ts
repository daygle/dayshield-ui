import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig, type RawAxiosHeaders } from 'axios'

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

/** Persist (or remove) the JWT token in localStorage. */
export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

/** Read the stored JWT token, or null if none. */
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
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
      const rawHeaders = headers as RawAxiosHeaders
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
    if (error.response?.status === 401) {
      unauthorizedHandler?.()
    }
    const responseData = error.response?.data as Record<string, unknown> | undefined
    const message =
      (responseData?.message as string | undefined) ?? error.message ?? 'Unknown error'
    return Promise.reject(new Error(message))
  },
)

export default apiClient
