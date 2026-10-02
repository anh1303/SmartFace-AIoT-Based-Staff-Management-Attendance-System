export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown, code = 'BAD_REQUEST'): AppError {
    return new AppError(400, message, details, code);
  }

  static unauthorized(message = 'Yêu cầu đăng nhập hoặc phiên làm việc đã hết hạn', details?: unknown, code = 'UNAUTHORIZED'): AppError {
    return new AppError(401, message, details, code);
  }

  static forbidden(message = 'Bạn không có quyền thực hiện thao tác này', details?: unknown, code = 'FORBIDDEN'): AppError {
    return new AppError(403, message, details, code);
  }

  static notFound(message = 'Không tìm thấy tài nguyên yêu cầu', details?: unknown, code = 'NOT_FOUND'): AppError {
    return new AppError(404, message, details, code);
  }

  static conflict(message: string, details?: unknown, code = 'CONFLICT'): AppError {
    return new AppError(409, message, details, code);
  }

  static unprocessable(message: string, details?: unknown, code = 'UNPROCESSABLE_ENTITY'): AppError {
    return new AppError(422, message, details, code);
  }

  static internal(message = 'Lỗi hệ thống nội bộ', details?: unknown, code = 'INTERNAL_SERVER_ERROR'): AppError {
    return new AppError(500, message, details, code);
  }
}