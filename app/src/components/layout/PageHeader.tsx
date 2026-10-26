import type { ReactNode } from "react";

export function PageHeader({ title, lede, actions }: { title: string; lede: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-paper">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-mute">{lede}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
