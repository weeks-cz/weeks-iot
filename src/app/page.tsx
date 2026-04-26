"use client";

import { useGameState } from "@/components/providers/GameStateProvider";
import { TopicSelect } from "@/components/screens/TopicSelect";
import { PinEntry } from "@/components/screens/PinEntry";
import { TaskList } from "@/components/screens/TaskList";
import { TaskDetail } from "@/components/screens/TaskDetail";
import { StyleShop } from "@/components/screens/StyleShop";
import { AvatarShop } from "@/components/screens/AvatarShop";
import { LevelBadges } from "@/components/screens/LevelBadges";
import { isTopicEnabled } from "@/lib/topics";

export default function HomePage() {
  const { state } = useGameState();
  const screen = state.screen.currentScreen;

  // Hard gate: no topic selected (or topic now disabled) → always TopicSelect.
  if (!state.selectedTopic || !isTopicEnabled(state.selectedTopic)) {
    return <TopicSelect />;
  }

  switch (screen) {
    case "topic-select": return <TopicSelect />;
    case "pin-entry":    return <PinEntry />;
    case "task-list":    return <TaskList />;
    case "task-detail":  return <TaskDetail />;
    case "style-shop":   return <StyleShop />;
    case "avatar-shop":  return <AvatarShop />;
    case "level-badges": return <LevelBadges />;
    case "admin":        return <PinEntry />; // admin handled at /admin
    default:             return <PinEntry />;
  }
}
