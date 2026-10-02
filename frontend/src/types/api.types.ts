export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  total?: number;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
}
