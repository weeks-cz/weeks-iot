"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import type { GameState, PerStudentAccount, SectionId, SyncableState, ThemeId } from "@/types";
import {
  createDefaultGameState,
  createDefaultAccountState,
  createDefaultTasks,
  createDefaultSections,
  loadGameState,
  saveGameState,
} from "@/lib/storage";
import { applyTheme } from "@/lib/themes";
import {
  computeTaskReward,
  awardStars,
  addToken,
  purchaseHelpCode,
  purchaseHelpWiring,
  purchaseSkip,
  purchaseThemeDirect,
  purchaseAvatarDirect,
  spinRandomStyle,
  spinRandomAvatar,
  awardDailyChallenge,
  deductStars,
  computeLevelBadges,
} from "@/lib/rewards";
import { MAX_STUDENTS_LIMIT, SECTION_UNLOCK_COSTS, STYLE_SHOP_CONFIG } from "@/lib/config";
import { findTask, isDailyChallengeTask, hasClaimedDailyChallengeToday, getDailyChallengeTaskId } from "@/lib/tasks";
import { isTopicEnabled } from "@/lib/topics";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCloudState, emitEvent, syncToCloud } from "@/lib/cloud-sync";

export type Action =
  | { type: "HYDRATE"; state: GameState }
  | { type: "SELECT_TOPIC"; topicId: GameState["selectedTopic"] }
  | { type: "CHANGE_TOPIC" }
  | { type: "SET_ACCOUNT_EMAIL"; email: string }
  | { type: "SET_SCREEN"; screen: GameState["screen"] }
  | { type: "SET_PIN_LEVEL"; level: GameState["screen"]["pinLevel"] }
  | { type: "OPEN_TASK"; taskId: string }
  | { type: "COMPLETE_TASK"; taskId: string; reward: number }
  | { type: "USE_HELP_CODE"; taskId: string }
  | { type: "USE_HELP_WIRING"; taskId: string }
  | { type: "USE_SKIP"; taskId: string }
  | { type: "PURCHASE_THEME"; themeId: ThemeId }
  | { type: "PURCHASE_AVATAR"; avatarId: string }
  | { type: "SET_THEME"; themeId: ThemeId }
  | { type: "SET_AVATAR"; avatarId: string }
  | { type: "UNLOCK_SECTION"; sectionId: "advanced" | "expert" }
  | { type: "AWARD_DAILY_CHALLENGE" }
  | { type: "SPIN_STYLE" }
  | { type: "SPIN_AVATAR" }
  | { type: "RESET" }
  | { type: "LOGIN_STUDENT"; studentNumber: string }
  | { type: "LOGOUT_STUDENT" }
  | { type: "SET_ADMIN_AUTHENTICATED"; value: boolean }
  | { type: "ENTER_ADMIN_PREVIEW" }
  | { type: "EXIT_ADMIN_PREVIEW" }
  | { type: "UPDATE_DAY_CONFIG"; dailyPin: string; maxStudents: number }
  | { type: "SET_NICKNAME"; nickname: string }
  | { type: "SET_CODE_DRAFT"; taskId: string; draft: string }
  | { type: "RESET_STUDENT"; studentNumber: string }
  | { type: "MARK_WELCOME_SEEN" }
  | { type: "CLOUD_HYDRATE"; cloudData: SyncableState | null; userId: string };

function syncCurrentStudent(state: GameState): GameState {
  if (!state.currentStudentNumber) return state;
  const snap: PerStudentAccount = {
    account: state.account,
    tasks: state.tasks,
    sections: state.sections,
  };
  return { ...state, accounts: { ...state.accounts, [state.currentStudentNumber]: snap } };
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "HYDRATE":
      return action.state;

    case "SELECT_TOPIC": {
      if (!isTopicEnabled(action.topicId)) return state;
      return {
        ...state,
        selectedTopic: action.topicId,
        screen: { ...state.screen, currentScreen: "pin-entry" },
      };
    }

    case "CHANGE_TOPIC":
      return {
        ...state,
        selectedTopic: null,
        screen: { ...state.screen, currentScreen: "topic-select", pinLevel: "none" },
      };

    case "SET_ACCOUNT_EMAIL":
      return { ...state, accountEmail: action.email };

    case "SET_SCREEN":
      return { ...state, screen: action.screen };

    case "SET_PIN_LEVEL":
      return { ...state, screen: { ...state.screen, pinLevel: action.level } };

    case "OPEN_TASK":
      return {
        ...state,
        screen: { ...state.screen, activeTaskId: action.taskId, currentScreen: "task-detail" },
      };

    case "COMPLETE_TASK": {
      const task = findTask(action.taskId);
      if (!task) return state;
      const ts = state.tasks[action.taskId];
      if (!ts || ts.status === "completed") return state;
      const reward = computeTaskReward({ reward: action.reward }, ts);
      const newTasks = { ...state.tasks, [action.taskId]: { ...ts, status: "completed" as const } };
      let accountWithStars = awardStars(state.account, reward);
      // Token milestone: every Nth verified (non-skipped) completed task awards 1 token
      const oldVerified = Object.values(state.tasks).filter((t) => t.status === "completed" && !t.skipUsed).length;
      const newVerified = !ts.skipUsed ? oldVerified + 1 : oldVerified;
      if (newVerified > oldVerified && newVerified % STYLE_SHOP_CONFIG.tokenMilestone === 0) {
        accountWithStars = addToken(accountWithStars);
      }
      // Auto-award daily challenge bonus when completing the daily task
      if (isDailyChallengeTask(action.taskId) && !hasClaimedDailyChallengeToday(accountWithStars)) {
        accountWithStars = awardDailyChallenge(accountWithStars);
      }
      const newAccount = { ...accountWithStars, levelBadges: computeLevelBadges(accountWithStars.stars) };
      return syncCurrentStudent({ ...state, account: newAccount, tasks: newTasks });
    }

    case "USE_HELP_CODE": {
      if (state.adminPreviewActive) {
        const ts = state.tasks[action.taskId];
        if (!ts) return state;
        return syncCurrentStudent({
          ...state,
          tasks: { ...state.tasks, [action.taskId]: { ...ts, helpCodeUsed: true } },
        });
      }
      const acc = purchaseHelpCode(state.account);
      const ts = state.tasks[action.taskId];
      if (!acc || !ts) return state;
      return syncCurrentStudent({
        ...state,
        account: acc,
        tasks: { ...state.tasks, [action.taskId]: { ...ts, helpCodeUsed: true, firstTry: false } },
      });
    }

    case "USE_HELP_WIRING": {
      if (state.adminPreviewActive) {
        const ts = state.tasks[action.taskId];
        if (!ts) return state;
        return syncCurrentStudent({
          ...state,
          tasks: { ...state.tasks, [action.taskId]: { ...ts, helpWiringUsed: true } },
        });
      }
      const acc = purchaseHelpWiring(state.account);
      const ts = state.tasks[action.taskId];
      if (!acc || !ts) return state;
      return syncCurrentStudent({
        ...state,
        account: acc,
        tasks: { ...state.tasks, [action.taskId]: { ...ts, helpWiringUsed: true, firstTry: false } },
      });
    }

    case "USE_SKIP": {
      if (state.adminPreviewActive) {
        const ts = state.tasks[action.taskId];
        if (!ts) return state;
        return syncCurrentStudent({
          ...state,
          tasks: { ...state.tasks, [action.taskId]: { ...ts, skipUsed: true, status: "completed" } },
        });
      }
      const acc = purchaseSkip(state.account);
      const ts = state.tasks[action.taskId];
      if (!acc || !ts) return state;
      return syncCurrentStudent({
        ...state,
        account: acc,
        tasks: { ...state.tasks, [action.taskId]: { ...ts, skipUsed: true, firstTry: false, status: "completed" } },
      });
    }

    case "PURCHASE_THEME": {
      const acc = purchaseThemeDirect(state.account, action.themeId);
      if (!acc) return state;
      // Auto-select on purchase (matches vanilla buyStyle behavior)
      return syncCurrentStudent({ ...state, account: { ...acc, currentTheme: action.themeId } });
    }

    case "PURCHASE_AVATAR": {
      const acc = purchaseAvatarDirect(state.account, action.avatarId);
      if (!acc) return state;
      return syncCurrentStudent({ ...state, account: acc });
    }

    case "SET_THEME": {
      if (!state.account.unlockedThemes.includes(action.themeId)) return state;
      return syncCurrentStudent({ ...state, account: { ...state.account, currentTheme: action.themeId } });
    }

    case "SET_AVATAR": {
      if (!state.account.unlockedAvatars.includes(action.avatarId)) return state;
      return syncCurrentStudent({ ...state, account: { ...state.account, avatarId: action.avatarId } });
    }

    case "UNLOCK_SECTION": {
      const cost = SECTION_UNLOCK_COSTS[action.sectionId];
      if (state.account.stars < cost) return state;
      const section = state.sections[action.sectionId];
      if (section?.unlocked) return state;
      return syncCurrentStudent({
        ...state,
        account: deductStars(state.account, cost),
        sections: { ...state.sections, [action.sectionId]: { unlocked: true } },
      });
    }

    case "AWARD_DAILY_CHALLENGE":
      return syncCurrentStudent({ ...state, account: awardDailyChallenge(state.account) });

    case "SPIN_STYLE": {
      const result = spinRandomStyle(state.account);
      if (!result) return state;
      return syncCurrentStudent({ ...state, account: result.account });
    }

    case "SPIN_AVATAR": {
      const result = spinRandomAvatar(state.account);
      if (!result) return state;
      return syncCurrentStudent({ ...state, account: result.account });
    }

    case "RESET":
      return createDefaultGameState();

    case "LOGIN_STUDENT": {
      const num = action.studentNumber;
      const stored = state.accounts[num];
      const account = stored?.account ?? createDefaultAccountState();
      const tasks = stored?.tasks ?? createDefaultTasks();
      const sections = stored?.sections ?? createDefaultSections();
      return {
        ...state,
        currentStudentNumber: num,
        account,
        tasks,
        sections,
        screen: { ...state.screen, currentScreen: "task-list", pinLevel: "daily" },
      };
    }

    case "LOGOUT_STUDENT":
      return {
        ...syncCurrentStudent(state),
        currentStudentNumber: null,
        account: state.account,
        tasks: createDefaultTasks(),
        sections: createDefaultSections(),
        screen: { ...state.screen, currentScreen: "pin-entry", pinLevel: "none" },
      };

    case "SET_ADMIN_AUTHENTICATED":
      return { ...state, adminAuthenticated: action.value };

    case "ENTER_ADMIN_PREVIEW":
      return {
        ...state,
        adminPreviewActive: true,
        screen: { ...state.screen, currentScreen: "task-list", pinLevel: "admin" },
      };

    case "EXIT_ADMIN_PREVIEW":
      return {
        ...state,
        adminPreviewActive: false,
        screen: { ...state.screen, currentScreen: "pin-entry", pinLevel: "admin" },
      };

    case "SET_NICKNAME": {
      const nick = String(action.nickname ?? "").trim().slice(0, 20);
      if (nick.length < 2) return state;
      return syncCurrentStudent({ ...state, account: { ...state.account, nickname: nick } });
    }

    case "SET_CODE_DRAFT":
      return { ...state, codeDrafts: { ...state.codeDrafts, [action.taskId]: action.draft } };

    case "MARK_WELCOME_SEEN":
      return syncCurrentStudent({ ...state, account: { ...state.account, welcomeSeen: true } });

    case "RESET_STUDENT": {
      const next = { ...state.accounts };
      delete next[action.studentNumber];
      return { ...state, accounts: next };
    }

    case "UPDATE_DAY_CONFIG": {
      const pinChanged = action.dailyPin !== state.config.dailyPin;
      const newConfig = {
        ...state.config,
        dailyPin: action.dailyPin || state.config.dailyPin,
        maxStudents: Math.min(Math.max(1, action.maxStudents), MAX_STUDENTS_LIMIT),
      };
      return {
        ...state,
        config: newConfig,
        accounts: pinChanged ? {} : state.accounts,
      };
    }

    case "CLOUD_HYDRATE": {
      const merged = action.cloudData
        ? {
            ...state,
            account: action.cloudData.account,
            tasks: action.cloudData.tasks,
            sections: action.cloudData.sections,
          }
        : state;
      return {
        ...merged,
        linkedUserId: action.userId,
        screen: { ...state.screen, currentScreen: "task-list" as const, pinLevel: "daily" as const },
      };
    }

    default:
      return state;
  }
}

function readUrlState(): { forceTopicSelect: boolean; emailFromUrl: string | null } {
  if (typeof window === "undefined") {
    return { forceTopicSelect: false, emailFromUrl: null };
  }
  const params = new URLSearchParams(window.location.search);
  const screen = (params.get("screen") ?? params.get("view") ?? "").toLowerCase();
  const rawEmail = params.get("email");
  const normalizedEmail = rawEmail ? rawEmail.trim().toLowerCase() : null;
  return {
    forceTopicSelect: screen === "topics",
    emailFromUrl: normalizedEmail,
  };
}

interface GameStateContextValue {
  state: GameState;
  dispatch: Dispatch<Action>;
  emailFromUrl: string | null;
}

const GameStateContext = createContext<GameStateContextValue | null>(null);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, createDefaultGameState());
  const [emailFromUrl, setEmailFromUrl] = useState<string | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);
  const [offline, setOffline] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);

  useEffect(() => {
    const loaded = loadGameState();
    const { forceTopicSelect, emailFromUrl: emailParam } = readUrlState();
    setEmailFromUrl(emailParam);

    if (forceTopicSelect) {
      dispatch({
        type: "HYDRATE",
        state: {
          ...loaded,
          selectedTopic: null,
          screen: { ...loaded.screen, currentScreen: "topic-select", pinLevel: "none" },
        },
      });
      return;
    }

    if (loaded.selectedTopic && !isTopicEnabled(loaded.selectedTopic)) {
      dispatch({
        type: "HYDRATE",
        state: {
          ...loaded,
          selectedTopic: null,
          screen: { ...loaded.screen, currentScreen: "topic-select" },
        },
      });
      return;
    }

    dispatch({ type: "HYDRATE", state: loaded });
  }, []);

  useEffect(() => {
    const result = saveGameState(state);
    if (!result.ok) setStorageFailed(true);
    else if (storageFailed) setStorageFailed(false);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    applyTheme(state.account.currentTheme);
  }, [state.account.currentTheme]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchCloudState(user.id).then((cloud) => {
      if (cancelled) return;
      dispatch({ type: "CLOUD_HYDRATE", cloudData: cloud, userId: user.id });
      if (cloud) {
        emitEvent(user.id, { event_type: "login", metadata: { method: "password" } });
      }
    });
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cloud push (debounced 1s)
  useEffect(() => {
    if (!state.linkedUserId) return;
    const timer = setTimeout(() => {
      syncToCloud(state).then((result) => {
        if (!result.ok) {
          console.warn("[cloud-sync] sync failed:", result.error);
          setSyncFailed(true);
          setTimeout(() => setSyncFailed(false), 5000);
        }
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flush on tab close (best-effort — browser won't wait for async)
  useEffect(() => {
    if (!state.linkedUserId) return;
    const handler = () => { void syncToCloud(state); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const dispatchWithEvents = useCallback((action: Action) => {
    dispatch(action);
    if (!state.linkedUserId) return;

    switch (action.type) {
      case "COMPLETE_TASK": {
        const task = state.tasks[action.taskId];
        emitEvent(state.linkedUserId, {
          event_type: "task_complete",
          task_id: action.taskId,
          metadata: {
            stars_awarded: action.reward,
            first_try: task?.firstTry ?? false,
            no_help: task ? !task.helpCodeUsed && !task.helpWiringUsed : false,
          },
        });
        break;
      }
      case "USE_SKIP": {
        emitEvent(state.linkedUserId, {
          event_type: "task_skip",
          task_id: action.taskId,
          metadata: { cost: state.config.skipCost },
        });
        break;
      }
      case "UNLOCK_SECTION": {
        emitEvent(state.linkedUserId, {
          event_type: "section_unlock",
          metadata: { section_id: action.sectionId },
        });
        break;
      }
      case "PURCHASE_THEME": {
        emitEvent(state.linkedUserId, {
          event_type: "theme_purchase",
          metadata: { theme_id: action.themeId, method: "direct" },
        });
        break;
      }
      case "SPIN_STYLE": {
        emitEvent(state.linkedUserId, {
          event_type: "theme_purchase",
          metadata: { method: "spin" },
        });
        break;
      }
      case "PURCHASE_AVATAR": {
        emitEvent(state.linkedUserId, {
          event_type: "avatar_purchase",
          metadata: { avatar_id: action.avatarId, method: "direct" },
        });
        break;
      }
      case "SPIN_AVATAR": {
        emitEvent(state.linkedUserId, {
          event_type: "avatar_purchase",
          metadata: { method: "spin" },
        });
        break;
      }
      case "AWARD_DAILY_CHALLENGE": {
        emitEvent(state.linkedUserId, {
          event_type: "daily_challenge_claim",
          task_id: getDailyChallengeTaskId() ?? null,
        });
        break;
      }
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GameStateContext.Provider value={{ state, dispatch: dispatchWithEvents, emailFromUrl }}>
      {syncFailed && !storageFailed && !offline && (
        <div className="fixed bottom-16 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-300 shadow-lg">
          Cloud sync selhal — postup je uložen lokálně, zkusím za chvíli.
        </div>
      )}
      {storageFailed && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-400 shadow-lg">
          Ukládání selhalo — zkontroluj úložiště zařízení. Postup se neukládá.
        </div>
      )}
      {offline && !storageFailed && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm text-amber-300 shadow-lg">
          Jsi offline — propojení účtu e-mailem teď nepůjde. Postup se ukládá jen lokálně.
        </div>
      )}
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  const ctx = useContext(GameStateContext);
  if (!ctx) throw new Error("useGameState must be inside GameStateProvider");
  return ctx;
}
