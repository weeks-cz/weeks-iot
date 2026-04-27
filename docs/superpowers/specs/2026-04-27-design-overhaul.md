# UI Design Overhaul — Bento + Child-Friendly

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Weeks IoT app UI to a modern bento-grid aesthetic that is child-friendly (large tap targets, visible descriptions, breathing room) while preserving all existing functionality, the 9-theme CSS variable system, Framer Motion animations, and Tailwind v4.

**Architecture:** Component-level CSS updates only — no new libraries, no layout restructuring, no state changes. The CSS variable theming system (`--theme-accent`, `--theme-panel`, etc.) remains the single source of truth for color. New shared classes go into `globals.css`; individual screen components get updated class names.

**Tech Stack:** Next.js, Tailwind v4, Framer Motion, Lucide icons, Outfit font (already loaded)

---

## Design Principles

### Visual Language
- **Bento stat panels** — progress, stars, tokens each get a distinct coloured glass panel (uses existing `--theme-accent-soft` + `--theme-accent` per theme)
- **Breathing room** — generous padding (1.25–1.5rem on cards), never cramped
- **Child-friendly touch targets** — all interactive rows min 60px height, buttons min 48px height
- **Visible task descriptions** — every task row shows a one-line description below the title
- **Subtle depth** — one level of glassmorphism (`backdrop-filter: blur(12px)`) on stat panels and modals; task rows use a flat semi-transparent bg, no blur
- **Glow accents** — completed dots glow with `box-shadow: 0 0 8px var(--theme-accent)`, buttons glow on hover

### Typography (Outfit font, already present)
- Screen titles: `text-2xl font-bold` (headings like section names: `text-xs uppercase tracking-widest`)
- Task names: `text-base font-semibold`
- Task descriptions: `text-sm` muted
- Stat values: `text-3xl font-black tracking-tight`
- Stat labels: `text-xs uppercase tracking-wider font-bold`

### Colours
- All colours from existing CSS variables — no hardcoded hex in components
- Stat panels use `--theme-accent-soft` bg + `--theme-accent` border at 0.2 opacity
- Stars panel uses `--theme-star` family
- Success/tokens panel uses `--theme-success` family
- Completed task rows: `--theme-accent-soft` bg + `--theme-accent` border at 0.12 opacity
- Completed dot: `--theme-accent` with glow shadow
- Unlock row: dashed `--theme-accent` border at 0.2 opacity

### Spacing & Radius
- Panel radius: `rounded-2xl` (16px)
- Task row radius: `rounded-xl` (12px)
- Button radius: `rounded-xl` for primary, `rounded-full` for pill/chip buttons
- Page max-width: `max-w-3xl` centred, full-width padding `px-4 py-6`

---

## Shared Components to Update

### `Button.tsx`
- `lg` size: `h-12 px-6` → `h-14 px-8 text-base` (bigger for children)
- `md` size: `h-10 px-4` → `h-12 px-5`
- All variants: `rounded-xl` (was `rounded-lg`)
- `primary` variant: add `hover:shadow-[0_0_16px_var(--theme-accent-soft)]`

### `PanelGlass.tsx`
- Keep as-is — it is used for modals and sidebar panels
- Add optional `variant="stat"` prop that adds `p-4` and smaller internal padding for bento cells (default stays `p-6`)

### New CSS classes in `globals.css`
```css
/* Bento stat cell */
.bento-cell {
  background: var(--theme-accent-soft);
  border: 1px solid color-mix(in srgb, var(--theme-accent) 20%, transparent);
  border-radius: 1rem;
  padding: 1rem 1.25rem;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Task row */
.task-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1.1rem;
  min-height: 64px;
  border-radius: 0.75rem;
  background: rgba(var(--theme-panel-rgb), 0.4);
  border: 1px solid rgba(255,255,255,0.06);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.task-row:hover {
  background: var(--theme-accent-soft);
  border-color: color-mix(in srgb, var(--theme-accent) 18%, transparent);
  transform: translateX(3px);
}
.task-row.task-done {
  background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
  border-color: color-mix(in srgb, var(--theme-accent) 14%, transparent);
}
.task-row.task-locked {
  opacity: 0.35;
  cursor: default;
  pointer-events: none;
}

/* Completed indicator dot */
.task-dot-done {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
  background: var(--theme-accent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--theme-accent) 55%, transparent);
}
.task-dot-open {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
  background: transparent;
  border: 2px solid rgba(255,255,255,0.12);
}
```

---

## Screen: TaskList (`src/components/screens/TaskList.tsx`)

### Layout (top to bottom)
1. **Topbar** — `flex justify-between items-center`
   - Left: `⬡ Weeks` logo (`text-xl font-black` in `--theme-accent`)
   - Right: profile chip (avatar emoji + label, `rounded-full`, `--theme-accent-soft` bg)

2. **Daily challenge strip** — `rounded-2xl`, star/gold colour family, `min-h-[64px]`, full width
   - Left: ⚡ icon, label "Denní výzva", task name
   - Right: `+N ★` badge pill
   - When already claimed: muted with "Splněno ✓" badge

3. **Bento stats row** — `grid grid-cols-3 gap-3` (mobile: keep 3 cols, shrink text)
   - Cell 1 (wider `col-span-1`): **Postup** — big fraction `8/31`, module name, thin progress bar at bottom
   - Cell 2: **Hvězdičky** — `★ 24` in `--theme-star`
   - Cell 3: **Tokeny** — `◈ 8` in `--theme-success`
   - All cells use `.bento-cell`

4. **Badges row** — horizontal scroll of earned badges (existing `LevelBadge` components), `overflow-x-auto` with hidden scrollbar

5. **Section blocks** — one per section (Začátečník / Pokročilý / Expert)
   - Section header: uppercase label left, `X / Y splněno` right
   - Task rows: `.task-row` with dot, name, description, star reward + checkmark box right
   - Locked section: 2 locked rows + unlock CTA row (dashed border, token cost)

### Sidebar → Single column migration
The current layout uses a CSS grid with a sidebar (profile info, badges, nickname form, link-account button, logout). The new layout is **single-column `max-w-3xl` centred**. Sidebar elements are relocated:
- **Profile chip** (avatar + student number/nickname) → topbar right (already described above)
- **Badges** → badges row (item 4 above)
- **Nickname form** → collapsed inside profile chip; tapping the chip opens a small inline form below the topbar (same dispatch, just repositioned)
- **"Propojit účet" button** → same inline profile area or surfaces via `LinkAccountModal` trigger in topbar chip
- **Logout button** → small ghost button inside the profile chip dropdown area
- **Admin preview banner** → stays as a full-width banner at the very top (above topbar), same as now

The old `grid grid-cols-[280px_1fr]` layout class is replaced by `flex flex-col gap-6 max-w-3xl mx-auto`.

### What stays the same
- All dispatch calls, state reads, modal triggers (WelcomeModal, LinkAccountModal)
- Offline/storage banners from provider (full-width above topbar)
- Admin preview banner (full-width above topbar)

---

## Screen: TaskDetail (`src/components/screens/TaskDetail.tsx`)

### Layout
1. **Header** — back button (ghost, icon + "Zpět"), task title (`text-2xl font-bold`), daily/star badges
2. **Task image** — `rounded-2xl overflow-hidden`, full width, max 320px height
3. **Task description** — `text-base leading-relaxed`, generous `py-4`
4. **CodeValidator** — wrapped in `.panel-glass`, full width, `rounded-2xl`; the validator textarea gets `min-h-[160px]`, font-size `text-sm`; submit button uses `size="lg"` (h-14)
5. **HelpCards** — each card as a `.panel-glass rounded-2xl` block with large touch area; disabled state shows tooltip as before
6. **Prev/Next navigation** — `flex justify-between` at bottom, each as a large ghost button with arrow icon, `min-h-[52px]`

### What stays the same
- All dispatch calls (COMPLETE_TASK, AWARD_DAILY_CHALLENGE)
- CodeValidator validation logic
- HelpCard unlock logic and tooltip

---

## Screen: PinEntry (`src/components/screens/PinEntry.tsx`)

### Layout
- Centred vertically + horizontally, `max-w-md`
- **Logo** — `⬡ Weeks` large (`text-3xl font-black`) above card
- **Card** — `.panel-glass rounded-2xl p-8`
- **Mode tabs** — three pill buttons in a row (`rounded-full`, toggle active state with `--theme-accent` bg); labels: "Student", "Email", "Lektor"
- **Inputs** — `h-12 rounded-xl` (was h-10), full width
- **Submit button** — `size="lg"` (h-14), full width
- **Error** — red text below button, same as now
- EmailLoginTab: same structure, just gets the bigger input/button sizes

### What stays the same
- All auth logic, PIN verification, dispatch calls
- EmailLoginTab tabs (přihlásit / vytvořit / magic link)

---

## Other Screens (light touch)

**AvatarShop, StyleShop** — avatar/style cards get `rounded-2xl`, bigger selected border glow (`box-shadow: 0 0 0 2px var(--theme-accent)`), purchase button `size="lg"`

**LevelBadges** — badge grid with more padding, each badge card `rounded-2xl`, bigger icon display

**TopicSelect** — topic buttons get `rounded-2xl`, bigger padding, same logic

**WelcomeModal, LinkAccountModal** — `.panel-glass` already used; increase padding to `p-8`, heading `text-2xl`, body text `text-base`

---

## Theme Compatibility

All 9 themes (classic, sunrise, forest, ice, ember, lagoon, sand, midnight, volt) are automatically compatible because every new class uses CSS variables. No per-theme overrides needed. Verify visually with at least classic (blue) and ember (red) after implementation.

---

## What is NOT in scope

- No new npm packages
- No changes to state management, reducers, or data model
- No changes to task content (`src/lib/tasks.ts`)
- No admin panel redesign (admin is lector-only, lower priority)
- No mobile-specific breakpoint overhaul — responsive is handled by the existing `max-w-3xl` centred layout which works on all sizes
