# Design Overhaul — Bento + Child-Friendly UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Weeks IoT app UI to a bento-grid aesthetic with large touch targets and visible task descriptions, preserving all existing functionality and the 9-theme CSS variable system.

**Architecture:** CSS-only design system changes + component JSX updates. No new libraries. All colours come from existing CSS variables (`--theme-accent`, `--theme-panel`, `--theme-panel-rgb`, `--theme-star`, `--theme-success`, `--theme-muted`). New shared utility classes go into `globals.css`; individual screens get updated JSX.

**Tech Stack:** Next.js (see `node_modules/next/dist/docs/` for current API), Tailwind v4, Framer Motion, Lucide icons, Outfit font

---

## File Structure

| File | Change |
|------|--------|
| `src/app/globals.css` | Add `.bento-cell`, `.task-row`, `.task-row-done`, `.task-row-locked`, `.task-dot-done`, `.task-dot-open` |
| `src/components/ui/Button.tsx` | Bigger `md`/`lg` sizes, `rounded-xl` everywhere, hover glow on primary |
| `src/components/ui/PanelGlass.tsx` | Add optional `variant="stat"` prop with `p-4` padding |
| `src/components/screens/TaskList.tsx` | Full layout overhaul: topbar + bento stats + daily strip + task list rows |
| `src/components/screens/TaskDetail.tsx` | Bigger heading, bottom prev/next bar, bigger CodeValidator/HelpCards |
| `src/components/screens/PinEntry.tsx` | Bigger card, logo, pill tabs, `h-12` inputs |
| `src/components/screens/AvatarShop.tsx` | `rounded-2xl` on cards, glow ring on active |
| `src/components/screens/StyleShop.tsx` | `rounded-2xl` on cards, glow ring on active |
| `src/components/screens/WelcomeModal.tsx` | `p-8`, `text-3xl` heading |

---

## Task 1: Shared CSS classes in globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add bento-cell, task-row, and dot classes at the end of globals.css**

  Append this block after the `.panel-glass` rule (currently ends around line 273):

```css
/* ── Bento stat cell ── */
.bento-cell {
  background: var(--theme-accent-soft);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1rem;
  padding: 1rem 1.25rem;
}

/* ── Task list row ── */
.task-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1.1rem;
  min-height: 64px;
  border-radius: 0.75rem;
  background: rgba(var(--theme-panel-rgb), 0.35);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.task-row:hover {
  background: var(--theme-accent-soft);
  border-color: rgba(255, 255, 255, 0.14);
  transform: translateX(3px);
}
.task-row.task-done {
  background: var(--theme-accent-soft);
  border-color: rgba(255, 255, 255, 0.12);
}
.task-row.task-locked {
  opacity: 0.35;
  cursor: default;
  pointer-events: none;
}

/* ── Task status dots ── */
.task-dot-done {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--theme-accent);
  box-shadow: 0 0 8px var(--theme-accent);
}
.task-dot-open {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background: transparent;
  border: 2px solid rgba(255, 255, 255, 0.15);
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd C:/Users/lukol/weeks-iot && npm run build
```

Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add bento-cell and task-row shared CSS classes"
```

---

## Task 2: Button.tsx — bigger touch targets

**Files:**
- Modify: `src/components/ui/Button.tsx`

- [ ] **Step 1: Replace SIZE_CLASSES and add hover glow to primary variant**

  Replace the entire file content with:

```tsx
"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:   "bg-[color:var(--theme-accent)] text-[#0d1427] hover:brightness-110 hover:shadow-[0_0_20px_var(--theme-accent-soft)]",
  secondary: "bg-[color:var(--theme-panel)] text-[color:var(--theme-text)] border border-white/10 hover:bg-white/5",
  ghost:     "bg-transparent text-[color:var(--theme-text)] hover:bg-white/5",
  danger:    "bg-red-500 text-white hover:bg-red-600",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-12 px-5 text-sm",
  lg: "h-14 px-8 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    />
  );
});
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Button.tsx
git commit -m "style: bigger touch targets and glow on Button"
```

---

## Task 3: PanelGlass.tsx — stat variant

**Files:**
- Modify: `src/components/ui/PanelGlass.tsx`

- [ ] **Step 1: Replace file with variant support**

```tsx
import type { HTMLAttributes, ReactNode } from "react";

interface PanelGlassProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "stat";
}

export function PanelGlass({ className = "", children, variant = "default", ...rest }: PanelGlassProps) {
  const padding = variant === "stat" ? "p-4" : "p-6";
  return (
    <div className={`panel-glass ${padding} ${className}`} {...rest}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/PanelGlass.tsx
git commit -m "style: add stat variant to PanelGlass"
```

---

## Task 4: TaskList.tsx — new layout

**Files:**
- Modify: `src/components/screens/TaskList.tsx`

**Context:** The current component has a 2-column grid with a desktop-only sidebar. The new layout is single-column `max-w-3xl`, with:
1. Topbar (logo + profile chip with avatar image)
2. Daily challenge strip (always visible, was mobile-only before)
3. Bento stats row (3 cells: Postup, Hvězdičky, Tokeny)
4. Section blocks — each section has a header + list of `.task-row` items (with description), locked sections have 2 preview rows + unlock CTA row
5. Settings section at bottom (nick form, link account, reward guide — was desktop sidebar)

All dispatch calls, state reads, and modal triggers are preserved unchanged.

- [ ] **Step 1: Replace entire file with the new layout**

```tsx
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
                <div
                  key={t.id}
                  className={`task-row ${done ? "task-done" : ""} ${!unlocked ? "task-locked" : ""}`}
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
                </div>
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
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 3: Visual check — start dev server**

```bash
npm run dev
```

Open `http://localhost:3000`. Log in as a student and verify:
- Topbar with logo + profile chip shows
- Daily challenge strip is visible (full width)
- Three bento stat cells (Postup / Hvězdičky / Tokeny)
- Tasks are shown as rows with descriptions (not cards in grid)
- Locked sections show 2 preview rows + dashed unlock button
- Settings section at bottom (nick form, link account, reward guide)

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/TaskList.tsx
git commit -m "feat: redesign TaskList — bento stats, task rows with descriptions, single column"
```

---

## Task 5: TaskDetail.tsx — bigger touch targets

**Files:**
- Modify: `src/components/screens/TaskDetail.tsx`

**Context:** Current layout: header (back + prev/next + stars) → task card → image card → help code card → help wiring card → daily note card → code validator card → help cards. New layout keeps the same order but: header gets `text-2xl` task title inline, prev/next becomes a bottom fixed-like bar with large buttons, CodeValidator submit button gets `size="lg"`.

- [ ] **Step 1: Replace the return JSX**

  Replace everything from `return (` to the end of the function with:

```tsx
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mx-auto max-w-3xl px-4 py-6 space-y-5"
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="md" onClick={goBack}>
          <ArrowLeft className="mr-2 h-5 w-5" />
          Zpět
        </Button>
        <StarBadge count={task.reward} />
      </header>

      {/* Title + description */}
      <PanelGlass>
        <h1 className="text-2xl font-bold mb-3">{task.title}</h1>
        {isDaily && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-sm font-bold text-amber-300 mb-3">
            ⚡ Denní výzva {dailyClaimed ? "— splněna ✓" : `— +${REWARD_CONFIG.dailyChallengeStars} ★`}
          </span>
        )}
        <p className="whitespace-pre-line text-[color:var(--theme-muted)] leading-relaxed">
          {task.description}
        </p>
      </PanelGlass>

      {/* Image */}
      {task.imageKey && (
        <PanelGlass className="!p-0 overflow-hidden rounded-2xl">
          <TaskImage imageKey={task.imageKey} alt={task.title} />
        </PanelGlass>
      )}

      {/* Help: code */}
      {taskState.helpCodeUsed && task.hints?.code && (
        <PanelGlass>
          <h3 className="mb-3 font-semibold text-base">Ukázkový kód</h3>
          <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 font-mono text-sm">
            {task.hints.code}
          </pre>
        </PanelGlass>
      )}

      {/* Help: wiring */}
      {taskState.helpWiringUsed && task.hints?.wiring && (
        <PanelGlass>
          <h3 className="mb-3 font-semibold text-base">Schéma zapojení</h3>
          <p className="text-sm text-[color:var(--theme-muted)] leading-relaxed">
            {task.hints.wiring}
          </p>
        </PanelGlass>
      )}

      {/* Code validator */}
      <PanelGlass>
        <h3 className="mb-4 font-semibold text-base">Tvůj kód</h3>
        <CodeValidator taskId={task.id} onSuccess={handleSuccess} />
      </PanelGlass>

      {/* Help cards */}
      <PanelGlass>
        <h3 className="mb-4 font-semibold text-base">Pomocníci</h3>
        <HelpCards taskId={task.id} taskState={taskState} />
      </PanelGlass>

      {/* Prev / Next navigation */}
      {(prevTaskId || nextTaskId) && (
        <div className="flex gap-3 pt-2">
          {prevTaskId ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "OPEN_TASK", taskId: prevTaskId })}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-4 text-sm font-semibold text-[color:var(--theme-muted)] hover:border-white/20 hover:text-[color:var(--theme-text)] transition-colors"
            >
              ← Předchozí
            </button>
          ) : <div className="flex-1" />}
          {nextTaskId && (
            <button
              type="button"
              onClick={() => dispatch({ type: "OPEN_TASK", taskId: nextTaskId })}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-4 text-sm font-semibold text-[color:var(--theme-muted)] hover:border-white/20 hover:text-[color:var(--theme-text)] transition-colors"
            >
              Další →
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Visual check**

  Open a task in the dev server. Verify:
  - Back button and star badge in header
  - Title large (`text-2xl`)
  - Daily challenge badge shows on daily tasks
  - Prev/Next as large full-width-ish buttons at the bottom

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/TaskDetail.tsx
git commit -m "style: redesign TaskDetail — bigger heading, bottom prev/next nav"
```

---

## Task 6: PinEntry.tsx — bigger card, pill tabs, larger inputs

**Files:**
- Modify: `src/components/screens/PinEntry.tsx`

- [ ] **Step 1: Replace the return JSX**

  Replace everything from `return (` to the end of the function with:

```tsx
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex min-h-screen flex-col items-center justify-center p-4 gap-6"
    >
      {/* Logo */}
      <div className="text-center">
        <div className="text-4xl font-black text-[color:var(--theme-accent)] tracking-tight mb-1">
          ⬡ Weeks
        </div>
        <div className="text-sm text-[color:var(--theme-muted)]">
          Téma: <strong className="text-[color:var(--theme-text)]">{topic?.label ?? "—"}</strong>
        </div>
      </div>

      <PanelGlass className="w-full max-w-md space-y-5">
        {/* Mode tabs — pill style */}
        <div className="flex gap-2 p-1 bg-black/20 rounded-2xl">
          {(["student", "email", "lecturer"] as LoginMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                mode === m
                  ? "bg-[color:var(--theme-accent)] text-[#0d1427]"
                  : "text-[color:var(--theme-muted)] hover:text-[color:var(--theme-text)]"
              }`}
            >
              {m === "student" ? "Student" : m === "email" ? "Email" : "Lektor"}
            </button>
          ))}
        </div>

        {mode === "email" ? (
          <EmailLoginTab />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 h-14 text-center text-2xl tracking-widest focus:border-[color:var(--theme-accent)] focus:outline-none"
              placeholder={mode === "student" ? "Denní PIN" : "Lektor PIN"}
              autoFocus
            />
            {mode === "student" && (
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={String(state.config.maxStudents).length}
                value={studentNumber}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  if (!digits) { setStudentNumber(""); return; }
                  const n = Number(digits);
                  if (n > state.config.maxStudents) {
                    setStudentNumber(String(state.config.maxStudents));
                  } else {
                    setStudentNumber(digits);
                  }
                }}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 h-14 text-center text-xl tracking-widest focus:border-[color:var(--theme-accent)] focus:outline-none"
                placeholder={`Číslo studenta (1–${state.config.maxStudents})`}
              />
            )}
            {error && <p className="text-center text-sm text-red-400">{error}</p>}
            <Button type="submit" size="lg" className="w-full">
              Vstoupit
            </Button>
          </form>
        )}
      </PanelGlass>

      {/* Utility links */}
      <div className="flex gap-4 text-sm text-[color:var(--theme-muted)]">
        <button
          type="button"
          onClick={() => dispatch({ type: "CHANGE_TOPIC" })}
          className="hover:text-[color:var(--theme-text)] transition-colors"
        >
          Změnit téma
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="hover:text-[color:var(--theme-text)] transition-colors"
        >
          Admin
        </button>
      </div>
    </motion.div>
  );
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Visual check**

  Open `http://localhost:3000` (logged out). Verify:
  - Big `⬡ Weeks` logo above card
  - Three pill tabs (Student / Email / Lektor) styled correctly
  - Tall inputs (`h-14`)
  - Active tab has accent background

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/PinEntry.tsx
git commit -m "style: redesign PinEntry — logo, pill tabs, larger inputs"
```

---

## Task 7: AvatarShop + StyleShop — rounded corners and glow

**Files:**
- Modify: `src/components/screens/AvatarShop.tsx`
- Modify: `src/components/screens/StyleShop.tsx`

- [ ] **Step 1: Update AvatarShop — rounded-2xl on cards, glow active ring**

  In `src/components/screens/AvatarShop.tsx`, make these targeted changes:

  Change outer wrapper classname from `"mx-auto max-w-6xl p-6 space-y-6"` to `"mx-auto max-w-3xl px-4 py-6 space-y-6"`.

  Change the avatar card `PanelGlass` ring class from `ring-2 ring-[color:var(--theme-accent)]` to `ring-2 ring-[color:var(--theme-accent)] shadow-[0_0_20px_var(--theme-accent-soft)]`.

  Change the avatar grid class from `"grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"` to `"grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5"`.

  The full updated file:

```tsx
"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Lock, Shuffle, Smile, Star } from "lucide-react";
import { PanelGlass } from "@/components/ui/PanelGlass";
import { StarBadge } from "@/components/ui/StarBadge";
import { Button } from "@/components/ui/Button";
import { useGameState } from "@/components/providers/GameStateProvider";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { AVATAR_SHOP_CONFIG } from "@/lib/config";

export function AvatarShop() {
  const { state, dispatch } = useGameState();
  const account = state.account;
  const cost = AVATAR_SHOP_CONFIG.directUnlockCost;
  const spinCost = AVATAR_SHOP_CONFIG.randomSpinCost;

  const lockedCount = AVATAR_OPTIONS.filter(
    (a) => a.unlockType === "shop" && !account.unlockedAvatars.includes(a.id),
  ).length;
  const canSpin = account.stars >= spinCost && lockedCount > 0;

  function goBack() {
    dispatch({
      type: "SET_SCREEN",
      screen: { currentScreen: "task-list", pinLevel: state.screen.pinLevel },
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="mx-auto max-w-3xl px-4 py-6 space-y-6"
    >
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="md" onClick={goBack}>
          <ArrowLeft className="mr-2 h-5 w-5" />
          Zpět
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Smile className="h-6 w-6" />
          Obchod s avatary
        </h1>
        <StarBadge count={account.stars} />
      </header>

      <PanelGlass className="flex items-center justify-between gap-4">
        <div>
          <strong className="block">Náhodný avatar</strong>
          <p className="text-sm text-[color:var(--theme-muted)]">
            Vytoč nový avatar za {spinCost} ⭐.
            {lockedCount === 0 && " Všechny avatary jsou odemčeny."}
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={!canSpin}
          onClick={() => dispatch({ type: "SPIN_AVATAR" })}
          className="shrink-0"
        >
          <Shuffle className="mr-2 h-4 w-4" />
          Vytoč avatar
        </Button>
      </PanelGlass>

      <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5">
        {AVATAR_OPTIONS.map((opt) => {
          const isUnlocked = state.account.unlockedAvatars.includes(opt.id);
          const isActive = state.account.avatarId === opt.id;
          const canAfford = state.account.stars >= cost;

          const onClick = () => {
            if (isActive) return;
            if (isUnlocked) {
              dispatch({ type: "SET_AVATAR", avatarId: opt.id });
            } else if (canAfford) {
              dispatch({ type: "PURCHASE_AVATAR", avatarId: opt.id });
            }
          };

          const interactive = !isActive && (isUnlocked || canAfford);

          return (
            <PanelGlass
              key={opt.id}
              className={`!p-3 space-y-2 text-center transition-transform ${
                interactive ? "cursor-pointer hover:scale-[1.03]" : ""
              } ${isActive ? "ring-2 ring-[color:var(--theme-accent)] shadow-[0_0_20px_var(--theme-accent-soft)]" : ""}`}
              onClick={interactive ? onClick : undefined}
            >
              <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-xl bg-black/20">
                <Image
                  src={`/avatars/${opt.filename}`}
                  alt={opt.label}
                  width={128}
                  height={128}
                  className={`h-full w-full object-cover ${
                    !isUnlocked ? "opacity-40 grayscale" : ""
                  }`}
                />
                {isActive && (
                  <span className="absolute right-1 top-1 rounded-full bg-[color:var(--theme-success)] p-1 text-[#0d1427]">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                {!isUnlocked && (
                  <span className="absolute inset-x-1 bottom-1 inline-flex items-center justify-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                    <Lock className="h-3 w-3" />
                    {cost}
                    <Star className="h-3 w-3 fill-[color:var(--theme-star)] text-[color:var(--theme-star)]" />
                  </span>
                )}
              </div>
              <div className="text-xs font-semibold text-[color:var(--theme-text)]">
                {opt.label}
              </div>
              {isActive && (
                <div className="text-[10px] font-bold uppercase text-[color:var(--theme-success)]">
                  Aktivní
                </div>
              )}
            </PanelGlass>
          );
        })}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Update StyleShop — max-w-3xl wrapper**

  In `src/components/screens/StyleShop.tsx`, change outer wrapper from `"mx-auto max-w-5xl p-6 space-y-6"` to `"mx-auto max-w-3xl px-4 py-6 space-y-6"`. Also update the back button `size="sm"` to `size="md"`.

  Only these two lines change — make a targeted edit to StyleShop.tsx:
  - Line with `className="mx-auto max-w-5xl p-6 space-y-6"` → `"mx-auto max-w-3xl px-4 py-6 space-y-6"`
  - `<Button variant="ghost" size="sm"` (back button) → `<Button variant="ghost" size="md"`

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/AvatarShop.tsx src/components/screens/StyleShop.tsx
git commit -m "style: rounded-2xl and glow on AvatarShop and StyleShop"
```

---

## Task 8: WelcomeModal — bigger padding and heading

**Files:**
- Modify: `src/components/screens/WelcomeModal.tsx`

- [ ] **Step 1: Replace file**

```tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { REWARD_CONFIG } from "@/lib/rewards";

interface Props {
  open: boolean;
  studentNumber: string;
  onClose: () => void;
}

export function WelcomeModal({ open, studentNumber, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="panel-glass w-full max-w-md p-8 space-y-5"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--theme-accent)]">
              Vítej!
            </p>
            <h2 className="text-3xl font-black">
              Jsi <span className="text-[color:var(--theme-accent)]">Student {studentNumber}</span>
            </h2>
            <div className="space-y-3 text-[color:var(--theme-muted)]">
              <p>
                Tady najdeš úkoly rozdělené do tří úrovní. Začni od{" "}
                <strong className="text-[color:var(--theme-text)]">Začátečník</strong> a postupně
                odemykej těžší.
              </p>
              <p>
                Za každý splněný úkol dostaneš ⭐{" "}
                <strong className="text-[color:var(--theme-text)]">hvězdičky</strong>. Bez nápovědy
                a na první pokus získáš{" "}
                <strong className="text-[color:var(--theme-text)]">
                  +{REWARD_CONFIG.noHelpBonusStars + REWARD_CONFIG.firstTryBonusStars} bonusových ⭐
                </strong>
                .
              </p>
              <p>
                Vyzkoušej hned{" "}
                <strong className="text-[color:var(--theme-text)]">denní výzvu</strong> nahoře — má
                navíc bonus +{REWARD_CONFIG.dailyChallengeStars} ⭐.
              </p>
            </div>
            <Button onClick={onClose} size="lg" className="w-full">
              Pojďme na to →
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Verify all themes work**

  In `http://localhost:3000`, go to Style Shop and switch between classic, ember, and forest themes. Verify:
  - Bento cells change colour correctly per theme
  - Task rows hover/done state uses correct theme accent
  - Completed dots glow with the correct theme colour

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/WelcomeModal.tsx
git commit -m "style: bigger WelcomeModal heading and padding"
```

---

## Task 9: LevelBadges + LinkAccountModal polish

**Files:**
- Modify: `src/components/screens/LevelBadges.tsx`
- Modify: `src/components/screens/LinkAccountModal.tsx`

- [ ] **Step 1: Update LevelBadges — bigger back button and padding**

  In `src/components/screens/LevelBadges.tsx`, make two targeted changes:

  1. Change outer wrapper `"mx-auto max-w-3xl p-6 space-y-6"` → `"mx-auto max-w-3xl px-4 py-6 space-y-6"`
  2. Change back button `size="sm"` → `size="md"`

- [ ] **Step 2: Update LinkAccountModal — bigger padding, heading, pill tabs, larger inputs**

  Replace the entire `LinkAccountModal.tsx` with the updated version below. All logic (auth calls, dispatch, state) is unchanged — only visual/sizing changes:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { syncToCloud, emitEvent } from "@/lib/cloud-sync";
import { useGameState } from "@/components/providers/GameStateProvider";
import { isValidEmail } from "@/lib/validation";

type SubMode = "register" | "login" | "magic";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LinkAccountModal({ open, onClose }: Props) {
  const { state, dispatch } = useGameState();
  const [subMode, setSubMode] = useState<SubMode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (subMode === "register") {
      if (password.length < 6) { setMsg({ ok: false, text: "Heslo musí mít aspoň 6 znaků." }); return; }
      if (password !== password2) { setMsg({ ok: false, text: "Hesla se neshodují." }); return; }
    }
    if (!isValidEmail(email)) { setMsg({ ok: false, text: "Zadej platný email." }); return; }

    const supabase = createClient();
    setBusy(true);

    try {
      if (subMode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname: state.account.nickname ?? null } },
        });
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        const userId = data.user?.id;
        if (!userId) { setMsg({ ok: false, text: "Účet vytvořen, ale chybí session — opakuj prosím." }); return; }

        dispatch({ type: "SET_LINKED_USER", userId });
        await syncToCloud({ ...state, linkedUserId: userId });
        await emitEvent(userId, { event_type: "signup", metadata: { source: "pin-link" } });

        setMsg({ ok: true, text: "Účet propojen ✓" });
        setTimeout(onClose, 1200);
      } else if (subMode === "login") {
        if (!window.confirm("Po přihlášení nahradíš svůj současný postup tím v cloudu. Pokračovat?")) {
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        setMsg({ ok: true, text: "Přihlášeno, načítám…" });
        setTimeout(onClose, 800);
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) { setMsg({ ok: false, text: error.message }); return; }
        setMsg({ ok: true, text: "Mrkni do mailu — link je tam." });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="panel-glass w-full max-w-md p-8 space-y-5"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-2xl font-bold">Propojit účet</h2>
              <button onClick={onClose} aria-label="Zavřít" className="rounded-lg p-1.5 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-[color:var(--theme-muted)]">
              Vytvoř si účet emailem a heslem pro pokračování doma. Tvůj současný postup
              ({state.currentStudentNumber ? `Student ${state.currentStudentNumber}` : ""}) zůstane.
            </p>

            {/* Pill tabs */}
            <div className="flex gap-2 p-1 bg-black/20 rounded-2xl">
              {(["register", "login", "magic"] as SubMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    subMode === m
                      ? "bg-[color:var(--theme-accent)] text-[#0d1427]"
                      : "text-[color:var(--theme-muted)] hover:text-[color:var(--theme-text)]"
                  }`}
                  onClick={() => { setSubMode(m); setMsg(null); }}
                >
                  {m === "register" ? "Vytvořit" : m === "login" ? "Mám účet" : "Poslat odkaz"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 h-12 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
              />
              {subMode !== "magic" && (
                <input
                  type="password" autoComplete={subMode === "register" ? "new-password" : "current-password"} required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Heslo"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 h-12 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
                />
              )}
              {subMode === "register" && (
                <input
                  type="password" autoComplete="new-password" required
                  value={password2} onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Heslo znovu"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 h-12 text-sm focus:border-[color:var(--theme-accent)] focus:outline-none"
                />
              )}
              {msg && (
                <p className={`text-sm ${msg.ok ? "text-[color:var(--theme-success)]" : "text-red-400"}`}>
                  {msg.text}
                </p>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "Pracuji…" : subMode === "register" ? "Vytvořit účet" : subMode === "login" ? "Přihlásit" : "Poslat odkaz"}
              </Button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/LevelBadges.tsx src/components/screens/LinkAccountModal.tsx
git commit -m "style: polish LevelBadges and LinkAccountModal — bigger padding, pill tabs"
```

---

## Final verification

- [ ] Run full build one last time:

```bash
npm run build
```

Expected: `✓ Compiled successfully`, zero TypeScript errors.

- [ ] Push all commits:

```bash
git push
```
