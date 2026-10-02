import { API_BASE } from '../utils/apiConfig';
import type { ApiResponse, ApiErrorResponse } from '../types/api.types';

export type { ApiResponse, ApiErrorResponse };

/**
 * Custom Error class with HTTP status code and response payload details
 */
export class ApiError extends Error {
  public statusCode: number;
  public details?: unknown;
  public code?: string;

  constructor(message: string, statusCode: number, details?: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
  }
}

/**
 * Resolves the final absolute/relative API URL without duplicate `/api` prefixes.
 */
export function resolveApiUrl(endpoint: string, base: string = API_BASE): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Prevent duplicate '/api/api' if both base ends with '/api' and cleanPath starts with '/api/'
  if (cleanBase.endsWith('/api') && (cleanPath.startsWith('/api/') || cleanPath === '/api')) {
    return `${cleanBase}${cleanPath.slice(4) || '/'}`;
  }

  return `${cleanBase}${cleanPath}`;
}

/**
 * Helper to safely serialize request bodies and manage Content-Type headers
 */
function serializeRequestBody(
  body: unknown,
  headers: Record<string, string>
): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  // Already a string (e.g., JSON.stringify called beforehand)
  if (typeof body === 'string') {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    return body;
  }

  // FormData: let browser automatically set multipart boundary
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    delete headers['Content-Type'];
    return body;
  }

  // Binary/Blob/URLSearchParams
  if (
    (typeof Blob !== 'undefined' && body instanceof Blob) ||
    (typeof ArrayBuffer !== 'undefined' && (body instanceof ArrayBuffer || ArrayBuffer.isView(body))) ||
    (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams)
  ) {
    return body as BodyInit;
  }

  // Standard JSON object/array
  if (!headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return JSON.stringify(body);
}

/**
 * Core HTTP fetch wrapper with automatic base URL resolution,
 * symmetric JSON/FormData serialization, and credentials inclusion for HttpOnly cookies.
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  let body = options.body;
  if (body !== undefined && typeof body !== 'string' && !(body instanceof FormData) && !(body instanceof Blob)) {
    body = serializeRequestBody(body, headers);
  } else if (!headers['Content-Type'] && typeof body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const url = resolveApiUrl(endpoint);

  const response = await fetch(url, {
    ...options,
    body,
    credentials: 'include', // Automatically send & receive HttpOnly cookies cross-origin
    headers,
  });

  const resData = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = resData?.message || `HTTP error! status: ${response.status}`;
    throw new ApiError(errorMsg, response.status, resData?.details, resData?.code);
  }

  return resData as ApiResponse<T>;
}

/**
 * Convenient, strictly-typed REST HTTP client methods with full symmetry:
 * - get<TResponse>(url, options)
 * - post<TResponse, TBody>(url, body, options)
 * - put<TResponse, TBody>(url, body, options)
 * - patch<TResponse, TBody>(url, body, options)
 * - delete<TResponse>(url, options)
 */
export const api = {
  get: <TResponse = any>(endpoint: string, options?: RequestInit): Promise<ApiResponse<TResponse>> =>
    apiFetch<TResponse>(endpoint, { ...options, method: 'GET' }),

  post: <TResponse = any, TBody = unknown>(
    endpoint: string,
    body?: TBody,
    options?: RequestInit
  ): Promise<ApiResponse<TResponse>> => {
    const headers: Record<string, string> = {
      ...((options?.headers as Record<string, string>) || {}),
    };
    const serializedBody = serializeRequestBody(body, headers);

    return apiFetch<TResponse>(endpoint, {
      ...options,
      headers,
      method: 'POST',
      body: serializedBody,
    });
  },

  put: <TResponse = any, TBody = unknown>(
    endpoint: string,
    body?: TBody,
    options?: RequestInit
  ): Promise<ApiResponse<TResponse>> => {
    const headers: Record<string, string> = {
      ...((options?.headers as Record<string, string>) || {}),
    };
    const serializedBody = serializeRequestBody(body, headers);

    return apiFetch<TResponse>(endpoint, {
      ...options,
      headers,
      method: 'PUT',
      body: serializedBody,
    });
  },

  patch: <TResponse = any, TBody = unknown>(
    endpoint: string,
    body?: TBody,
    options?: RequestInit
  ): Promise<ApiResponse<TResponse>> => {
    const headers: Record<string, string> = {
      ...((options?.headers as Record<string, string>) || {}),
    };
    const serializedBody = serializeRequestBody(body, headers);

    return apiFetch<TResponse>(endpoint, {
      ...options,
      headers,
      method: 'PATCH',
      body: serializedBody,
    });
  },

  delete: <TResponse = any>(endpoint: string, options?: RequestInit): Promise<ApiResponse<TResponse>> =>
    apiFetch<TResponse>(endpoint, { ...options, method: 'DELETE' }),
};
