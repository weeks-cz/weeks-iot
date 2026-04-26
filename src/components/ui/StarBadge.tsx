import { Star } from "lucide-react";

export function StarBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--theme-panel)] px-3 py-1 text-sm font-semibold">
      <Star className="h-4 w-4 fill-[color:var(--theme-star)] text-[color:var(--theme-star)]" />
      {count}
    </span>
  );
}
