export type Category = string;

export type Mode = 'Online' | 'Cash' | 'Card';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  message?: string;
  errorCode?: string;
  suggestion?: string;
  requestId?: string;
  details?: unknown;
  fieldErrors?: Record<string, string[]>;
}
