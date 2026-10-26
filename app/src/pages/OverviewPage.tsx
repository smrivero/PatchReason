import { ChevronRight, Cpu, Database, FileSearch, Layers } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { datasetFacts } from "../lib/parse/facts";
import { formatCount, readableStatus } from "../lib/format";
import { catalogModels, jetsonLiveLabel, jetsonModelId } from "../lib/models/catalog";
import { usePageTitle } from "../hooks/usePageTitle";
import { useWorkspace } from "../hooks/useWorkspace";
import { PartitionBars } from "../components/charts/SimpleCharts";
import { PageHeader } from "../components/layout/PageHeader";
import { Callout } from "../components/status/Callout";
import { StatusChip } from "../components/status/StatusChip";
import type { BinaryDatasetFacts, ClassCounts, LoraCandidateFacts, SplitCounts } from "../types/domain";

const stageIcons = [Database, Cpu, Layers, FileSearch] as const;

function splitLabel(key: keyof SplitCounts): string {
  if (key === "test") return "Held-out evaluation";
  if (key === "validation") return "Validation";
  return "Train";
}

function DatasetTable({ binary }: { binary: BinaryDatasetFacts }) {
  const keys: readonly (keyof SplitCounts)[] = ["train", "validation", "test"];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="text-mute">
            <th className="px-2 py-2 font-medium">Split</th>
            <th className="px-2 py-2 font-medium">Source rows</th>
            <th className="px-2 py-2 font-medium">After length filters</th>
            <th className="px-2 py-2 font-medium">Selected</th>
            <th className="px-2 py-2 font-medium">Vulnerable label</th>
            <th className="px-2 py-2 font-medium">Safe label</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const labels: ClassCounts = binary.labels[key];
            return (
              <tr key={key} className="border-t border-line">
                <th className="px-2 py-2 font-medium">
                  {splitLabel(key)}
                  <span className="mt-1 block text-xs font-normal text-mute">Manifest field {key}</span>
                </th>
                <td className="px-2 py-2 tabular-nums">{formatCount(binary.sourceCounts[key])}</td>
                <td className="px-2 py-2 tabular-nums">{formatCount(binary.afterStructuralFilters[key])}</td>
                <td className="px-2 py-2 tabular-nums">{formatCount(binary.selectedCounts[key])}</td>
                <td className="px-2 py-2 tabular-nums">{formatCount(labels.vulnerable)}</td>
                <td className="px-2 py-2 tabular-nums">{formatCount(labels.safe)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KpiCard({ label, value, detail }: { label: string; value: string; detail?: ReactNode }) {
  return (
    <article className="panel">
      <p className="text-xs font-medium text-mute">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-paper">{value}</p>
      {detail ? <div className="mt-3">{detail}</div> : null}
    </article>
  );
}

export function OverviewPage() {
  usePageTitle("Overview");
  const { gateway, refreshGateway } = useWorkspace();
  const facts = datasetFacts.kind === "ready" ? datasetFacts.facts : null;
  const binary = facts === null ? null : facts.binary;
  const budget = facts === null ? null : facts.sequenceBudget;

  return (
    <div className="space-y-6">
      <PageHeader
        title="PatchReason"
        lede="Security-focused AI code review, powered by Qwen3.5 and NVIDIA NeMo."
        actions={
          <button type="button" className="btn" onClick={refreshGateway}>
            Check gateway
          </button>
        }
      />
      {gateway.kind === "offline" || gateway.kind === "invalid" ? <GatewayCopy /> : null}
      {binary === null || budget === null || facts === null ? (
        <Callout tone="error">{datasetFacts.kind === "error" ? datasetFacts.message : "Manifest unavailable."}</Callout>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Original training records"
            value={formatCount(budget.train.original)}
            detail={<p className="text-xs text-mute">Selected before the token budget of {formatCount(budget.maxSequenceTokens)}</p>}
          />
          <KpiCard
            label="Training records within budget"
            value={formatCount(budget.train.retained)}
            detail={<p className="text-xs text-mute">{formatCount(budget.train.excludedOverBudget)} excluded over the token budget</p>}
          />
          <KpiCard
            label="Validation records within budget"
            value={formatCount(budget.validation.retained)}
            detail={
              <p className="text-xs text-mute">
                {formatCount(budget.validation.original)} selected, {formatCount(budget.validation.excludedOverBudget)} excluded
              </p>
            }
          />
          <KpiCard
            label="Held-out evaluation records"
            value={formatCount(facts.nemoReadiness.test.records)}
            detail={
              <p className="text-xs text-mute">
                {budget.heldOutTestInspected ? "Included in the token-budget inspection" : "Not passed through the token-budget filter"}
              </p>
            }
          />
        </section>
      )}
      <section id="architecture" data-testid="architecture-strip">
        <h2 className="text-sm font-semibold text-paper">Model pipeline</h2>
        <ol className="mt-3 grid gap-3 lg:grid-cols-4">
          <PipelineCard index={0} title="Source data" body="Records stay in their upstream splits. The B200 set is the same selection after the token budget." />
          <PipelineCard index={1} title="Qwen3.5-27B" body="The model card is selected. No local weight revision is recorded." />
          <PipelineCard index={2} title="NVIDIA NeMo LoRA" body="">
            {facts === null ? (
              <p className="mt-1 text-xs leading-5 text-mute">The candidate configuration could not be read.</p>
            ) : (
              <LoraStatus candidate={facts.loraCandidate} />
            )}
          </PipelineCard>
          <PipelineCard
            index={3}
            title="Code review"
            body="Sample code stays labeled as a reference annotation. A Jetson response appears only after Review code runs."
          />
        </ol>
      </section>
      <section id="dataset-counts" className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <article className="panel">
          <h2 className="text-sm font-semibold">Vulnerable and safe labels by partition</h2>
          <p className="mt-1 text-xs leading-5 text-mute">
            Original selected records. These are upstream labels, not PatchReason adjudications.
          </p>
          {binary === null || budget === null ? (
            <p className="mt-4 text-sm text-mute">Counts stay hidden until the manifest parses.</p>
          ) : (
            <>
              <PartitionBars
                rows={[
                  { label: "Train", vulnerable: binary.labels.train.vulnerable, safe: binary.labels.train.safe },
                  { label: "Validation", vulnerable: binary.labels.validation.vulnerable, safe: binary.labels.validation.safe },
                  { label: "Held-out", vulnerable: binary.labels.test.vulnerable, safe: binary.labels.test.safe },
                ]}
              />
              <p className="text-xs leading-5 text-mute">
                After the token budget of {formatCount(budget.maxSequenceTokens)}, training keeps{" "}
                {formatCount(budget.train.retainedLabels.vulnerable)} vulnerable and {formatCount(budget.train.retainedLabels.safe)} safe
                labels. Validation keeps {formatCount(budget.validation.retainedLabels.vulnerable)} vulnerable and{" "}
                {formatCount(budget.validation.retainedLabels.safe)} safe labels.
              </p>
            </>
          )}
        </article>
        <article className="panel space-y-3">
          <h2 className="text-sm font-semibold">Provenance</h2>
          {binary === null ? (
            <p className="text-sm text-mute">Source revision is unavailable.</p>
          ) : (
            <>
              <p className="text-sm">sijjeel/js-vuln-dataset</p>
              <p className="break-all font-mono text-xs text-mute">{binary.sourceRevision}</p>
              <p className="text-xs text-mute">Created {binary.createdAtUtc}</p>
              <StatusChip tone="pending">{readableStatus(binary.trainingAdmission)}</StatusChip>
              <p>
                <a className="text-sm text-accentText" href={binary.sourceUrl} rel="noreferrer" target="_blank">
                  Source record
                </a>
              </p>
            </>
          )}
        </article>
      </section>
      <details className="panel">
        <summary className="cursor-pointer text-sm font-medium">Manifest, intake, and gateway details</summary>
        <div className="mt-4 space-y-4">
          <GatewayCopy />
          {binary === null ? null : (
            <>
              <p className="text-sm text-mute">
                Read at build time from {binary.manifestPath}. Length filters excluded {formatCount(binary.excludedRowCount)} rows.
                Duplicate skips during selection: {formatCount(binary.duplicateSkipCount)}. Duplicates across the selected partitions:{" "}
                {formatCount(binary.duplicatesAcrossSelectedPartitions)}. {binary.sampling}
              </p>
              <DatasetTable binary={binary} />
              <div>
                <h3 className="text-sm font-semibold">Manifest limitations</h3>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-mute">
                  {binary.limitations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
          <div className="space-y-2 text-sm">
            <h3 className="font-semibold">Model notes</h3>
            {catalogModels.map((model) => (
              <p key={model.id}>
                {model.displayName}. {model.availabilityNote} {model.revision}
              </p>
            ))}
          </div>
          {datasetFacts.kind === "ready" ? (
            <div className="space-y-2 text-sm">
              <h3 className="font-semibold">Other intake records</h3>
              <p>
                {datasetFacts.facts.candidates.summaryPath} at {datasetFacts.facts.candidates.generatedAtUtc}. Stage{" "}
                {readableStatus(datasetFacts.facts.candidates.stage)}. {formatCount(datasetFacts.facts.candidates.sourceCandidates)} candidates,{" "}
                {formatCount(datasetFacts.facts.candidates.pendingHumanReview)} pending human review,{" "}
                {formatCount(datasetFacts.facts.candidates.trainingApprovedRows)} approved for training,{" "}
                {formatCount(datasetFacts.facts.candidates.distinctCweCategories)} upstream CWE labels. Those CWE labels are not a scored
                distribution.
              </p>
              <p className="text-mute">{datasetFacts.facts.candidates.limitations}</p>
              <p>
                {datasetFacts.facts.audit.auditPath}. {readableStatus(datasetFacts.facts.audit.stage)}. {formatCount(datasetFacts.facts.audit.rows)}{" "}
                rows, {formatCount(datasetFacts.facts.audit.trainingApprovedRows)} approved for training.
              </p>
              <p className="text-mute">{datasetFacts.facts.audit.limits}</p>
            </div>
          ) : (
            <p className="text-sm text-mute">Intake summaries are unavailable until the manifest parser succeeds.</p>
          )}
        </div>
      </details>
    </div>
  );
}

function PipelineCard({
  index,
  title,
  body,
  children,
}: {
  index: number;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  const Icon = stageIcons[index] ?? Database;
  return (
    <li className="relative">
      <article className="panel h-full">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accentDim text-accent">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="mt-3 text-sm font-semibold">{title}</p>
        {body.length > 0 ? <p className="mt-1 text-xs leading-5 text-mute">{body}</p> : null}
        {children}
      </article>
      {index < stageIcons.length - 1 ? (
        <ChevronRight className="absolute -right-2.5 top-8 hidden h-4 w-4 text-slate-300 lg:block" aria-hidden="true" />
      ) : null}
    </li>
  );
}

function LoraStatus({ candidate }: { candidate: LoraCandidateFacts }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="break-all font-mono text-[11px] text-mute">{candidate.configPath}</p>
      <StatusChip tone="ok">Configuration prepared</StatusChip>
      <StatusChip tone="ok">Structural validation completed</StatusChip>
      <StatusChip tone="pending">GPU runtime validation pending</StatusChip>
      <p className="text-xs leading-5 text-mute" data-testid="pending-collection">
        Training has not started. {candidate.maxSteps} optimizer steps are configured for a compatibility check, not a training run.
        Runtime captures go on the <Link className="text-accentText" to="/evidence">Evidence</Link> page.
      </p>
    </div>
  );
}

function GatewayCopy() {
  const { gateway } = useWorkspace();
  switch (gateway.kind) {
    case "unset":
      return (
        <p className="text-sm leading-6">
          VITE_API_BASE_URL is empty. Set it to http://127.0.0.1:8000 and start the local FastAPI gateway. The browser talks only to
          that gateway. Ollama stays behind the Mac SSH tunnel.
        </p>
      );
    case "invalid":
      return <Callout tone="error">{gateway.message}</Callout>;
    case "loading":
      return <p className="text-sm">Checking gateway.</p>;
    case "offline":
      return <Callout tone="error">{gateway.message}</Callout>;
    case "online": {
      const pretrainedJetson =
        gateway.status.liveModelId === jetsonModelId &&
        gateway.status.loraTrained === false &&
        gateway.status.inference === "ready";
      return (
        <div className="space-y-2 text-sm">
          <p>
            {pretrainedJetson
              ? jetsonLiveLabel
              : `${gateway.status.gatewayName}. Inference ${gateway.status.inference}.`}
            {gateway.models.kind === "error" ? ` Models: ${gateway.models.message}` : ""}
          </p>
          {gateway.status.upstreamModel === null ? null : <p className="text-mute">Upstream model {gateway.status.upstreamModel}.</p>}
          {gateway.status.message.length > 0 ? <p>{gateway.status.message}</p> : null}
          {pretrainedJetson ? (
            <p className="text-mute">The B200 LoRA candidate remains on the pipeline card. Training has not started.</p>
          ) : null}
          {gateway.models.kind === "ready" ? (
            <ul className="space-y-2">
              {gateway.models.models.map((model) => (
                <li key={model.id}>
                  {model.displayName}.{" "}
                  {model.availability.kind === "served" ? model.availability.endpointLabel : model.availability.note}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    }
    default: {
      const exhaustive: never = gateway;
      return exhaustive;
    }
  }
}
