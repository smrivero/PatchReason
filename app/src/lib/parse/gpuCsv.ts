import type { GpuSample, GpuSeries, NonEmpty } from "../../types/domain";
import { err, ok, type ParseResult } from "./result";
import { isRecord } from "./guards";

const REQUIRED_COLUMNS = [
  "timestamp",
  "name",
  "utilization.gpu",
  "utilization.memory",
  "memory.used",
  "memory.total",
  "temperature.gpu",
  "power.draw",
] as const;

type RequiredColumn = (typeof REQUIRED_COLUMNS)[number];

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(cell: string): string {
  return cell.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s*\[.*$/, "").trim();
}

function parseMeasurement(cell: string): number | null {
  const match = cell.match(/-?\d+(?:\.\d+)?/);
  if (match === null) return null;
  const value = Number(match[0]);
  if (!Number.isFinite(value)) return null;
  return value;
}

function inRange(value: number, minimum: number, maximum: number): boolean {
  return value >= minimum && value <= maximum;
}

function columnIndex(headers: readonly string[], name: RequiredColumn): number {
  return headers.indexOf(name);
}

function toSeries(samples: readonly GpuSample[]): ParseResult<NonEmpty<GpuSample>> {
  const first = samples[0];
  if (first === undefined) return err("The CSV has no usable samples.");
  return ok([first, ...samples.slice(1)]);
}

export function parseGpuCsv(text: string, fileName: string): ParseResult<GpuSeries> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headerLine = lines[0];
  if (headerLine === undefined) return err("The CSV is empty.");
  const headers = splitCsvLine(headerLine).map(normalizeHeader);
  const indexes = new Map<RequiredColumn, number>();
  for (const column of REQUIRED_COLUMNS) {
    const index = columnIndex(headers, column);
    if (index < 0) return err(`The CSV is missing the ${column} column.`);
    indexes.set(column, index);
  }
  const samples: GpuSample[] = [];
  let skippedRowCount = 0;
  const names = new Set<string>();
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const sample = readSample(cells, indexes);
    if (sample === null) {
      skippedRowCount += 1;
      continue;
    }
    names.add(sample.gpuName);
    samples.push(sample);
  }
  if (names.size > 1) return err("The CSV contains more than one GPU name.");
  const packed = toSeries(samples);
  if (packed.kind === "error") {
    return err(`The CSV has no usable samples. Skipped rows: ${String(skippedRowCount)}.`);
  }
  const gpuModel = packed.value[0].gpuName;
  return ok({
    origin: { kind: "csv", fileName },
    sourceLabel: fileName,
    gpuModel,
    samples: packed.value,
    skippedRowCount,
  });
}

function cellAt(cells: readonly string[], indexes: ReadonlyMap<RequiredColumn, number>, column: RequiredColumn): string | null {
  const index = indexes.get(column);
  if (index === undefined) return null;
  const value = cells[index];
  if (value === undefined || value.length === 0) return null;
  return value;
}

function readSample(cells: readonly string[], indexes: ReadonlyMap<RequiredColumn, number>): GpuSample | null {
  const timestampText = cellAt(cells, indexes, "timestamp");
  const gpuName = cellAt(cells, indexes, "name");
  const utilizationText = cellAt(cells, indexes, "utilization.gpu");
  const memoryUtilizationText = cellAt(cells, indexes, "utilization.memory");
  const usedText = cellAt(cells, indexes, "memory.used");
  const totalText = cellAt(cells, indexes, "memory.total");
  const temperatureText = cellAt(cells, indexes, "temperature.gpu");
  const powerText = cellAt(cells, indexes, "power.draw");
  if (
    timestampText === null ||
    gpuName === null ||
    utilizationText === null ||
    memoryUtilizationText === null ||
    usedText === null ||
    totalText === null ||
    temperatureText === null ||
    powerText === null
  ) {
    return null;
  }
  const utilizationPercent = parseMeasurement(utilizationText);
  const memoryUtilizationPercent = parseMeasurement(memoryUtilizationText);
  const vramUsedMiB = parseMeasurement(usedText);
  const vramTotalMiB = parseMeasurement(totalText);
  const temperatureC = parseMeasurement(temperatureText);
  const powerWatts = parseMeasurement(powerText);
  if (
    utilizationPercent === null ||
    memoryUtilizationPercent === null ||
    vramUsedMiB === null ||
    vramTotalMiB === null ||
    temperatureC === null ||
    powerWatts === null
  ) {
    return null;
  }
  if (!inRange(utilizationPercent, 0, 100) || !inRange(memoryUtilizationPercent, 0, 100)) return null;
  if (!inRange(vramUsedMiB, 0, 10_000_000) || !inRange(vramTotalMiB, 1, 10_000_000)) return null;
  if (vramUsedMiB > vramTotalMiB) return null;
  if (!inRange(temperatureC, -20, 120) || !inRange(powerWatts, 0, 5000)) return null;
  if (timestampText.length > 80 || gpuName.length > 120) return null;
  return {
    timestampText,
    gpuName,
    utilizationPercent,
    memoryUtilizationPercent,
    vramUsedMiB,
    vramTotalMiB,
    powerWatts,
    temperatureC,
  };
}

export function serializeGpuCsv(series: GpuSeries): string {
  const header = "timestamp, name, uuid, utilization.gpu [%], utilization.memory [%], memory.used [MiB], memory.total [MiB], temperature.gpu, power.draw [W]";
  const rows = series.samples.map((sample) =>
    [
      sample.timestampText,
      sample.gpuName,
      "not-recorded",
      `${String(sample.utilizationPercent)} %`,
      `${String(sample.memoryUtilizationPercent)} %`,
      `${String(sample.vramUsedMiB)} MiB`,
      `${String(sample.vramTotalMiB)} MiB`,
      String(sample.temperatureC),
      `${String(sample.powerWatts)} W`,
    ].join(", "),
  );
  return [header, ...rows].join("\n");
}

export function parseGpuDocument(value: unknown, runId: string): ParseResult<GpuSeries> | { kind: "empty" } {
  if (!isRecord(value)) return err("The telemetry payload must be a JSON object.");
  if (value.kind === "empty") return { kind: "empty" };
  if (value.schema !== "patchreason.gpu.v1") {
    return err("Expected schema patchreason.gpu.v1 or kind empty.");
  }
  if (value.collection !== "measured") {
    return err("The gateway payload is not marked collection measured.");
  }
  const sourceLabel = value.source;
  const gpuModel = value.gpuModel;
  if (typeof sourceLabel !== "string" || sourceLabel.trim().length === 0) return err("Missing source.");
  if (typeof gpuModel !== "string" || gpuModel.trim().length === 0) return err("Missing gpuModel.");
  if (!Array.isArray(value.samples)) return err("samples must be an array.");
  const samples: GpuSample[] = [];
  for (const item of value.samples) {
    const sample = readJsonSample(item);
    if (sample.kind === "error") return sample;
    if (sample.value.gpuName !== gpuModel) return err("A sample name does not match gpuModel.");
    samples.push(sample.value);
  }
  const packed = toSeries(samples);
  if (packed.kind === "error") return packed;
  return ok({
    origin: { kind: "api", runId },
    sourceLabel,
    gpuModel,
    samples: packed.value,
    skippedRowCount: 0,
  });
}

function readJsonSample(value: unknown): ParseResult<GpuSample> {
  if (!isRecord(value)) return err("A GPU sample must be an object.");
  const timestampText = readText(value, "timestampText");
  const gpuName = readText(value, "gpuName");
  if (timestampText.kind === "error") return timestampText;
  if (gpuName.kind === "error") return gpuName;
  const utilizationPercent = readBounded(value, "utilizationPercent", 0, 100);
  const memoryUtilizationPercent = readBounded(value, "memoryUtilizationPercent", 0, 100);
  const vramUsedMiB = readBounded(value, "vramUsedMiB", 0, 10_000_000);
  const vramTotalMiB = readBounded(value, "vramTotalMiB", 1, 10_000_000);
  const temperatureC = readBounded(value, "temperatureC", -20, 120);
  const powerWatts = readBounded(value, "powerWatts", 0, 5000);
  if (utilizationPercent.kind === "error") return utilizationPercent;
  if (memoryUtilizationPercent.kind === "error") return memoryUtilizationPercent;
  if (vramUsedMiB.kind === "error") return vramUsedMiB;
  if (vramTotalMiB.kind === "error") return vramTotalMiB;
  if (temperatureC.kind === "error") return temperatureC;
  if (powerWatts.kind === "error") return powerWatts;
  if (vramUsedMiB.value > vramTotalMiB.value) return err("vramUsedMiB exceeds vramTotalMiB.");
  return ok({
    timestampText: timestampText.value,
    gpuName: gpuName.value,
    utilizationPercent: utilizationPercent.value,
    memoryUtilizationPercent: memoryUtilizationPercent.value,
    vramUsedMiB: vramUsedMiB.value,
    vramTotalMiB: vramTotalMiB.value,
    powerWatts: powerWatts.value,
    temperatureC: temperatureC.value,
  });
}

function readText(record: Record<string, unknown>, key: string): ParseResult<string> {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 120) {
    return err(`${key} must be a short string.`);
  }
  return ok(value);
}

function readBounded(record: Record<string, unknown>, key: string, minimum: number, maximum: number): ParseResult<number> {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || !inRange(value, minimum, maximum)) {
    return err(`${key} is outside the accepted range.`);
  }
  return ok(value);
}
