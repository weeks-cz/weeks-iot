export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-[color:var(--theme-accent)] transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
