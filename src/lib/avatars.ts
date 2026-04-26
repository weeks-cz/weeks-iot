import type { AvatarOption } from "@/types";
import { AVATAR_SHOP_CONFIG } from "./config";

const SHOP_COST = AVATAR_SHOP_CONFIG.directUnlockCost;

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: "fox-purple", label: "Fox", filename: "fox-purple.png", unlockType: "default" },
  { id: "bichon-brown", label: "Bichon", filename: "bichon-brown.png", unlockType: "shop", cost: SHOP_COST },
  { id: "bull-terrier-blue", label: "Bull Terrier", filename: "bull-terrier-blue.png", unlockType: "shop", cost: SHOP_COST },
  { id: "sloth-blue", label: "Sloth", filename: "sloth-blue.png", unlockType: "shop", cost: SHOP_COST },
  { id: "weasel-brown", label: "Weasel", filename: "weasel-brown.png", unlockType: "shop", cost: SHOP_COST },
  { id: "rhino-red", label: "Rhino", filename: "rhino-red.png", unlockType: "shop", cost: SHOP_COST },
  { id: "koala-brown", label: "Koala", filename: "koala-brown.png", unlockType: "shop", cost: SHOP_COST },
  { id: "alpaca-brown", label: "Alpaca", filename: "alpaca-brown.png", unlockType: "shop", cost: SHOP_COST },
  { id: "alpaca-red", label: "Alpaca", filename: "alpaca-red.png", unlockType: "shop", cost: SHOP_COST },
  { id: "lion-green", label: "Lion", filename: "lion-green.png", unlockType: "shop", cost: SHOP_COST },
  { id: "cow-brown", label: "Cow", filename: "cow-brown.png", unlockType: "shop", cost: SHOP_COST },
  { id: "horse-red", label: "Horse", filename: "horse-red.png", unlockType: "shop", cost: SHOP_COST },
  { id: "beaver-green", label: "Beaver", filename: "beaver-green.png", unlockType: "shop", cost: SHOP_COST },
  { id: "zebra-brown", label: "Zebra", filename: "zebra-brown.png", unlockType: "shop", cost: SHOP_COST },
  { id: "dog-blue", label: "Dog", filename: "dog-blue.png", unlockType: "shop", cost: SHOP_COST },
  { id: "hippo-blue", label: "Hippo", filename: "hippo-blue.png", unlockType: "shop", cost: SHOP_COST },
  { id: "hippo-brown", label: "Hippo", filename: "hippo-brown.png", unlockType: "shop", cost: SHOP_COST },
  { id: "camel-green", label: "Camel", filename: "camel-green.png", unlockType: "shop", cost: SHOP_COST },
  { id: "giraffe-blue", label: "Giraffe", filename: "giraffe-blue.png", unlockType: "shop", cost: SHOP_COST },
  { id: "sheep-red", label: "Sheep", filename: "sheep-red.png", unlockType: "shop", cost: SHOP_COST },
  { id: "pig-blue", label: "Pig", filename: "pig-blue.png", unlockType: "shop", cost: SHOP_COST },
  { id: "duck-blue", label: "Duck", filename: "duck-blue.png", unlockType: "shop", cost: SHOP_COST },
  { id: "raccoon-red", label: "Raccoon", filename: "raccoon-red.png", unlockType: "shop", cost: SHOP_COST },
  { id: "sloth-face-blue", label: "Sloth Face", filename: "sloth-face-blue.png", unlockType: "shop", cost: SHOP_COST },
  { id: "spider-brown", label: "Spider", filename: "spider-brown.png", unlockType: "shop", cost: SHOP_COST },
  { id: "dog-green", label: "Dog", filename: "dog-green.png", unlockType: "shop", cost: SHOP_COST },
  { id: "pig-green", label: "Pig", filename: "pig-green.png", unlockType: "shop", cost: SHOP_COST },
  { id: "llama-blue", label: "Llama", filename: "llama-blue.png", unlockType: "shop", cost: SHOP_COST },
  { id: "snowman-purple", label: "Snowman", filename: "snowman-purple.png", unlockType: "shop", cost: SHOP_COST },
  { id: "bellhop-purple", label: "Bellhop", filename: "bellhop-purple.png", unlockType: "shop", cost: SHOP_COST },
  { id: "koala-purple", label: "Koala", filename: "koala-purple.png", unlockType: "shop", cost: SHOP_COST },
  { id: "sheep-purple", label: "Sheep", filename: "sheep-purple.png", unlockType: "shop", cost: SHOP_COST },
  { id: "reindeer-purple", label: "Reindeer", filename: "reindeer-purple.png", unlockType: "shop", cost: SHOP_COST },
  { id: "kid-purple", label: "Kid", filename: "kid-purple.png", unlockType: "shop", cost: SHOP_COST },
  { id: "bear-purple", label: "Bear", filename: "bear-purple.png", unlockType: "shop", cost: SHOP_COST },
  { id: "kid-winter-purple", label: "Kid", filename: "kid-winter-purple.png", unlockType: "shop", cost: SHOP_COST },
];

// noUncheckedIndexedAccess is on, so [0]?.id is `string | undefined`.
// Defensive fallback to satisfy `string` annotation.
export const DEFAULT_AVATAR_ID: string = AVATAR_OPTIONS[0]?.id ?? "fox-purple";

export function getAvatar(id: string): AvatarOption | undefined {
  return AVATAR_OPTIONS.find((a) => a.id === id);
}
