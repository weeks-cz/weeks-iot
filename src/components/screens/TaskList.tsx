"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Lock, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { PanelGlass } from "@/components/ui/PanelGlass";
import { StarBadge } from "@/components/ui/StarBadge";
import { Button } from "@/components/ui/Button";
import { useGameState } from "@/components/providers/GameStateProvider";
import { SECTIONS, getAllTasks, getDailyChallengeTaskId, hasClaimedDailyChallengeToday, findTask } from "@/lib/tasks";
import { LEVEL_BADGES, REWARD_CONFIG } from "@/lib/rewards";
import { STYLE_SHOP_CONFIG } from "@/lib/config";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { notifyAccountCreated } from "@/lib/account-email";
import type { Task } from "@/types";

export function TaskList() {
  const { state, dispatch } = useGameState();
  const router = useRouter();
  const isAdmin = state.adminPreviewActive;
  const account = state.account;

  const [nicknameInput, setNicknameInput] = useState(account.nickname ?? "");
  const [nickMsg, setNickMsg] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState(state.accountEmail ?? "");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const allTasks = getAllTasks();
  const completedCount = Object.values(state.tasks).filter((t) => t.status === "completed").length;
  const totalCount = allTasks.length;

  const dailyChallengeTaskId = getDailyChallengeTaskId();
  const dailyChallengeTask = dailyChallengeTaskId ? findTask(dailyChallengeTaskId) : null;
  const dailyClaimed = hasClaimedDailyChallengeToday(account);

  const selectedAvatar = AVATAR_OPTIONS.find((a) => a.id === account.avatarId) ?? AVATAR_OPTIONS[0]!;
  // Nickname: custom nick → student number → "Lektor"
  const profileLabel = account.nickname || (state.currentStudentNumber ? `Student ${state.currentStudentNumber}` : "Lektor");

  function openTask(t: Task) {
    dispatch({ type: "OPEN_TASK", taskId: t.id });
  }

  function unlockSection(sectionId: "advanced" | "expert") {
    dispatch({ type: "UNLOCK_SECTION", sectionId });
  }

  function exitAdminPreview() {
    dispatch({ type: "EXIT_ADMIN_PREVIEW" });
    router.push("/admin");
  }

  function logout() {
    dispatch({ type: "LOGOUT_STUDENT" });
  }

  function handleNickname(e: FormEvent) {
    e.preventDefault();
    const nick = nicknameInput.trim();
    if (nick.length < 2) { setNickMsg("Nick musí mít aspoň 2 znaky."); return; }
    dispatch({ type: "SET_NICKNAME", nickname: nick });
    setNickMsg("Nick byl uložen.");
  }

  async function handleAccountLink(e: FormEvent) {
    e.preventDefault();
    setEmailBusy(true);
    setEmailMsg(null);
    const result = await notifyAccountCreated(emailInput);
    setEmailMsg({ ok: result.ok, text: result.message ?? (result.ok ? "Hotovo." : "Nepodařilo se.") });
    if (result.ok) dispatch({ type: "SET_ACCOUNT_EMAIL", email: emailInput });
    setEmailBusy(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mx-auto max-w-6xl p-4 space-y-6"
    >
      {/* Admin preview banner */}
      {isAdmin && (
        <div className="flex items-center justify-between rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm">
          <span className="font-semibold text-amber-300">Admin náhled — všechny sekce odemčeny</span>
          <button
            type="button"
            onClick={exitAdminPreview}
            className="rounded border border-amber-400/40 px-3 py-1 text-amber-300 hover:bg-amber-400/20"
          >
            Zpět do adminu
          </button>
        </div>
      )}

      {/* Header: profile chip + currency */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Back / logout */}
          <button
            type="button"
            onClick={logout}
            className="text-xs text-[color:var(--theme-muted)] hover:text-[color:var(--theme-text)] border border-white/10 rounded-md px-2 py-1"
          >
            ← Zpět
          </button>
          {/* Profile chip */}
          {!isAdmin && (
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_SCREEN", screen: { currentScreen: "avatar-shop", pinLevel: state.screen.pinLevel } })}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-[color:var(--theme-panel)] px-3 py-1.5 text-sm hover:border-white/20"
            >
              <span className="relative h-7 w-7 overflow-hidden rounded-full bg-black/20">
                <Image
                  src={`/avatars/${selectedAvatar.filename}`}
                  alt={selectedAvatar.label}
                  width={28}
                  height={28}
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="font-medium">{profileLabel}</span>
            </button>
          )}
        </div>

        {/* Currency */}
        <div className="flex items-center gap-3">
          <StarBadge count={account.stars} />
          <span className="flex items-center gap-1 rounded-full bg-[color:var(--theme-panel)] px-3 py-1 text-sm font-semibold border border-white/10">
            <span className="text-base">✦</span>
            <span>{account.tokens}</span>
          </span>
        </div>
      </header>

      {/* Progress hero card */}
      <PanelGlass className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-3xl font-bold">{completedCount}</span>
            <span className="text-lg text-[color:var(--theme-muted)]">/{totalCount}</span>
            <span className="ml-2 text-sm text-[color:var(--theme-muted)]">úkolů splněno</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_SCREEN", screen: { currentScreen: "level-badges", pinLevel: state.screen.pinLevel } })}
              className="text-xs text-[color:var(--theme-muted)] hover:text-[color:var(--theme-text)] border border-white/10 rounded px-2 py-1"
            >
              Odznaky
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_SCREEN", screen: { currentScreen: "style-shop", pinLevel: state.screen.pinLevel } })}
              className="text-xs text-[color:var(--theme-muted)] hover:text-[color:var(--theme-text)] border border-white/10 rounded px-2 py-1"
            >
              Styly
            </button>
          </div>
        </div>
        {/* Badge strip */}
        <div className="flex gap-2 flex-wrap">
          {LEVEL_BADGES.map((badge) => {
            const earned = account.stars >= (badge.minStars ?? 0);
            return (
              <span
                key={badge.id}
                className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                  earned
                    ? "border-[color:var(--theme-accent)] bg-[color:var(--theme-accent-soft)] text-[color:var(--theme-accent)]"
                    : "border-white/10 text-[color:var(--theme-muted)] opacity-40"
                }`}
              >
                {badge.icon} {badge.label}
              </span>
            );
          })}
        </div>
      </PanelGlass>

      {/* Mobile: daily challenge strip (hidden on lg where sidebar shows it) */}
      {!isAdmin && dailyChallengeTask && (
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => !dailyClaimed && openTask(dailyChallengeTask)}
            className={`w-full rounded-lg border px-4 py-3 text-left text-sm ${
              dailyClaimed
                ? "border-white/10 bg-white/5 text-[color:var(--theme-muted)]"
                : "border-amber-400/30 bg-amber-400/10 text-amber-300"
            }`}
          >
            <span className="font-semibold">
              {dailyClaimed
                ? "✓ Denní výzva splněna"
                : `Denní výzva: ${dailyChallengeTask.title} → +${REWARD_CONFIG.dailyChallengeStars} ⭐`}
            </span>
            {!dailyClaimed && (
              <span className="ml-2 text-[10px] uppercase tracking-wider opacity-70">Otevřít →</span>
            )}
          </button>
        </div>
      )}

      {/* Two-column layout for tasks + sidebar */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Task sections */}
        <div className="space-y-8">
          {SECTIONS.map((section) => {
            const unlocked = isAdmin || (state.sections[section.id]?.unlocked ?? false);
            return (
              <section key={section.id}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">{section.label}</h2>
                  {!unlocked && section.unlockCost !== undefined && (
                    <Button
                      variant="secondary"
                      onClick={() => unlockSection(section.id as "advanced" | "expert")}
                      disabled={account.stars < section.unlockCost}
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      Odemknout za {section.unlockCost} ⭐
                    </Button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {section.tasks.map((t) => {
                    const ts = state.tasks[t.id];
                    const done = ts?.status === "completed";
                    const isDaily = t.id === dailyChallengeTaskId;
                    return (
                      <PanelGlass
                        key={t.id}
                        className={`cursor-pointer transition-transform hover:scale-[1.02] ${
                          !unlocked ? "pointer-events-none opacity-40" : ""
                        }`}
                        onClick={() => unlocked && openTask(t)}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h3 className="font-semibold">{t.title}</h3>
                          <div className="flex items-center gap-1 shrink-0">
                            {isDaily && !dailyClaimed && (
                              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                Výzva
                              </span>
                            )}
                            {done && <Check className="h-5 w-5 text-[color:var(--theme-success)]" />}
                          </div>
                        </div>
                        <p className="text-sm text-[color:var(--theme-muted)] line-clamp-2">
                          {t.description}
                        </p>
                        <div className="mt-4">
                          <StarBadge count={t.reward} />
                        </div>
                      </PanelGlass>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Sidebar panels — desktop only */}
        {!isAdmin && (
          <aside className="hidden lg:block space-y-4">
            {/* Daily challenge panel */}
            {dailyChallengeTask && (
              <PanelGlass className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                  Denní výzva
                </p>
                <h3 className="font-semibold">{dailyChallengeTask.title}</h3>
                <p className="text-xs text-[color:var(--theme-muted)]">
                  Dnešní bonus získáš za odevzdání platného kódu k tomuto úkolu.
                  Funguje i u už dřív splněných úkolů.
                </p>
                <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3">
                  <strong className="block text-sm text-amber-300">
                    {dailyClaimed ? "Dnes už splněno ✓" : `Odměna: +${REWARD_CONFIG.dailyChallengeStars} hvězdiček`}
                  </strong>
                  <p className="mt-1 text-xs text-[color:var(--theme-muted)]">
                    {dailyClaimed
                      ? "Zítra se objeví nová denní výzva."
                      : "Otevři tento úkol a odevzdej funkční kód."}
                  </p>
                </div>
                {!dailyClaimed && (
                  <button
                    type="button"
                    onClick={() => openTask(dailyChallengeTask)}
                    className="w-full rounded-lg border border-white/10 py-2 text-sm hover:bg-white/5"
                  >
                    Otevřít denní výzvu →
                  </button>
                )}
              </PanelGlass>
            )}

            {/* Reward guide */}
            <PanelGlass className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--theme-muted)]">
                Jak získávat měny
              </p>
              <p className="text-xs text-[color:var(--theme-muted)]">
                Za každý ověřený úkol získáš hvězdičky. Každý {STYLE_SHOP_CONFIG.tokenMilestone}. ověřený úkol přidá i 1 token stylu.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[color:var(--theme-muted)]">Bez nápovědy</span>
                  <span className="font-semibold">+{REWARD_CONFIG.noHelpBonusStars} ⭐</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[color:var(--theme-muted)]">Na první pokus</span>
                  <span className="font-semibold">+{REWARD_CONFIG.firstTryBonusStars} ⭐</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[color:var(--theme-muted)]">Každý {STYLE_SHOP_CONFIG.tokenMilestone}. úkol</span>
                  <span className="font-semibold">+1 ✦</span>
                </div>
              </div>
            </PanelGlass>

            {/* Nickname panel */}
            <PanelGlass className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--theme-muted)]">
                Přezdívka
              </p>
              <form onSubmit={handleNickname} className="space-y-2">
                <input
                  type="text"
                  value={nicknameInput}
                  onChange={(e) => { setNicknameInput(e.target.value); setNickMsg(null); }}
                  maxLength={20}
                  placeholder="Tvůj nick (2–20 znaků)"
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
                />
                {nickMsg && <p className="text-xs text-[color:var(--theme-success)]">{nickMsg}</p>}
                <Button type="submit" variant="ghost" size="sm" className="w-full">
                  Uložit nick
                </Button>
              </form>
            </PanelGlass>

            {/* Account link panel */}
            <PanelGlass className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--theme-muted)]">
                Propojit účet
              </p>
              {state.accountEmail ? (
                <p className="text-xs text-[color:var(--theme-success)]">
                  Účet propojený: {state.accountEmail}
                </p>
              ) : (
                <>
                  <p className="text-xs text-[color:var(--theme-muted)]">
                    Pošleme ti odkaz pro pokračování na jiném zařízení.
                  </p>
                  <form onSubmit={handleAccountLink} className="space-y-2">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => { setEmailInput(e.target.value); setEmailMsg(null); }}
                      placeholder="jmeno@example.com"
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
                    />
                    {emailMsg && (
                      <p className={`text-xs ${emailMsg.ok ? "text-[color:var(--theme-success)]" : "text-red-400"}`}>
                        {emailMsg.text}
                      </p>
                    )}
                    <Button type="submit" variant="ghost" size="sm" disabled={emailBusy || !emailInput} className="w-full">
                      {emailBusy ? "Odesílám…" : "Poslat odkaz"}
                    </Button>
                  </form>
                </>
              )}
            </PanelGlass>
          </aside>
        )}
      </div>
    </motion.div>
  );
}
