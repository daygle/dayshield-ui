import React from 'react';
import { ingestUiLog } from '../api/logs';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(error, errorInfo);

    try {
      void ingestUiLog({
        component: 'error-boundary',
        level: 'error',
        message: error?.message ?? String(error),
        stack: errorInfo?.componentStack ?? undefined,
        route: typeof window !== 'undefined' ? window.location.pathname : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      });
    } catch {
      // swallow - best-effort reporting only
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {this.props.fallbackMessage ?? 'Something went wrong while rendering this page.'}
        </div>
      );
    }

    return this.props.children;
  }
}
