export function EmptyState({ title, body, testId }: { title: string; body: string; testId: string }) {
  return (
    <div data-testid={testId} className="rounded-xl border border-dashed border-[#D5DEEA] bg-white px-5 py-8 text-center shadow-card">
      <h2 className="text-sm font-semibold text-paper">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-mute">{body}</p>
    </div>
  );
}
