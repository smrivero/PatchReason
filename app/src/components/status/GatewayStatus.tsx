import { useWorkspace } from "../../hooks/useWorkspace";
import { readApiBase } from "../../lib/api/client";
import { jetsonLiveLabel, jetsonModelId } from "../../lib/models/catalog";
import type { GatewaySnapshot } from "../../types/domain";

type ConnectionLabel = "Checking" | "Connected" | "Disconnected" | "Error";

function transportFailure(message: string): boolean {
  return message.includes("did not respond") || message.includes("timed out") || message.includes("ECONNABORTED");
}

function connectionLabel(gateway: GatewaySnapshot, checking: boolean): ConnectionLabel {
  if (checking || gateway.kind === "loading") return "Checking";
  if (gateway.kind === "unset") return "Disconnected";
  if (gateway.kind === "invalid") return "Error";
  if (gateway.kind === "offline") return transportFailure(gateway.message) ? "Disconnected" : "Error";
  return "Connected";
}

export function GatewayStatus() {
  const { gateway, gatewayCheck } = useWorkspace();
  const checking = gatewayCheck === "checking" || gateway.kind === "loading";
  const label = connectionLabel(gateway, checking);
  const tone =
    label === "Connected" ? "bg-emerald-500" : label === "Checking" ? "bg-amber-500" : label === "Error" ? "bg-red-500" : "bg-slate-400";

  return (
    <section className="rounded-xl border border-line bg-white p-4" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${tone}`} aria-hidden="true" />
        <h2 className="text-sm font-semibold">{label}</h2>
      </div>
      <div className="mt-2 space-y-1 text-sm leading-6">
        {checking ? <p>Checking the FastAPI gateway.</p> : null}
        <GatewayFacts gateway={gateway} />
      </div>
    </section>
  );
}

function GatewayFacts({ gateway }: { gateway: GatewaySnapshot }) {
  const base = readApiBase();
  if (gateway.kind === "unset" || base.kind === "unset") {
    return (
      <p>
        Set VITE_API_BASE_URL to http://127.0.0.1:8000 and start the local FastAPI gateway. The browser talks only to that gateway.
        Ollama stays behind the Mac SSH tunnel.
      </p>
    );
  }
  if (gateway.kind === "invalid") return <p>{gateway.message}</p>;
  if (gateway.kind === "offline") return <p>{gateway.message}</p>;
  if (gateway.kind === "loading") return <p className="text-mute">Waiting for /api/status and /api/models.</p>;
  const pretrained =
    gateway.status.liveModelId === jetsonModelId && gateway.status.loraTrained === false && gateway.status.inference === "ready";
  return (
    <>
      <p>{pretrained ? jetsonLiveLabel : `${gateway.status.gatewayName}. Inference ${gateway.status.inference}.`}</p>
      <p className="text-mute">
        Backend {gateway.status.gatewayName}. Model {gateway.status.liveModelId ?? "unlisted"}. Upstream{" "}
        {gateway.status.upstreamModel ?? "unlisted"}.
      </p>
      {gateway.status.message.length > 0 ? <p>{gateway.status.message}</p> : null}
      {gateway.models.kind === "ready" ? (
        <ul className="space-y-1">
          {gateway.models.models.map((model) => (
            <li key={model.id}>
              {model.displayName}. {model.availability.kind === "served" ? model.availability.endpointLabel : model.availability.note}
            </li>
          ))}
        </ul>
      ) : (
        <p>{gateway.models.message}</p>
      )}
    </>
  );
}
