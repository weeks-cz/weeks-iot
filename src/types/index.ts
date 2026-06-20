import type { Circuit, CircuitComponent, ComponentType } from "@/types/cad";

export type ThemeId =
  | "classic" | "sunrise" | "forest" | "ice"
  | "ember" | "lagoon" | "sand" | "midnight" | "volt";

export type SectionId = "beginner" | "advanced" | "expert";

export type ThemeAccent =
  | "blue" | "orange" | "green" | "cyan"
  | "red" | "teal" | "sand" | "purple" | "lime";

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
  cad?: {
    palette: ComponentType[];
    seed?: CircuitComponent[];
  };
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
  dailyChallengeDate: string | null; // date key when last claimed (YYYY-MM-DD), null = never
  levelBadges: string[];
  // false = new account, show welcome modal once. undefined on accounts created before this field
  // was introduced — treated as seen (don't ambush returning students).
  welcomeSeen?: boolean;
}

export interface ScreenState {
  currentScreen:
    | "topic-select"               // added 2026-04-26 — gates entry to PIN
    | "pin-entry" | "task-list" | "task-detail"
    | "style-shop" | "avatar-shop" | "level-badges"
    | "profile"                    // added 2026-06-20 — child progress hub
    | "admin";
  activeTaskId?: string;
  pinLevel: "none" | "daily" | "lecturer" | "admin";
}

export interface PerStudentAccount {
  account: AccountState;
  tasks: Record<string, TaskState>;
  sections: Record<SectionId, { unlocked: boolean }>;
  circuits: Record<string, Circuit>;          // task-id → saved circuit
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
  codeDrafts: Record<string, string>;          // task code drafts preserved across navigation
  account: AccountState;
  tasks: Record<string, TaskState>;
  sections: Record<SectionId, { unlocked: boolean }>;
  screen: ScreenState;
  // Set když user propojil Supabase účet. null = PIN-only / anonymous.
  linkedUserId?: string | null;
  circuits: Record<string, Circuit>;          // current student's circuits (view)
}

// JSONB shape uložený v learning_accounts.state
export interface SyncableState {
  account: AccountState;
  tasks: Record<string, TaskState>;
  sections: Record<SectionId, { unlocked: boolean }>;
  circuits: Record<string, Circuit>;          // synced to cloud
}

// Event types posílané do learning_events
export type LearningEventType =
  | "signup" | "login"
  | "task_complete" | "task_skip"
  | "section_unlock"
  | "theme_purchase" | "avatar_purchase"
  | "daily_challenge_claim";

export interface LearningEvent {
  event_type: LearningEventType;
  task_id?: string | null;
  metadata?: Record<string, unknown> | null;
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
