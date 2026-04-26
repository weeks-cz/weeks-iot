import type { AccountState, GameState, ScreenState, TaskState } from "@/types";
import { CONFIG_VERSION, STORAGE_KEY, TEST_BALANCE, TEST_MODE } from "./config";
import { DEFAULT_AVATAR_ID } from "./avatars";
import { getAllTasks } from "./tasks";

function createDefaultTaskState(): TaskState {
  return {
    status: "available",
    helpCodeUsed: false,
    helpWiringUsed: false,
    skipUsed: false,
    firstTry: true,
  };
}

function createDefaultAccountState(): AccountState {
  return {
    avatarId: DEFAULT_AVATAR_ID,
    // TEST_MODE seeds new accounts with TEST_BALANCE for dev exploration of
    // shop/badges (added 2026-04-26 — Štěpán's TEST_BALANCE constant). NEVER
    // triggers in production because NEXT_PUBLIC_TEST_MODE is read at build
    // time and unset on Vercel.
    stars: TEST_MODE ? TEST_BALANCE.stars : 0,
    tokens: TEST_MODE ? TEST_BALANCE.styleTokens : 0,
    unlockedThemes: ["classic"],
    unlockedAvatars: [DEFAULT_AVATAR_ID],
    currentTheme: "classic",
    dailyChallengeCompleted: false,
    levelBadges: ["prvni-led"],
  };
}

function createDefaultScreenState(): ScreenState {
  // Topic-select runs first; reducer flips to "pin-entry" once selectedTopic is set.
  return { currentScreen: "topic-select", pinLevel: "none" };
}

export function createDefaultGameState(): GameState {
  const tasks: Record<string, TaskState> = {};
  for (const t of getAllTasks()) {
    tasks[t.id] = createDefaultTaskState();
  }
  const sections: GameState["sections"] = {
    beginner: { unlocked: true },
    advanced: { unlocked: false },
    expert: { unlocked: false },
  };
  return {
    version: CONFIG_VERSION,
    selectedTopic: null, // forces topic-select screen on first visit
    account: createDefaultAccountState(),
    tasks,
    sections,
    screen: createDefaultScreenState(),
  };
}

export function loadGameState(): GameState {
  if (typeof window === "undefined") return createDefaultGameState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultGameState();
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== CONFIG_VERSION) return createDefaultGameState();
    return parsed;
  } catch (err) {
    console.warn("[storage] corrupt state, resetting:", err);
    return createDefaultGameState();
  }
}

export function saveGameState(state: GameState): { ok: boolean; error?: string } {
  if (typeof window === "undefined") return { ok: true };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (err) {
    console.warn("[storage] write failed:", err);
    return { ok: false, error: String(err) };
  }
}

export function resetGameState(): GameState {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* swallow — quota / disabled storage shouldn't break reset */
    }
  }
  return createDefaultGameState();
}
