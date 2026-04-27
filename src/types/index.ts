export type ThemeId =
  | "classic" | "sunrise" | "forest" | "ice"
  | "ember" | "lagoon" | "sand" | "midnight";

export type SectionId = "beginner" | "advanced" | "expert";

export type ThemeAccent =
  | "blue" | "orange" | "green" | "cyan"
  | "red" | "teal" | "sand" | "purple";

export type UnlockType = "default" | "shop";

// Topic selector (added 2026-04-26 — Štěpán's e865397)
export type TopicId = "iot" | "3d-print" | "programming" | "blender";
export type TopicAccent = "green" | "amber" | "blue" | "purple";

export interface TopicOption {
  id: TopicId;
  label: string;
  accent: TopicAccent;
  enabled: boolean;
}

export interface ThemeOption {
  id: ThemeId;
  label: string;
  description: string;
  accent: ThemeAccent;
  unlockType: UnlockType;
}

export interface AvatarOption {
  id: string;
  label: string;
  filename: string;
  unlockType: UnlockType;
  cost?: number;
}

export interface LevelBadge {
  id: string;
  label: string;
  icon: string; // HTML entity e.g. "&#127942;"
  minStars?: number;
}

export interface Task {
  id: string;
  sectionId: SectionId;
  title: string;
  description: string;
  reward: number;
  imageKey?: string;
  hints?: { code?: string; wiring?: string };
}

export interface Section {
  id: SectionId;
  label: string;
  tasks: Task[];
  unlockCost?: number; // only for advanced/expert
}

export interface TaskState {
  status: "locked" | "available" | "completed";
  helpCodeUsed: boolean;
  helpWiringUsed: boolean;
  skipUsed: boolean;
  firstTry: boolean;
}

export interface AccountState {
  nickname?: string;
  avatarId: string;
  stars: number;
  tokens: number;
  unlockedThemes: ThemeId[];
  unlockedAvatars: string[];
  currentTheme: ThemeId;
  dailyChallengeDate?: string;
  dailyChallengeCompleted: boolean;
  levelBadges: string[];
}

export interface ScreenState {
  currentScreen:
    | "topic-select"               // added 2026-04-26 — gates entry to PIN
    | "pin-entry" | "task-list" | "task-detail"
    | "style-shop" | "avatar-shop" | "level-badges"
    | "admin";
  activeTaskId?: string;
  pinLevel: "none" | "daily" | "lecturer" | "admin";
}

export interface PerStudentAccount {
  account: AccountState;
  tasks: Record<string, TaskState>;
  sections: Record<SectionId, { unlocked: boolean }>;
}

export interface GameState {
  version: number;
  selectedTopic: TopicId | null;
  accountEmail?: string;
  config: Config;                              // mutable — admin can change dailyPin/maxStudents
  accounts: Record<string, PerStudentAccount>; // per-student data keyed by studentNumber
  currentStudentNumber: string | null;         // null = lecturer/no-student session
  adminPreviewActive: boolean;                 // admin browsing tasks with all unlocked
  adminAuthenticated: boolean;                 // admin PIN was entered this session
  account: AccountState;
  tasks: Record<string, TaskState>;
  sections: Record<SectionId, { unlocked: boolean }>;
  screen: ScreenState;
}

export interface Config {
  dailyPin: string;
  lecturerPin: string;
  adminPassword: string;
  maxStudents: number;
  helpCodeCost: number;
  helpWiringCost: number;
  skipCost: number;
}

// Validation result — granular messages per Štěpán's e865397
// `ok` is the public field name (matches `linkAccountToEmail()` and STRICT_TASK_RULES return shape).
// `valid` was the v0 shape; do NOT reintroduce — single source of truth is `ok`.
export interface ValidationResult {
  ok: boolean;
  message?: string;
}

// Email payload sent to /api/notify-account (added 2026-04-26)
export interface NotifyAccountPayload {
  to: string;
  subject: string;
  body: string;
  accessUrl: string;
}
