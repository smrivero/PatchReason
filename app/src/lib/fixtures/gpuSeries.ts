import type { GpuSample, GpuSeries } from "../../types/domain";

function fixtureSample(step: number): GpuSample {
  return {
    timestampText: `fixture-step-${String(step).padStart(2, "0")}`,
    gpuName: "Fixture GPU, not collected",
    utilizationPercent: 15,
    memoryUtilizationPercent: 10,
    vramUsedMiB: 128,
    vramTotalMiB: 1000,
    powerWatts: 20,
    temperatureC: 40,
  };
}

export function illustrativeGpuSeries(): GpuSeries {
  const first = fixtureSample(1);
  const rest: GpuSample[] = [];
  for (let step = 2; step <= 12; step += 1) {
    rest.push(fixtureSample(step));
  }
  return {
    origin: { kind: "fixture" },
    sourceLabel: "Illustrative fixture / no GPU collection",
    gpuModel: "Fixture GPU, not collected",
    samples: [first, ...rest],
    skippedRowCount: 0,
  };
}
