import type { ReactNode } from "react";

export function StatusChip({ tone, children }: { tone: "pending" | "ok" | "info" | "neutral"; children: ReactNode }) {
  const toneClass =
    tone === "ok"
      ? "bg-emerald-50 text-ok"
      : tone === "pending"
        ? "bg-amber-50 text-amber-800"
        : tone === "info"
          ? "bg-accentDim text-accentText"
          : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}>{children}</span>;
}
