import { API_BASE } from '../utils/apiConfig';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  total?: number;
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  let basePath = API_BASE.replace(/\/+$/, '');
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Prevent duplicate '/api/api' if both basePath ends with '/api' and cleanEndpoint starts with '/api'
  if (basePath.endsWith('/api') && (cleanEndpoint.startsWith('/api/') || cleanEndpoint === '/api')) {
    cleanEndpoint = cleanEndpoint.slice(4) || '/';
  }

  const url = endpoint.startsWith('http') ? endpoint : `${basePath}${cleanEndpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Automatically send & receive HttpOnly cookies cross-origin
    headers,
  });

  const resData = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = resData?.message || `HTTP error! status: ${response.status}`;
    throw new Error(errorMsg);
  }

  return resData as ApiResponse<T>;
}
