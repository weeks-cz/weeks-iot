import type { LevelBadge as LevelBadgeType } from "@/types";

export function LevelBadge({ badge, achieved }: { badge: LevelBadgeType; achieved: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-1 ${achieved ? "" : "opacity-40 grayscale"}`}>
      <div className="text-4xl">{badge.icon}</div>
      <div className="text-xs font-semibold tracking-wide uppercase">{badge.label}</div>
    </div>
  );
}
