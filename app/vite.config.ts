import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function readRepoJson(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const binaryManifest = readRepoJson("../results/data_intake/js_binary_manifest.json");
const candidateSummary = readRepoJson("../results/data_intake/candidate_review_summary.json");
const intakeAudit = readRepoJson("../results/data_intake/audit.json");
const sequenceBudget = readRepoJson("../results/data_intake/sequence_budget_2048.json");
const nemoReadiness = readRepoJson("../results/data_intake/nemo_data_readiness.json");
const loraCandidate = readRepoJson("../config/nemo/qwen35_27b_b200_lora_candidate.yaml");

export default defineConfig({
  plugins: [react()],
  define: {
    __PATCHREASON_BINARY_MANIFEST__: JSON.stringify(binaryManifest),
    __PATCHREASON_CANDIDATE_SUMMARY__: JSON.stringify(candidateSummary),
    __PATCHREASON_INTAKE_AUDIT__: JSON.stringify(intakeAudit),
    __PATCHREASON_SEQUENCE_BUDGET__: JSON.stringify(sequenceBudget),
    __PATCHREASON_NEMO_READINESS__: JSON.stringify(nemoReadiness),
    __PATCHREASON_LORA_CANDIDATE__: JSON.stringify(loraCandidate),
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});
