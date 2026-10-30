// Wire types shared by the browser API client (shared/lib/api) and the
// /api/v1 route handlers (app/api/v1). Keep this file dependency-free so both
// sides can import it without shared code depending on a route folder.

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
