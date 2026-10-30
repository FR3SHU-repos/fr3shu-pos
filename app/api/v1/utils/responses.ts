// Standard API response envelope used by every /api/v1 route.

import type { ApiFailureResponse, ApiSuccessResponse, PageMeta } from "@/shared/lib/api/types";

export type { ApiFailureResponse, ApiSuccessResponse, PageMeta };

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
