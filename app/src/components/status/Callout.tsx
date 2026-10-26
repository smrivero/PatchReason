import type { ReactNode } from "react";

export function Callout({ tone, children }: { tone: "info" | "warning" | "error"; children: ReactNode }) {
  const toneClass =
    tone === "error"
      ? "border-red-200 bg-red-50 text-danger"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-line bg-white text-mute";
  return <div className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${toneClass}`}>{children}</div>;
}
