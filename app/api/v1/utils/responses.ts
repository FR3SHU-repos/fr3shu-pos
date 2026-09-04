// Standard API response envelope used by every /api/v1 route.

export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiFailureResponse<E = string> {
  success: false;
  message: string;
  error?: E;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function success<T>(data: T, message = "Success"): ApiSuccessResponse<T> {
  return { success: true, message, data };
}

export function failure<E = string>(
  message = "Something went wrong",
  error?: E,
): ApiFailureResponse<E> {
  return {
    success: false,
    message,
    error: process.env.NODE_ENV === "development" ? error : undefined,
  };
}

export function pageMeta(total: number, page: number, limit: number): PageMeta {
  return { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
