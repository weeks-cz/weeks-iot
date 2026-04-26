import type { TopicOption } from "@/types";

export const TOPIC_OPTIONS: TopicOption[] = [
  { id: "iot",          label: "IoT a elektronika",      accent: "green",  enabled: true  },
  { id: "3d-print",     label: "3D tisk",                accent: "amber",  enabled: false },
  { id: "programming",  label: "Programování",           accent: "blue",   enabled: false },
  { id: "blender",      label: "3D modelování",          accent: "purple", enabled: false },
];

export function getTopicById(id: string | null | undefined): TopicOption | undefined {
  if (!id) return undefined;
  return TOPIC_OPTIONS.find((t) => t.id === id);
}

export function isTopicEnabled(id: string | null | undefined): boolean {
  const topic = getTopicById(id);
  return Boolean(topic?.enabled);
}

// Read-only — preserved verbatim from Štěpán's `getTopicById` reference.
// Only `iot` is enabled in v2 — porting 1:1 per scope decision (don't drop disabled topics
// because the disabled state is part of UX: kid sees what's coming).
