import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { DisplayPreferencesProvider } from './context/DisplayPreferencesContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import ToastContainer from './components/Toast.tsx';
import './index.css';
import { ingestUiLog } from './api/logs';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 4000,
    },
  },
});

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
  </React.StrictMode>
);

// Global error handlers: best-effort POSTs to the backend so UI errors are
// available in the live logs stream.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (ev: ErrorEvent) => {
    try {
      const err = ev.error as Error | undefined;
      void ingestUiLog({
        component: 'window',
        level: 'error',
        message: err?.message ?? ev.message ?? 'Uncaught error',
        stack: err?.stack,
        url: window.location.href,
        route: window.location.pathname,
      });
    } catch {
      // ignore
    }
  });

  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
    try {
      const reason =
        ev.reason != null && typeof ev.reason === 'object'
          ? (ev.reason as { message?: string; stack?: string })
          : null;
      void ingestUiLog({
        component: 'window',
        level: 'error',
        message: reason?.message ?? (typeof ev.reason === 'string' ? ev.reason : 'Unhandled rejection'),
        stack: reason?.stack,
        url: window.location.href,
        route: window.location.pathname,
      });
    } catch {
      // ignore
    }
  });
}
