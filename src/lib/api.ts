export interface ApiFetchOptions extends RequestInit {
  json?: any;
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

  return nativeFetch(requestInput, { ...init, headers });
}

export async function apiJson<T>(input: RequestInfo, init: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetch(input, init);
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  const isApiPath = typeof input === 'string' && input.startsWith('/api/');

  if (!res.ok) {
    if (res.status === 404 && isApiPath) {
      throw new Error(
        'API endpoint not found. If frontend is on Vercel, deploy backend routes or set VITE_API_BASE_URL to your API origin.'
      );
    }

    if (typeof data === 'string' && data.trim()) {
      throw new Error(data.slice(0, 200));
    }
    throw new Error((data as any)?.error || `HTTP ${res.status}`);
  }

  if (typeof data === 'string') {
    throw new Error(`Expected JSON response but got text (status ${res.status}).`);
  }

  return data as T;
}
