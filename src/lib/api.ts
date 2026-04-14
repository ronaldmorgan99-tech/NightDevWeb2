import { captureFrontendApiException } from './monitoring';

export interface ApiFetchOptions extends RequestInit {
  json?: any;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const nativeFetch: typeof fetch = globalThis.fetch.bind(globalThis);
const apiBaseUrl = ((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');

function resolveRequestInput(input: RequestInfo): RequestInfo {
  if (!apiBaseUrl || typeof input !== 'string') {
    return input;
  }

  if (!input.startsWith('/')) {
    return input;
  }

  return `${apiBaseUrl}${input}`;
}

const inputToString = (input: RequestInfo) => {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
};

export async function apiFetch(input: RequestInfo, init: ApiFetchOptions = {}): Promise<Response> {
  const requestInput = resolveRequestInput(input);
  const method = (init.method || 'GET').toString().toUpperCase();
  const headers = new Headers(init.headers || {});

  if (init.json !== undefined) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    init.body = JSON.stringify(init.json);
    delete init.json;
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = localStorage.getItem('csrfToken');
    if (csrfToken && !headers.has('x-csrf-token')) {
      headers.set('x-csrf-token', csrfToken);
    }
  }

  const startedAt = performance.now();
  try {
    const response = await nativeFetch(requestInput, { ...init, headers });

    if (!response.ok && response.status >= 500) {
      captureFrontendApiException({
        input: inputToString(requestInput),
        method,
        status: response.status,
        message: `API request failed with status ${response.status}`,
        durationMs: Number((performance.now() - startedAt).toFixed(2))
      });
    }

    return response;
  } catch (error) {
    captureFrontendApiException({
      input: inputToString(requestInput),
      method,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Number((performance.now() - startedAt).toFixed(2))
    });
    throw error;
  }
}

export async function apiJson<T>(input: RequestInfo, init: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetch(input, init);
  if (res.status === 204 || res.status === 205 || res.headers.get('content-length') === '0') {
    if (!res.ok) {
      throw new ApiError(res.status, `HTTP ${res.status}`);
    }
    return null as T;
  }

  const rawBody = await res.text();
  const hasBody = rawBody.trim().length > 0;
  const contentType = res.headers.get('content-type') || '';
  const shouldParseJson = contentType.includes('application/json') && hasBody;
  const data = shouldParseJson ? JSON.parse(rawBody) : rawBody;

  if (!res.ok) {
    if (typeof data === 'string' && data.trim()) {
      throw new ApiError(res.status, data.slice(0, 200));
    }
    throw new ApiError(res.status, (data as any)?.error || `HTTP ${res.status}`);
  }

  if (!hasBody) {
    return null as T;
  }

  if (typeof data === 'string') {
    throw new Error(`Expected JSON response but got text (status ${res.status}).`);
  }

  return data as T;
}
