import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

type ExceptionContext = Record<string, unknown>;

type ApiExceptionPayload = {
  input: string;
  method: string;
  status?: number;
  message: string;
  durationMs?: number;
};

const telemetryEndpoint = '/api/telemetry/client-error';
const telemetryWebhook = (import.meta as any).env?.VITE_ERROR_TRACKING_WEBHOOK as string | undefined;

const postClientError = (payload: Record<string, unknown>) => {
  const body = JSON.stringify({
    timestamp: new Date().toISOString(),
    route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    ...payload
  });

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

export const captureFrontendException = (error: unknown, context: ExceptionContext = {}) => {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  postClientError({
    type: 'frontend.exception',
    message: normalizedError.message,
    stack: normalizedError.stack,
    context,
    url: typeof window !== 'undefined' ? window.location.href : undefined
  });
};

export const captureFrontendApiException = ({ input, method, status, message, durationMs }: ApiExceptionPayload) => {
  postClientError({
    type: 'frontend.api_exception',
    request: {
      input,
      method,
      status,
      durationMs
    },
    message,
    url: typeof window !== 'undefined' ? window.location.href : undefined
  });
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
    captureFrontendException(error, {
      type: 'react.error_boundary',
      componentStack: errorInfo.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
