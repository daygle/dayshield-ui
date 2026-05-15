import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { DisplayPreferencesProvider } from './context/DisplayPreferencesContext.tsx'
import { ToastProvider } from './context/ToastContext.tsx'
import ToastContainer from './components/Toast.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 4000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <DisplayPreferencesProvider>
          <AuthProvider>
            <App />
            <ToastContainer />
          </AuthProvider>
        </DisplayPreferencesProvider>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)

