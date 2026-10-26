import { err, ok, type ParseResult } from "./result";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(record: Record<string, unknown>, key: string): ParseResult<string> {
  if (!Object.hasOwn(record, key)) return err(`Missing ${key}.`);
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    return err(`${key} must be a non-empty string.`);
  }
  return ok(value);
}

export function readInt(record: Record<string, unknown>, key: string): ParseResult<number> {
  if (!Object.hasOwn(record, key)) return err(`Missing ${key}.`);
  return asCount(record[key], key);
}

export function asCount(value: unknown, label: string): ParseResult<number> {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return err(`${label} must be a non-negative integer.`);
  }
  if (value > 1_000_000_000) return err(`${label} is too large.`);
  return ok(value);
}

export function readRecord(record: Record<string, unknown>, key: string): ParseResult<Record<string, unknown>> {
  if (!Object.hasOwn(record, key)) return err(`Missing ${key}.`);
  const value = record[key];
  if (!isRecord(value)) return err(`${key} must be an object.`);
  return ok(value);
}

export function readStringList(record: Record<string, unknown>, key: string, maxItems: number): ParseResult<readonly string[]> {
  if (!Object.hasOwn(record, key)) return err(`Missing ${key}.`);
  const value = record[key];
  if (!Array.isArray(value)) return err(`${key} must be an array.`);
  if (value.length > maxItems) return err(`${key} has too many entries.`);
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0 || item.length > 500) {
      return err(`${key} must contain short non-empty strings.`);
    }
    items.push(item);
  }
  return ok(items);
}

export function sumNestedCounts(value: unknown, depth: number): ParseResult<number> {
  if (typeof value === "number") return asCount(value, "count");
  if (!isRecord(value)) return err("A count group must be an object.");
  if (depth > 4) return err("A count group is nested too deeply.");
  let total = 0;
  for (const child of Object.values(value)) {
    const parsed = sumNestedCounts(child, depth + 1);
    if (parsed.kind === "error") return parsed;
    total += parsed.value;
  }
  return ok(total);
}

export function parseJsonText(text: string): ParseResult<unknown> {
  try {
    const value: unknown = JSON.parse(text);
    return ok(value);
  } catch {
    return err("The file is not valid JSON.");
  }
}
