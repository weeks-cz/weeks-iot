"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useGameState } from "@/components/providers/GameStateProvider";
import { PanelGlass } from "@/components/ui/PanelGlass";
import { Button } from "@/components/ui/Button";
import { getAllTasks } from "@/lib/tasks";
import { buildDailyPin } from "@/lib/pin";
import { DEFAULT_CONFIG } from "@/lib/config";

export default function AdminPage() {
  const { state, dispatch } = useGameState();
  const router = useRouter();

  function leaveAdmin() {
    // Drop admin clearance and return to the main app router (topic-select / pin-entry).
    dispatch({ type: "SET_PIN_LEVEL", level: "none" });
    router.push("/");
  }

  if (state.screen.pinLevel !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <PanelGlass>
          <p>Přístup jen s admin PINem.</p>
          <Button className="mt-4" onClick={() => router.push("/")}>
            Zpět na hlavní stránku
          </Button>
        </PanelGlass>
      </div>
    );
  }

  const completedCount = Object.values(state.tasks).filter(
    (t) => t.status === "completed",
  ).length;
  const totalCount = getAllTasks().length;

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin</h1>
        <Button variant="ghost" size="sm" onClick={leaveAdmin}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Odhlásit a zpět
        </Button>
      </header>

      <PanelGlass>
        <h2 className="mb-2 text-lg font-semibold">PINy</h2>
        <ul className="space-y-1 text-sm">
          <li>
            Daily (dnes): <code>{buildDailyPin()}</code>
          </li>
          <li>
            Daily (fixed fallback): <code>{DEFAULT_CONFIG.dailyPin}</code>
          </li>
          <li>
            Lecturer: <code>{DEFAULT_CONFIG.lecturerPin}</code>
          </li>
          <li>
            Admin: <code>{DEFAULT_CONFIG.adminPassword}</code>
          </li>
        </ul>
      </PanelGlass>

      <PanelGlass>
        <h2 className="mb-2 text-lg font-semibold">Statistiky</h2>
        <p>
          Dokončeno: {completedCount} / {totalCount}
        </p>
        <p>Hvězdičky: {state.account.stars}</p>
        <p>Tokeny: {state.account.tokens}</p>
      </PanelGlass>

      <Button variant="danger" onClick={() => dispatch({ type: "RESET" })}>
        Reset stavu (smaže progress)
      </Button>
    </div>
  );
}
