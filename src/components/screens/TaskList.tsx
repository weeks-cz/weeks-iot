"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PanelGlass } from "@/components/ui/PanelGlass";
import { StarBadge } from "@/components/ui/StarBadge";
import { useGameState } from "@/components/providers/GameStateProvider";
import { SECTIONS, getAllTasks, getDailyChallengeTaskId, hasClaimedDailyChallengeToday, findTask } from "@/lib/tasks";
import { LEVEL_BADGES, REWARD_CONFIG } from "@/lib/rewards";
import { STYLE_SHOP_CONFIG } from "@/lib/config";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { LinkAccountModal } from "@/components/screens/LinkAccountModal";
import { WelcomeModal } from "@/components/screens/WelcomeModal";
import type { Task } from "@/types";

export function TaskList() {
  const { state, dispatch } = useGameState();
  const router = useRouter();
  const isAdmin = state.adminPreviewActive;
  const account = state.account;

  const [nicknameInput, setNicknameInput] = useState(account.nickname ?? "");
  const [nickMsg, setNickMsg] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const allTasks = getAllTasks();
  const completedCount = Object.values(state.tasks).filter((t) => t.status === "completed").length;
  const totalCount = allTasks.length;

  const dailyChallengeTaskId = getDailyChallengeTaskId();
  const dailyChallengeTask = dailyChallengeTaskId ? findTask(dailyChallengeTaskId) : null;
  const dailyClaimed = hasClaimedDailyChallengeToday(account);

  const selectedAvatar = AVATAR_OPTIONS.find((a) => a.id === account.avatarId) ?? AVATAR_OPTIONS[0]!;
  const profileLabel = state.currentStudentNumber
    ? `Student ${state.currentStudentNumber}`
    : state.linkedUserId
    ? (account.nickname ?? "Účet")
    : "Lektor";
  const profileSubtitle = account.nickname && state.currentStudentNumber ? account.nickname : null;

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mx-auto max-w-3xl px-4 py-6 space-y-5"
    >
      <WelcomeModal
        open={!isAdmin && !!state.currentStudentNumber && account.welcomeSeen === false}
        studentNumber={state.currentStudentNumber ?? ""}
        onClose={() => dispatch({ type: "MARK_WELCOME_SEEN" })}
      />

      {/* Admin preview banner */}
      {isAdmin && (
        <div className="flex items-center justify-between rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm">
          <span className="font-semibold text-amber-300">Admin náhled — všechny sekce odemčeny</span>
          <button
            type="button"
            onClick={exitAdminPreview}
            className="rounded-lg border border-amber-400/40 px-3 py-1.5 text-amber-300 hover:bg-amber-400/20"
          >
            Zpět do adminu
          </button>
        </div>
      )}

      {/* ── Topbar ── */}
      <header className="flex items-center justify-between gap-3">
        <div className="text-xl font-black text-[color:var(--theme-accent)] tracking-tight">
          ⬡ Weeks
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_SCREEN", screen: { currentScreen: "avatar-shop", pinLevel: state.screen.pinLevel } })}
              className="flex items-center gap-2 rounded-full border border-white/12 bg-[color:var(--theme-panel)] px-3 py-1.5 text-sm font-medium hover:border-white/20 transition-colors"
            >
              <span className="relative h-7 w-7 overflow-hidden rounded-full bg-black/20 shrink-0">
                <Image
                  src={`/avatars/${selectedAvatar.filename}`}
                  alt={selectedAvatar.label}
                  width={28}
                  height={28}
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="flex flex-col leading-tight text-left">
                <span>{profileLabel}</span>
                {profileSubtitle && (
                  <span className="text-[10px] text-[color:var(--theme-muted)]">{profileSubtitle}</span>
                )}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-[color:var(--theme-muted)] hover:text-[color:var(--theme-text)] hover:border-white/20 transition-colors"
          >
            ← Zpět
          </button>
        </div>
      </header>

      {/* ── Daily challenge strip ── */}
      {!isAdmin && dailyChallengeTask && (
        <button
          type="button"
          onClick={() => !dailyClaimed && openTask(dailyChallengeTask)}
          className={`w-full text-left rounded-2xl border px-5 py-4 flex items-center gap-4 transition-colors ${
            dailyClaimed
              ? "border-white/10 bg-[color:var(--theme-panel)]"
              : "border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/15"
          }`}
        >
          <span className="text-2xl shrink-0">{dailyClaimed ? "✓" : "⚡"}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-widest text-amber-400/80 mb-0.5">
              Denní výzva
            </div>
            <div className={`font-semibold truncate ${dailyClaimed ? "text-[color:var(--theme-muted)]" : "text-amber-200"}`}>
              {dailyChallengeTask.title}
            </div>
          </div>
          <span className={`text-sm font-bold rounded-full px-3 py-1 shrink-0 ${
            dailyClaimed
              ? "bg-white/5 text-[color:var(--theme-muted)]"
              : "bg-amber-400/15 text-amber-300 border border-amber-400/25"
          }`}>
            {dailyClaimed ? "Splněno" : `+${REWARD_CONFIG.dailyChallengeStars} ★`}
          </span>
        </button>
      )}

      {/* ── Bento stats ── */}
      <div className="grid grid-cols-3 gap-3">
        {/* Progress cell */}
        <div className="bento-cell col-span-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--theme-accent)] mb-1">
            Postup
          </div>
          <div className="text-3xl font-black tracking-tight text-[color:var(--theme-text)]">
            {completedCount}<span className="text-lg text-[color:var(--theme-muted)] font-normal">/{totalCount}</span>
          </div>
          <div className="text-xs text-[color:var(--theme-muted)] mt-0.5">úkolů splněno</div>
          <div className="mt-2 h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div
              className="h-full rounded-full bg-[color:var(--theme-accent)] transition-all"
              style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }}
            />
          </div>
        </div>
        {/* Stars cell */}
        <div className="bento-cell">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--theme-star)] mb-1">
            Hvězdičky
          </div>
          <div className="text-3xl font-black tracking-tight text-[color:var(--theme-star)]">
            ★ {account.stars}
          </div>
          <div className="text-xs text-[color:var(--theme-muted)] mt-0.5">získáno</div>
        </div>
        {/* Tokens cell */}
        <div className="bento-cell">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--theme-success)] mb-1">
            Tokeny
          </div>
          <div className="text-3xl font-black tracking-tight text-[color:var(--theme-success)]">
            ✦ {account.tokens}
          </div>
          <div className="text-xs text-[color:var(--theme-muted)] mt-0.5">k utracení</div>
        </div>
      </div>

      {/* ── Badges row ── */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {LEVEL_BADGES.map((badge) => {
          const earned = account.stars >= (badge.minStars ?? 0);
          return (
            <span
              key={badge.id}
              className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                earned
                  ? "border-[color:var(--theme-accent)] bg-[color:var(--theme-accent-soft)] text-[color:var(--theme-accent)]"
                  : "border-white/10 text-[color:var(--theme-muted)] opacity-40"
              }`}
            >
              {badge.icon} {badge.label}
            </span>
          );
        })}
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_SCREEN", screen: { currentScreen: "level-badges", pinLevel: state.screen.pinLevel } })}
          className="flex items-center rounded-full border border-white/10 px-3 py-1.5 text-xs text-[color:var(--theme-muted)] hover:border-white/20 whitespace-nowrap"
        >
          Všechny odznaky →
        </button>
      </div>

      {/* ── Section blocks ── */}
      {SECTIONS.map((section) => {
        const unlocked = isAdmin || (state.sections[section.id]?.unlocked ?? false);
        return (
          <section key={section.id} className="space-y-2">
            {/* Section header */}
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[color:var(--theme-muted)]">
                {section.label}
              </h2>
              <span className="text-xs text-[color:var(--theme-muted)] opacity-60">
                {unlocked
                  ? `${section.tasks.filter((t) => state.tasks[t.id]?.status === "completed").length} / ${section.tasks.length} splněno`
                  : "🔒 zamčeno"}
              </span>
            </div>

            {/* Task rows */}
            {section.tasks.map((t) => {
              const done = state.tasks[t.id]?.status === "completed";
              const isDaily = t.id === dailyChallengeTaskId;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`task-row w-full text-left ${done ? "task-done" : ""} ${!unlocked ? "task-locked" : ""}`}
                  onClick={() => unlocked && openTask(t)}
                >
                  <div className={done ? "task-dot-done" : "task-dot-open"} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[color:var(--theme-text)] text-base">{t.title}</span>
                      {isDaily && !dailyClaimed && (
                        <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 shrink-0">
                          Výzva
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[color:var(--theme-muted)] mt-0.5 line-clamp-1">
                      {t.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-[11px] ${
                      done
                        ? "border-[color:var(--theme-accent)] bg-[color:var(--theme-accent-soft)] text-[color:var(--theme-accent)]"
                        : "border-white/15"
                    }`}>
                      {done && "✓"}
                    </div>
                    <StarBadge count={t.reward} />
                  </div>
                </button>
              );
            })}

            {/* Unlock CTA row for locked sections */}
            {!unlocked && section.unlockCost !== undefined && (
              <button
                type="button"
                onClick={() => unlockSection(section.id as "advanced" | "expert")}
                disabled={account.stars < section.unlockCost}
                className="w-full flex items-center justify-between rounded-xl border-2 border-dashed border-[color:var(--theme-accent)]/20 bg-[color:var(--theme-accent-soft)] px-5 py-4 text-left transition-colors hover:border-[color:var(--theme-accent)]/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-2 font-semibold text-[color:var(--theme-text)]">
                  <Lock className="h-4 w-4" />
                  Odemknout {section.label}
                </span>
                <span className="text-sm font-bold text-[color:var(--theme-star)]">
                  {section.unlockCost} ★
                </span>
              </button>
            )}
          </section>
        );
      })}

      {/* ── Settings / Profile section (bottom) ── */}
      {!isAdmin && (
        <div className="space-y-3 pt-4 border-t border-white/8">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--theme-muted)] px-1">
            Profil a nastavení
          </p>

          {/* Nav buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_SCREEN", screen: { currentScreen: "style-shop", pinLevel: state.screen.pinLevel } })}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-[color:var(--theme-muted)] hover:border-white/20 hover:text-[color:var(--theme-text)] transition-colors"
            >
              🎨 Styly
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_SCREEN", screen: { currentScreen: "avatar-shop", pinLevel: state.screen.pinLevel } })}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-[color:var(--theme-muted)] hover:border-white/20 hover:text-[color:var(--theme-text)] transition-colors"
            >
              😸 Avatary
            </button>
          </div>

          {/* Nick form */}
          <PanelGlass variant="stat" className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--theme-muted)]">
              Přezdívka
            </p>
            <form onSubmit={handleNickname} className="flex gap-2">
              <input
                type="text"
                value={nicknameInput}
                onChange={(e) => { setNicknameInput(e.target.value); setNickMsg(null); }}
                maxLength={20}
                placeholder="Tvůj nick (2–20 znaků)"
                className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
              />
              <Button type="submit" variant="secondary" size="sm">Uložit</Button>
            </form>
            {nickMsg && <p className="text-xs text-[color:var(--theme-success)]">{nickMsg}</p>}
          </PanelGlass>

          {/* Link account */}
          <PanelGlass variant="stat" className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--theme-muted)] mb-1">
                Propojit účet
              </p>
              {state.linkedUserId ? (
                <p className="text-sm text-[color:var(--theme-success)]">Účet propojený ✓</p>
              ) : (
                <p className="text-sm text-[color:var(--theme-muted)]">Pokračuj doma na svém počítači.</p>
              )}
            </div>
            {!state.linkedUserId && (
              <Button onClick={() => setLinkModalOpen(true)} variant="secondary" size="sm">
                Propojit
              </Button>
            )}
          </PanelGlass>

          {/* Reward guide */}
          <PanelGlass variant="stat" className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--theme-muted)]">
              Jak získávat hvězdičky
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[color:var(--theme-muted)]">Bez nápovědy</span>
                <span className="font-semibold">+{REWARD_CONFIG.noHelpBonusStars} ⭐</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[color:var(--theme-muted)]">Na první pokus</span>
                <span className="font-semibold">+{REWARD_CONFIG.firstTryBonusStars} ⭐</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[color:var(--theme-muted)]">Každý {STYLE_SHOP_CONFIG.tokenMilestone}. úkol</span>
                <span className="font-semibold">+1 ✦</span>
              </div>
            </div>
          </PanelGlass>
        </div>
      )}

      <LinkAccountModal open={linkModalOpen} onClose={() => setLinkModalOpen(false)} />
    </motion.div>
  );
}
