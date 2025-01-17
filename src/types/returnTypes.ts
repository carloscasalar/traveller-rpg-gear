export type ErrorAware<T> = { error: string } | T;
export type SearchResult<T> = ErrorAware<{ found: false } | { found: true; result: T }>;
