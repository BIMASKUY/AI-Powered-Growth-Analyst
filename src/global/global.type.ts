export interface Result<T> {
  data: T | null;
  error: string | null;
}
