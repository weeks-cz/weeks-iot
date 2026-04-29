import type { AccountState, GameState, PerStudentAccount, ScreenState, TaskState } from "@/types";
import { CONFIG_VERSION, DEFAULT_CONFIG, STORAGE_KEY, TEST_BALANCE, TEST_MODE } from "./config";
import { DEFAULT_AVATAR_ID, normalizeAvatarId } from "./avatars";
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

export function createDefaultAccountState(): AccountState {
  return {
    avatarId: DEFAULT_AVATAR_ID,
    stars: TEST_MODE ? TEST_BALANCE.stars : 0,
    tokens: TEST_MODE ? TEST_BALANCE.styleTokens : 0,
    unlockedThemes: ["classic"],
    unlockedAvatars: [DEFAULT_AVATAR_ID],
    currentTheme: "classic",
    dailyChallengeDate: null,
    levelBadges: ["prvni-led"],
    welcomeSeen: false,
  };
}

function createDefaultScreenState(): ScreenState {
  // Topic-select runs first; reducer flips to "pin-entry" once selectedTopic is set.
  return { currentScreen: "topic-select", pinLevel: "none" };
}

export function createDefaultSections(): GameState["sections"] {
  return { beginner: { unlocked: true }, advanced: { unlocked: false }, expert: { unlocked: false } };
}

export function createDefaultTasks(): Record<string, TaskState> {
  const tasks: Record<string, TaskState> = {};
  for (const t of getAllTasks()) tasks[t.id] = createDefaultTaskState();
  return tasks;
}

export function createDefaultGameState(): GameState {
  return {
    version: CONFIG_VERSION,
    selectedTopic: null,
    config: { ...DEFAULT_CONFIG },
    accounts: {},
    currentStudentNumber: null,
    adminPreviewActive: false,
    adminAuthenticated: false,
    codeDrafts: {},
    circuits: {},
    account: createDefaultAccountState(),
    tasks: createDefaultTasks(),
    sections: createDefaultSections(),
    screen: createDefaultScreenState(),
    linkedUserId: null,
  };
}

function normalizeAccountState(account: AccountState | undefined): AccountState {
  const base = account ?? createDefaultAccountState();
  const unlockedAvatars = Array.from(
    new Set([DEFAULT_AVATAR_ID, ...(base.unlockedAvatars ?? []).map(normalizeAvatarId)]),
  );

  return {
    ...base,
    avatarId: normalizeAvatarId(base.avatarId),
    unlockedAvatars,
  };
}

function normalizePerStudentAccount(student: PerStudentAccount): PerStudentAccount {
  return {
    ...student,
    account: normalizeAccountState(student.account),
    circuits: student.circuits ?? {},
  };
}

export function loadGameState(): GameState {
  if (typeof window === "undefined") return createDefaultGameState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultGameState();
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== CONFIG_VERSION) return createDefaultGameState();
    // adminAuthenticated is session-only — never restore from disk
    const accounts = Object.fromEntries(
      Object.entries(parsed.accounts ?? {}).map(([studentNumber, student]) => [
        studentNumber,
        normalizePerStudentAccount(student),
      ]),
    );

    return {
      ...parsed,
      config: { ...DEFAULT_CONFIG, ...(parsed.config ?? {}) },
      accounts,
      currentStudentNumber: parsed.currentStudentNumber ?? null,
      adminPreviewActive: false,
      adminAuthenticated: false,
      codeDrafts: parsed.codeDrafts ?? {},
      circuits: parsed.circuits ?? {},
      account: normalizeAccountState(parsed.account),
      linkedUserId: parsed.linkedUserId ?? null,
    };
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
