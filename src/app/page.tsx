"use client";

import type { ComponentType } from "react";
import { AnimatePresence } from "framer-motion";
import { useGameState } from "@/components/providers/GameStateProvider";
import { TopicSelect } from "@/components/screens/TopicSelect";
import { PinEntry } from "@/components/screens/PinEntry";
import { TaskList } from "@/components/screens/TaskList";
import { TaskDetail } from "@/components/screens/TaskDetail";
import { StyleShop } from "@/components/screens/StyleShop";
import { AvatarShop } from "@/components/screens/AvatarShop";
import { LevelBadges } from "@/components/screens/LevelBadges";
import { isTopicEnabled } from "@/lib/topics";
import type { ScreenState } from "@/types";

const SCREENS: Record<ScreenState["currentScreen"], ComponentType> = {
  "topic-select": TopicSelect,
  "pin-entry":    PinEntry,
  "task-list":    TaskList,
  "task-detail":  TaskDetail,
  "style-shop":   StyleShop,
  "avatar-shop":  AvatarShop,
  "level-badges": LevelBadges,
  "admin":        PinEntry, // /admin route handles its own UI
};

export default function HomePage() {
  const { state } = useGameState();

  // Hard gate: no topic selected (or topic now disabled) → always TopicSelect.
  if (!state.selectedTopic || !isTopicEnabled(state.selectedTopic)) {
    return (
      <AnimatePresence mode="wait">
        <TopicSelect key="topic-select" />
      </AnimatePresence>
    );
  }

  const key = state.screen.currentScreen;
  const Component = SCREENS[key] ?? PinEntry;
  return (
    <AnimatePresence mode="wait">
      <Component key={key} />
    </AnimatePresence>
  );
}
