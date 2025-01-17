export type ErrorAware<T> = { error: string; context?: string } | T;
export type SearchResult<T> = ErrorAware<{ found: false } | { found: true; result: T }>;
