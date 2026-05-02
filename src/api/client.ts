import axios from 'axios'

const apiClient = axios.create({
  baseURL: 'http://localhost:8080/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  withCredentials: true,
})

// Callback invoked on HTTP 401 – registered by AuthContext to trigger logout
let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

// Request interceptor (extend for auth headers as needed)
apiClient.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error),
)

// Response interceptor for error normalisation
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      unauthorizedHandler?.()
    }
    const message =
      error.response?.data?.message ?? error.message ?? 'Unknown error'
    return Promise.reject(new Error(message))
  },
)

export default apiClient
