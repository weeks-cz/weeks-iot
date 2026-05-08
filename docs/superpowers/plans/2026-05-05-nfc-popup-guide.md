# NFC Popup Guide Implementation Plan

> **For agentic workers:** Use a step-by-step execution workflow and keep the checkbox state updated in this file while implementing.

**Goal:** Build a dedicated mobile-first NFC popup guide at `/navody/nfc-prepis-cipu/` using the existing standalone HTML route approach, while keeping the current placeholder popup route behavior intact for other slugs.

**Architecture:** Extend the current App Router `route.ts` HTML response pattern with a small content model for the NFC popup. Keep the popup fully isolated from the main React app bundle. The route continues to return raw HTML with inline CSS/JS, and outside-click continues redirecting to `https://weeks.cz/`.

**Tech / framework constraints:** Next.js `16.2.4`, App Router, Route Handlers. Per local docs in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`, dynamic route `context.params` is a `Promise`, so the handler must keep using `await context.params`.

**Spec:** `docs/superpowers/specs/2026-05-05-nfc-popup-guide.md`

**Primary implementation target:** `src/app/(manuals)/navody/[slug]/route.ts`

---

## File Structure

| File | Change |
|------|--------|
| `src/app/(manuals)/navody/[slug]/route.ts` | Refactor route to render the fixed NFC stepper guide |
| `docs/superpowers/specs/2026-05-05-nfc-popup-guide.md` | Updated product/behavior spec |
| `docs/superpowers/plans/2026-05-05-nfc-popup-guide.md` | This implementation plan |

**Optional only if implementation gets too crowded:**

| File | Change |
|------|--------|
| `src/features/programming-guides/popup-guides.ts` | Extract popup content model and helper functions out of route file |

---

## Phase 0 - Guardrails

## Task 1: Preserve current route contract

**Goal:** Make sure the NFC work does not accidentally break existing generic popup slugs.

- [ ] Confirm current behavior in `src/app/(manuals)/navody/[slug]/route.ts`:
  - resolves `slug` from `await context.params`
  - uses `getProgrammingGuide(slug)` for the title fallback
  - returns standalone HTML with `content-type: text/html; charset=utf-8`
  - redirects outside-click to `https://weeks.cz/`
- [ ] Keep the generic fallback popup available for non-NFC slugs.
- [ ] Do not migrate this route to `page.tsx` or React UI.

---

## Phase 1 - Content model

## Task 2: Introduce a dedicated NFC popup content model

**Goal:** Avoid hardcoding all text and all option-specific steps directly inside one giant template string.

- [ ] Keep a small in-file content model near the top of `route.ts` for the NFC popup:
  - slug
  - page title
  - intro text
  - warning bullet list
  - store links
  - three option cards: `kontakt`, `web`, `poloha`
  - per-option short summary
  - per-option step list
  - per-option official reference links
- [ ] Keep v1 content static and Czech-only.
- [ ] Structure the model so each option can reset to step 1 when reselected.

---

## Phase 2 - Routing behavior

## Task 3: Add and preserve the dedicated NFC slug

**Goal:** The NFC guide must keep its own URL without replacing the current generic popup behavior.

- [ ] In the `GET` handler, branch on `slug === "nfc-prepis-cipu"`.
- [ ] For the NFC slug, render the dedicated NFC popup HTML.
- [ ] For all other slugs, keep the existing generic popup HTML path.
- [ ] Continue resolving params with `await context.params`.

---

## Phase 3 - Popup UI content

## Task 4: Replace the long detail block with a full wizard

**Goal:** Turn the whole popup into a click-through flow instead of a screen with static sections plus one detail panel.

- [ ] Keep the existing fake `weeks.cz` hero background.
- [ ] Keep the `.panel` fully opaque.
- [ ] Fill the NFC panel with these steps in order:
  - step 1: welcome
  - step 2: NFC chip image
  - step 3: NFC Tools logo
  - step 4: App Store and Google Play buttons
  - step 5: NFC enable/error screenshot
  - step 6: app home screenshot
  - step 7: Write tab screenshot
  - step 8: Add record screenshot
  - step 9: upload/write screenshot
  - step 10: done state with animated confetti, 144 Bytes limit warning, and `Prejit na stranku` button
- [ ] Default the wizard to the first shared intro step.
- [ ] Show visible progress such as `Krok 1 z 6`.

**UI behavior requirements:**

- [ ] Clicking inside the popup must not redirect.
- [ ] Clicking outside the popup must still redirect to `https://weeks.cz/`.
- [ ] `App Store` and `Google Play` links must use `target="_blank"` and `rel="noopener noreferrer"`.

---

## Phase 4 - Minimal client-side interactivity

## Task 5: Add lightweight in-page wizard navigation

**Goal:** Let the user move through the selected guide with `Zpet` / `Dale` without bringing in the React app.

- [ ] Use tiny inline script logic inside the returned HTML.
- [ ] Track:
  - selected option id
  - current step index
- [ ] On option selection:
  - update active card styling
  - keep the user on the option-selection step until they continue
  - use the chosen option to build the later guided steps
- [ ] On `Zpet`:
  - move one step backward
  - disable on the first step
- [ ] On `Dale`:
  - move one step forward
  - disable on the last step

**Implementation preference:**

- [ ] Keep the script plain and tiny.
- [ ] Avoid external scripts, frameworks, or hydration.
- [ ] Avoid long scrolling lists of all steps at once.
- [ ] Make the introduction itself part of the wizard, not a static block above it.

---

## Phase 5 - Copy and references

## Task 6: Populate the first usable content pass

**Goal:** Ship a complete v1 even without screenshots.

- [ ] Add Czech intro copy explaining:
  - NFC chip stores a small piece of data
  - a phone reads it when brought close
  - here the goal is to save contact, website, or location
- [ ] Add warning copy explaining:
  - rewriting replaces current chip content
  - the tag must be writable and not locked
  - keep the phone still while writing
- [ ] Keep the guide generic and do not reintroduce a variant selection step.
- [ ] Use official NFC Tools / WAKDEV links for store buttons and references.
- [ ] Keep the wizard fixed at exactly 10 steps and do not include the removed `Kontakt`, `Web`, `Poloha` choice step.

---

## Phase 6 - Styling pass

## Task 7: Make the stepper look intentional on mobile and desktop

**Goal:** Match the existing standalone popup shell and keep the interaction obvious.

- [ ] Reuse the existing visual language where it already works:
  - dark shell
  - soft borders
  - rounded corners
  - hero background behind the popup
- [ ] Add styles for:
  - current-step card
  - step progress row
  - progress bar
  - `Zpet` / `Dale` buttons
  - disabled button state
  - official reference cards
- [ ] Keep the page mobile-first:
  - large tap targets
  - no need for the user to parse a long stacked list of all steps

---

## Phase 7 - Validation

## Task 8: Manual test checklist

- [ ] For stable local preview on Windows, run `start-nfc-page.cmd` from the repo root. This builds once and serves the production Next app at `http://127.0.0.1:3000/`.
- [ ] If the project was already built, run `serve-nfc-page.cmd` instead to start only the production server.
- [ ] Equivalent npm commands are `npm run preview:nfc` for build+serve and `npm run serve:nfc` for serve-only.
- [ ] Open `/navody/nfc-prepis-cipu/`
- [ ] Confirm response returns `200`
- [ ] Confirm popup renders above fake `weeks.cz` background
- [ ] Confirm popup panel is fully opaque
- [ ] Confirm clicking outside redirects to `https://weeks.cz/`
- [ ] Confirm clicking inside does not redirect
- [ ] Confirm `App Store` opens in a new tab/context
- [ ] Confirm `Google Play` opens in a new tab/context
- [ ] Confirm the page remains usable after returning from store links
- [ ] Confirm `Zpet` and `Dale` move exactly one step
- [ ] Confirm first step disables `Zpet`
- [ ] Confirm last step disables `Dale`
- [ ] Confirm current progress like `Krok 3 z 6` is visible
- [ ] Confirm the generic placeholder route still works for another slug

---

## Suggested execution order

1. [ ] Refactor `route.ts` into clearer helper sections without changing fallback behavior.
2. [ ] Keep or refine the NFC content model.
3. [ ] Render the NFC panel structure.
4. [ ] Replace the previous static layout with a single wizard stage.
5. [ ] Add `Zpet` / `Dale` behavior and progress display.
6. [ ] Update spec and plan docs after larger flow changes.
7. [ ] Run the manual checklist above.

---

## Notes for the implementing engineer

- [ ] Keep escaping in place for any text interpolated into raw HTML.
- [ ] Treat the route as a server-returned HTML document, not as a React page.
- [ ] Do not introduce dependency on classroom app providers, Tailwind classes, or global app CSS.
- [ ] If the template string becomes unwieldy, extract only the content model or HTML fragment helpers first; do not do a large architectural rewrite.
