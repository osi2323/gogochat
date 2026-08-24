import axios from "axios";

type ApiErrorOptions = {
  status?: number;
  data?: unknown;
  cause?: unknown;
};

export class ApiError extends Error {
  status?: number;
  data?: unknown;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.status = options.status;
    this.data = options.data;
  }
}

export const toApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    const fallbackMessage = error.message || 'API isteği başarısız oldu';

    let message = fallbackMessage;
    if (data && typeof data === 'object') {
      const maybeMessage = (data as { message?: string }).message;
      if (maybeMessage) {
        message = maybeMessage;
      }
    }

    return new ApiError(message, { status, data, cause: error });
  }

  const message =
    error instanceof Error
      ? error.message
      : 'Beklenmeyen bir hata oluştu';

  return new ApiError(message, { cause: error });
};
