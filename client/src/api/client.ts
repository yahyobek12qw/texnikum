import type { ApiErrorBody } from '@uchkoprik/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let csrfToken: string | null = null;
export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  onUnauthorized = fn;
}

export type Query = Record<string, string | number | boolean | undefined | null>;

export function withQuery(url: string, query?: Query): string {
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
  query?: Query;
  signal?: AbortSignal;
}

export async function api<T>(url: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  let res: Response;
  try {
    res = await fetch(withQuery(url, opts.query), { method, headers, body, credentials: 'same-origin', signal: opts.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Server bilan aloqa o‘rnatib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.');
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    const apiErr = new ApiError(res.status, err?.code ?? 'HTTP_ERROR', err?.message ?? `Xatolik (${res.status})`, err?.details);
    if (res.status === 401 && url.includes('/admin/') && !url.includes('/auth/login')) onUnauthorized?.();
    throw apiErr;
  }
  return data as T;
}

export const get = <T,>(url: string, query?: Query, signal?: AbortSignal) => api<T>(url, { query, signal });
export const post = <T,>(url: string, body?: unknown) => api<T>(url, { method: 'POST', body });
export const put = <T,>(url: string, body?: unknown) => api<T>(url, { method: 'PUT', body });
export const patch = <T,>(url: string, body?: unknown) => api<T>(url, { method: 'PATCH', body });
export const del = <T = void,>(url: string, query?: Query) => api<T>(url, { method: 'DELETE', query });
export const upload = <T,>(url: string, file: File, query?: Query) => {
  const form = new FormData();
  form.append('file', file);
  return api<T>(url, { method: 'POST', form, query });
};

/**
 * Katta fayl yuklash (video): fetch yuklash jarayonini ko'rsata olmaydi, shuning uchun XMLHttpRequest.
 * `signal` bilan bekor qilinadi. Xatolik formati `api()` bilan bir xil (ApiError).
 */
export function uploadWithProgress<T>(url: string, file: File, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK_ERROR', 'Yuklash uzildi. Internetni tekshirib, qayta urinib ko‘ring.'));
    xhr.onabort = () => reject(new DOMException('Bekor qilindi', 'AbortError'));
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data as T);
      const err = (data as ApiErrorBody | null)?.error;
      if (xhr.status === 401) onUnauthorized?.();
      reject(new ApiError(xhr.status, err?.code ?? 'HTTP_ERROR', err?.message ?? `Xatolik (${xhr.status})`, err?.details));
    };
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}
