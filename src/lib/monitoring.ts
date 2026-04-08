import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

const telemetryEndpoint = '/api/telemetry/client-error';
const telemetryWebhook = (import.meta as any).env?.VITE_ERROR_TRACKING_WEBHOOK as string | undefined;

const postClientError = (payload: Record<string, unknown>) => {
  const body = JSON.stringify(payload);

  if (telemetryWebhook) {
    void fetch(telemetryWebhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => undefined);
  }

  void fetch(telemetryEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true
  }).catch(() => undefined);
};

export const initializeFrontendMonitoring = () => {
  window.addEventListener('error', (event) => {
    postClientError({
      type: 'window.error',
      message: event.message,
      stack: event.error instanceof Error ? event.error.stack : undefined,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      url: window.location.href
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    postClientError({
      type: 'window.unhandledrejection',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      url: window.location.href
    });
  });
};

export class FrontendErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: Readonly<ErrorBoundaryProps>;
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    postClientError({
      type: 'react.error_boundary',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: window.location.href
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
