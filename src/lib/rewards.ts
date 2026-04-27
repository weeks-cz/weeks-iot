import type { AccountState, LevelBadge, TaskState, ThemeId } from "@/types";
import {
  AVATAR_SHOP_CONFIG,
  DEFAULT_CONFIG,
  REWARD_CONFIG,
  SECTION_UNLOCK_COSTS,
  STYLE_SHOP_CONFIG,
} from "./config";
import { STYLE_OPTIONS } from "./themes";
import { AVATAR_OPTIONS } from "./avatars";
import { getTodayKey } from "./pin";

export const LEVEL_BADGES: LevelBadge[] = [
  { id: "prvni-led", label: "PRVNÍ LED",  icon: "🏆", minStars: 0 },
  { id: "iot-mag",   label: "IOT MÁG",    icon: "🎖️", minStars: 10 },
  { id: "architekt", label: "ARCHITEKT",  icon: "🏭", minStars: 30 },
  { id: "expert",    label: "EXPERT",     icon: "✨", minStars: 60 },
];

// Note: step4n used HTML entities ("&#127942;" etc.) — converted to Unicode emoji
// for React rendering safety. Same visual result, no dangerouslySetInnerHTML needed.

export { REWARD_CONFIG, SECTION_UNLOCK_COSTS };

// --- Account mutators (pure: return new AccountState) ---------------------

export function canAfford(account: AccountState, cost: number): boolean {
  return account.stars >= cost;
}

export function deductStars(account: AccountState, cost: number): AccountState {
  return { ...account, stars: Math.max(0, account.stars - cost) };
}

export function awardStars(account: AccountState, stars: number): AccountState {
  return { ...account, stars: account.stars + stars };
}

export function addToken(account: AccountState): AccountState {
  return { ...account, tokens: account.tokens + 1 };
}

// --- Task reward computation ----------------------------------------------

export function computeTaskReward(
  task: { reward: number },
  taskState: TaskState,
): number {
  let total = task.reward;
  if (!taskState.helpCodeUsed && !taskState.helpWiringUsed && !taskState.skipUsed) {
    total += REWARD_CONFIG.noHelpBonusStars;
  }
  if (taskState.firstTry) {
    total += REWARD_CONFIG.firstTryBonusStars;
  }
  return total;
}

// --- Purchases (return null when unaffordable / already owned) ------------

export function purchaseHelpCode(account: AccountState): AccountState | null {
  if (!canAfford(account, DEFAULT_CONFIG.helpCodeCost)) return null;
  return deductStars(account, DEFAULT_CONFIG.helpCodeCost);
}

export function purchaseHelpWiring(account: AccountState): AccountState | null {
  if (!canAfford(account, DEFAULT_CONFIG.helpWiringCost)) return null;
  return deductStars(account, DEFAULT_CONFIG.helpWiringCost);
}

export function purchaseSkip(account: AccountState): AccountState | null {
  if (!canAfford(account, DEFAULT_CONFIG.skipCost)) return null;
  return deductStars(account, DEFAULT_CONFIG.skipCost);
}

export function purchaseThemeDirect(
  account: AccountState,
  themeId: ThemeId,
): AccountState | null {
  const cost = STYLE_SHOP_CONFIG.directUnlockCost;
  if (!canAfford(account, cost)) return null;
  if (account.unlockedThemes.includes(themeId)) return null;
  return {
    ...deductStars(account, cost),
    unlockedThemes: [...account.unlockedThemes, themeId],
  };
}

export function purchaseAvatarDirect(
  account: AccountState,
  avatarId: string,
): AccountState | null {
  const cost = AVATAR_SHOP_CONFIG.directUnlockCost;
  if (!canAfford(account, cost)) return null;
  if (account.unlockedAvatars.includes(avatarId)) return null;
  return {
    ...deductStars(account, cost),
    unlockedAvatars: [...account.unlockedAvatars, avatarId],
    avatarId,
  };
}

export function spinRandomStyle(
  account: AccountState,
): { account: AccountState; themeId: ThemeId; label: string } | null {
  const locked = STYLE_OPTIONS.filter(
    (s) => s.unlockType === "shop" && !account.unlockedThemes.includes(s.id as ThemeId),
  );
  if (!locked.length) return null;
  const cost = STYLE_SHOP_CONFIG.randomSpinStarCost;
  const tokenCost = STYLE_SHOP_CONFIG.randomSpinTokenCost;
  if (!canAfford(account, cost) || account.tokens < tokenCost) return null;
  const chosen = locked[Math.floor(Math.random() * locked.length)]!;
  return {
    account: {
      ...deductStars(account, cost),
      tokens: account.tokens - tokenCost,
      unlockedThemes: [...account.unlockedThemes, chosen.id as ThemeId],
      currentTheme: chosen.id as ThemeId,
    },
    themeId: chosen.id as ThemeId,
    label: chosen.label,
  };
}

export function spinRandomAvatar(
  account: AccountState,
): { account: AccountState; avatarId: string; label: string } | null {
  const locked = AVATAR_OPTIONS.filter(
    (a) => a.unlockType === "shop" && !account.unlockedAvatars.includes(a.id),
  );
  if (!locked.length) return null;
  const cost = AVATAR_SHOP_CONFIG.randomSpinCost;
  if (!canAfford(account, cost)) return null;
  const chosen = locked[Math.floor(Math.random() * locked.length)]!;
  return {
    account: {
      ...deductStars(account, cost),
      unlockedAvatars: [...account.unlockedAvatars, chosen.id],
      avatarId: chosen.id,
    },
    avatarId: chosen.id,
    label: chosen.label,
  };
}

export function awardDailyChallenge(account: AccountState): AccountState {
  return {
    ...awardStars(account, REWARD_CONFIG.dailyChallengeStars),
    dailyChallengeDate: getTodayKey(),
  };
}

// --- Level badges --------------------------------------------------------

export function computeLevelBadges(stars: number): string[] {
  return LEVEL_BADGES.filter((b) => stars >= (b.minStars ?? 0)).map((b) => b.id);
}
