"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useGameState } from "@/components/providers/GameStateProvider";
import { PanelGlass } from "@/components/ui/PanelGlass";
import { Button } from "@/components/ui/Button";
import { getAllTasks } from "@/lib/tasks";
import { FALLBACK_PINS, MAX_STUDENTS_LIMIT } from "@/lib/config";

function getStudentStats(
  accounts: ReturnType<typeof useGameState>["state"]["accounts"],
  maxStudents: number,
) {
  const totalTasks = getAllTasks().length;
  return Array.from({ length: maxStudents }, (_, i) => {
    const num = String(i + 1);
    const stored = accounts[num];
    const completed = stored
      ? Object.values(stored.tasks).filter((t) => t.status === "completed").length
      : 0;
    const stars = stored?.account.stars ?? 0;
    const tokens = stored?.account.tokens ?? 0;
    const nickname = stored?.account.nickname;
    const percent = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;
    const hasData = !!stored;
    return { num, completed, totalTasks, stars, tokens, percent, nickname, hasData };
  });
}

export default function AdminPage() {
  const { state, dispatch } = useGameState();
  const router = useRouter();

  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  const [dailyPinInput, setDailyPinInput] = useState(state.config.dailyPin);
  const [maxStudentsInput, setMaxStudentsInput] = useState(String(state.config.maxStudents));
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [confirmReset, setConfirmReset] = useState<string | null>(null);

  function handleAdminLogin(e: FormEvent) {
    e.preventDefault();
    setPinError(null);
    if (pinInput !== state.config.adminPassword) {
      setPinError("Admin PIN není správný.");
      return;
    }
    dispatch({ type: "SET_ADMIN_AUTHENTICATED", value: true });
  }

  function handleSaveConfig(e: FormEvent) {
    e.preventDefault();
    setSaveMsg(null);
    const nextMaxStudents = Number(maxStudentsInput);
    if (!dailyPinInput.trim()) { setSaveMsg("PIN nesmí být prázdný."); return; }
    if (!Number.isFinite(nextMaxStudents) || nextMaxStudents < 1) {
      setSaveMsg("Počet studentů musí být aspoň 1."); return;
    }
    const pinChanged = dailyPinInput !== state.config.dailyPin;
    dispatch({
      type: "UPDATE_DAY_CONFIG",
      dailyPin: dailyPinInput.trim(),
      maxStudents: Math.min(nextMaxStudents, MAX_STUDENTS_LIMIT),
    });
    setSaveMsg(
      pinChanged
        ? "Nastavení uloženo. Studentské statistiky byly resetovány."
        : "Nastavení uloženo.",
    );
  }

  function handleResetStudent(num: string) {
    if (confirmReset !== num) { setConfirmReset(num); return; }
    dispatch({ type: "RESET_STUDENT", studentNumber: num });
    setConfirmReset(null);
  }

  function enterPreview() {
    dispatch({ type: "ENTER_ADMIN_PREVIEW" });
    router.push("/");
  }

  function leaveAdmin() {
    dispatch({ type: "SET_ADMIN_AUTHENTICATED", value: false });
    dispatch({ type: "SET_PIN_LEVEL", level: "none" });
    router.push("/");
  }

  const stats = getStudentStats(state.accounts, state.config.maxStudents);
  const activeCount = stats.filter((s) => s.hasData).length;

  const defaultPinsInUse = [
    state.config.dailyPin === FALLBACK_PINS.dailyPin && "denní",
    state.config.lecturerPin === FALLBACK_PINS.lecturerPin && "lektorský",
    state.config.adminPassword === FALLBACK_PINS.adminPassword && "admin",
  ].filter(Boolean) as string[];

  if (!state.adminAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <PanelGlass className="w-full max-w-sm space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--theme-muted)]">
              Admin
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-xs text-[color:var(--theme-muted)] hover:text-[color:var(--theme-text)]"
            >
              ← Zpět
            </button>
          </div>
          <h1 className="text-2xl font-bold">Přihlášení admina</h1>
          <p className="text-sm text-[color:var(--theme-muted)]">
            Zadej admin PIN a otevřeš nastavení dne a statistiky studentů.
          </p>
          <form onSubmit={handleAdminLogin} className="space-y-3">
            <input
              type="password"
              autoComplete="off"
              placeholder="Admin PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-center text-xl tracking-widest focus:border-[color:var(--theme-accent)] focus:outline-none"
              autoFocus
            />
            {pinError && <p className="text-sm text-red-400">{pinError}</p>}
            <Button type="submit" className="w-full">
              Přihlásit jako admin
            </Button>
          </form>
        </PanelGlass>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--theme-muted)]">
            Admin
          </p>
          <h1 className="text-3xl font-bold">Nastavení dne</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={leaveAdmin}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Odhlásit a zpět
        </Button>
      </header>

      {defaultPinsInUse.length > 0 && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p className="font-semibold text-red-300">
            ⚠ Používáš výchozí PIN ({defaultPinsInUse.join(", ")})
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-red-200/80">
            <li>
              Nastav PINy v{" "}
              <code className="text-[color:var(--theme-text)]">.env.local</code> (lokálně) nebo
              v project envu (Vercel) přes proměnné{" "}
              <code className="text-[color:var(--theme-text)]">NEXT_PUBLIC_DAILY_PIN</code>,{" "}
              <code className="text-[color:var(--theme-text)]">NEXT_PUBLIC_LECTURER_PIN</code>,{" "}
              <code className="text-[color:var(--theme-text)]">NEXT_PUBLIC_ADMIN_PASSWORD</code> a
              redeployni.
            </li>
            {defaultPinsInUse.includes("denní") && (
              <li>
                Denní PIN můžeš taky přepsat dole v sekci „Nastavení" (uložením
                resetuje studenty, vydrží jen do redeployu).
              </li>
            )}
            <li className="text-red-200/60">
              PINy stejně skončí v JS bundlu — env je tu jen kvůli rotaci a aby
              produkční hodnoty nebyly v gitu.
            </li>
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main: day settings */}
        <PanelGlass className="space-y-4">
          <h2 className="text-lg font-semibold">Nastavení</h2>
          <p className="text-sm text-[color:var(--theme-muted)]">
            Po uložení budou studenti moci zadat jen čísla od 1 do nastaveného počtu.
            Změna denního PINu resetuje všechny studentské statistiky.
          </p>
          <form onSubmit={handleSaveConfig} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Denní PIN</label>
              <input
                type="text"
                autoComplete="off"
                value={dailyPinInput}
                onChange={(e) => setDailyPinInput(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 focus:border-[color:var(--theme-accent)] focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Počet studentů</label>
              <input
                type="number"
                min="1"
                max={MAX_STUDENTS_LIMIT}
                step="1"
                value={maxStudentsInput}
                onChange={(e) => setMaxStudentsInput(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 focus:border-[color:var(--theme-accent)] focus:outline-none"
                required
              />
            </div>
            {saveMsg && <p className="text-sm text-[color:var(--theme-success)]">{saveMsg}</p>}
            <Button type="submit" className="w-full">
              Uložit nastavení dne
            </Button>
          </form>

          <hr className="border-white/10" />

          <div className="space-y-2">
            <Button className="w-full" onClick={enterPreview}>
              Vstoupit jako admin (náhled)
            </Button>
            <p className="text-xs text-[color:var(--theme-muted)]">
              V admin náhledu uvidíš všechny sekce a úkoly bez odemykání.
            </p>
          </div>

          <hr className="border-white/10" />

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Aktuální PINy</h3>
            <ul className="space-y-1 text-sm text-[color:var(--theme-muted)]">
              <li>Denní PIN: <code className="text-[color:var(--theme-text)]">{state.config.dailyPin}</code></li>
              <li>Lektor PIN: <code className="text-[color:var(--theme-text)]">{state.config.lecturerPin}</code></li>
              <li>Admin PIN: <code className="text-[color:var(--theme-text)]">{state.config.adminPassword}</code></li>
            </ul>
          </div>

          <hr className="border-white/10" />

          <Button
            variant="danger"
            onClick={() => {
              if (!window.confirm("Opravdu smazat veškerý postup všech studentů?")) return;
              dispatch({ type: "RESET" });
              router.push("/");
            }}
          >
            Reset všeho (smaže veškerý progress)
          </Button>
        </PanelGlass>

        {/* Sidebar: student stats */}
        <PanelGlass className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Statistika</h2>
            <span className="text-sm text-[color:var(--theme-muted)]">
              {activeCount}/{state.config.maxStudents} aktivních
            </span>
          </div>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {stats.map((s) => (
              <div
                key={s.num}
                className={`rounded-lg border p-3 ${
                  s.hasData
                    ? "border-white/10 bg-white/5"
                    : "border-white/5 opacity-40"
                }`}
              >
                <div className="flex items-center justify-between text-sm mb-1">
                  <strong>
                    Student {s.num}
                    {s.nickname && (
                      <span className="ml-2 font-normal text-[color:var(--theme-muted)]">
                        ({s.nickname})
                      </span>
                    )}
                  </strong>
                  {s.hasData && (
                    <button
                      type="button"
                      onClick={() => handleResetStudent(s.num)}
                      title="Reset tohoto studenta"
                      className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors ${
                        confirmReset === s.num
                          ? "bg-red-500/20 text-red-400"
                          : "text-[color:var(--theme-muted)] hover:text-red-400"
                      }`}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {confirmReset === s.num ? "Potvrdit?" : "Reset"}
                    </button>
                  )}
                </div>
                <div className="my-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[color:var(--theme-accent)] transition-all"
                    style={{ width: `${s.percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-[color:var(--theme-muted)]">
                  <span>{s.completed}/{s.totalTasks} úkolů · {s.percent}%</span>
                  <span>⭐ {s.stars} · ✦ {s.tokens}</span>
                </div>
              </div>
            ))}
          </div>
        </PanelGlass>
      </div>
    </div>
  );
}
