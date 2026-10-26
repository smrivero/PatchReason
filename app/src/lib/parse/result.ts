export type ParseResult<T> =
  | { kind: "ok"; value: T }
  | { kind: "error"; message: string };

export function ok<T>(value: T): ParseResult<T> {
  return { kind: "ok", value };
}

export function err(message: string): ParseResult<never> {
  return { kind: "error", message };
}
