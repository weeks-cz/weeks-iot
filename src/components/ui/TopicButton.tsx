"use client";

import type { TopicAccent } from "@/types";

interface Props {
  topicId: string;
  label: string;
  accent: TopicAccent;
  enabled: boolean;
  onSelect: (topicId: string) => void;
}

const ACCENT_GRADIENT: Record<TopicAccent, string> = {
  green:  "from-emerald-500/30 to-emerald-700/20 border-emerald-400/40",
  amber:  "from-amber-500/30  to-amber-700/20  border-amber-400/40",
  blue:   "from-sky-500/30    to-sky-700/20    border-sky-400/40",
  purple: "from-violet-500/30 to-violet-700/20 border-violet-400/40",
};

export function TopicButton({ topicId, label, accent, enabled, onSelect }: Props) {
  const baseClasses =
    "panel-glass relative w-full overflow-hidden rounded-xl border bg-gradient-to-br p-6 text-left " +
    "transition-[transform,border-color,background] duration-150 " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
  const enabledClasses =
    "hover:-translate-y-0.5 hover:border-white/30 cursor-pointer";
  const disabledClasses =
    "cursor-not-allowed opacity-60 saturate-50 hover:transform-none hover:border-current";

  return (
    <button
      type="button"
      data-action="select-topic"
      data-topic-id={topicId}
      disabled={!enabled}
      onClick={() => enabled && onSelect(topicId)}
      className={`${baseClasses} ${ACCENT_GRADIENT[accent]} ${enabled ? enabledClasses : disabledClasses}`}
      aria-disabled={!enabled}
    >
      <span className="block text-xs font-semibold uppercase tracking-wider text-white/60">
        {enabled ? "Dostupné" : "Připravujeme"}
      </span>
      <span className="mt-1 block text-2xl font-bold text-white">{label}</span>
    </button>
  );
}
