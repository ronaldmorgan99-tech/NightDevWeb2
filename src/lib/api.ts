export interface ApiFetchOptions extends RequestInit {
  json?: any;
}

export async function apiFetch(input: RequestInfo, init: ApiFetchOptions = {}): Promise<Response> {
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

  return window.fetch(input, { ...init, headers });
}

export async function apiJson<T>(input: RequestInfo, init: ApiFetchOptions = {}): Promise<T> {
  const res = await apiFetch(input, init);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data as T;
}
