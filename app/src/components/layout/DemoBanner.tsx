export function DemoBanner() {
  return (
    <div
      data-testid="demo-banner"
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950"
    >
      Demo data is on. Review and comparison fixtures use the label Illustrative fixture / no model inference.
      Evaluation scores stay empty until a result file or the gateway provides them. GPU charts stay empty
      until you import a capture or turn on the separate GPU fixture.
    </div>
  );
}

export function DemoToggle({ pressed, onToggle }: { pressed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-lg border border-line bg-white px-3 py-2 text-left text-sm text-paper transition duration-150 hover:border-slate-300"
    >
      <span>{pressed ? "Demo data on" : "Demo data off"}</span>
      <span className={`relative h-5 w-9 rounded-full transition-colors duration-150 ${pressed ? "bg-amber-500" : "bg-slate-200"}`}>
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${pressed ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}
