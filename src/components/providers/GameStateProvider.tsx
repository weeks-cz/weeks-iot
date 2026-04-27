"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import type { GameState, PerStudentAccount, SectionId, ThemeId } from "@/types";
import {
  createDefaultGameState,
  createDefaultTasks,
  createDefaultSections,
  loadGameState,
  saveGameState,
} from "@/lib/storage";
import { applyTheme } from "@/lib/themes";
import {
  computeTaskReward,
  awardStars,
  purchaseHelpCode,
  purchaseHelpWiring,
  purchaseSkip,
  purchaseThemeDirect,
  purchaseAvatarDirect,
  awardDailyChallenge,
  deductStars,
  computeLevelBadges,
} from "@/lib/rewards";
import { MAX_STUDENTS_LIMIT, SECTION_UNLOCK_COSTS, TEST_MODE } from "@/lib/config";
import { findTask } from "@/lib/tasks";
import { isTopicEnabled } from "@/lib/topics";

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
  | { type: "RESET" }
  | { type: "LOGIN_STUDENT"; studentNumber: string }
  | { type: "LOGOUT_STUDENT" }
  | { type: "SET_ADMIN_AUTHENTICATED"; value: boolean }
  | { type: "ENTER_ADMIN_PREVIEW" }
  | { type: "EXIT_ADMIN_PREVIEW" }
  | { type: "UPDATE_DAY_CONFIG"; dailyPin: string; maxStudents: number };

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
      const accountWithStars = awardStars(state.account, reward);
      const newAccount = {
        ...accountWithStars,
        levelBadges: computeLevelBadges(accountWithStars.stars),
      };
      return syncCurrentStudent({
        ...state,
        account: newAccount,
        tasks: { ...state.tasks, [action.taskId]: { ...ts, status: "completed" } },
      });
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
      return syncCurrentStudent({ ...state, account: acc });
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

    case "RESET":
      return createDefaultGameState();

    case "LOGIN_STUDENT": {
      const num = action.studentNumber;
      const stored = state.accounts[num];
      const account = stored?.account ?? {
        avatarId: state.account.avatarId,
        stars: TEST_MODE ? 80 : 0,
        tokens: TEST_MODE ? 6 : 0,
        unlockedThemes: ["classic" as const],
        unlockedAvatars: [state.account.avatarId],
        currentTheme: state.account.currentTheme,
        dailyChallengeCompleted: false,
        levelBadges: ["prvni-led"],
      };
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
    saveGameState(state);
  }, [state]);

  useEffect(() => {
    applyTheme(state.account.currentTheme);
  }, [state.account.currentTheme]);

  return (
    <GameStateContext.Provider value={{ state, dispatch, emailFromUrl }}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  const ctx = useContext(GameStateContext);
  if (!ctx) throw new Error("useGameState must be inside GameStateProvider");
  return ctx;
}
