import type { LevelBadge } from "@/types";
import { REWARD_CONFIG, SECTION_UNLOCK_COSTS } from "./config";

export const LEVEL_BADGES: LevelBadge[] = [
  { id: "prvni-led", label: "PRVNÍ LED",  icon: "🏆", minStars: 0 },
  { id: "iot-mag",   label: "IOT MÁG",    icon: "🎖️", minStars: 10 },
  { id: "architekt", label: "ARCHITEKT",  icon: "🏭", minStars: 30 },
  { id: "expert",    label: "EXPERT",     icon: "✨", minStars: 60 },
];

// Note: step4n used HTML entities ("&#127942;" etc.) — converted to Unicode emoji
// for React rendering safety. Same visual result, no dangerouslySetInnerHTML needed.

export { REWARD_CONFIG, SECTION_UNLOCK_COSTS };
