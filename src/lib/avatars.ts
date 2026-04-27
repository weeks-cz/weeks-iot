import type { AvatarOption } from "@/types";
import { AVATAR_SHOP_CONFIG } from "./config";

const SHOP_COST = AVATAR_SHOP_CONFIG.directUnlockCost;

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: "fox", label: "Fox", filename: "fox.png", unlockType: "default" },
  { id: "bichon", label: "Bichon", filename: "bichon.png", unlockType: "shop", cost: SHOP_COST },
  { id: "sloth", label: "Sloth", filename: "sloth.png", unlockType: "shop", cost: SHOP_COST },
  { id: "weasel", label: "Weasel", filename: "weasel.png", unlockType: "shop", cost: SHOP_COST },
  { id: "rhino", label: "Rhino", filename: "rhino.png", unlockType: "shop", cost: SHOP_COST },
  { id: "koala", label: "Koala", filename: "koala.png", unlockType: "shop", cost: SHOP_COST },
  { id: "alpaca", label: "Alpaca", filename: "alpaca.png", unlockType: "shop", cost: SHOP_COST },
  { id: "lion", label: "Lion", filename: "lion.png", unlockType: "shop", cost: SHOP_COST },
  { id: "cow", label: "Cow", filename: "cow.png", unlockType: "shop", cost: SHOP_COST },
  { id: "horse", label: "Horse", filename: "horse.png", unlockType: "shop", cost: SHOP_COST },
  { id: "beaver", label: "Beaver", filename: "beaver.png", unlockType: "shop", cost: SHOP_COST },
  { id: "zebra", label: "Zebra", filename: "zebra.png", unlockType: "shop", cost: SHOP_COST },
  { id: "dog", label: "Dog", filename: "dog.png", unlockType: "shop", cost: SHOP_COST },
  { id: "hippo", label: "Hippo", filename: "hippo.png", unlockType: "shop", cost: SHOP_COST },
  { id: "camel", label: "Camel", filename: "camel.png", unlockType: "shop", cost: SHOP_COST },
  { id: "giraffe", label: "Giraffe", filename: "giraffe.png", unlockType: "shop", cost: SHOP_COST },
  { id: "sheep", label: "Sheep", filename: "sheep.png", unlockType: "shop", cost: SHOP_COST },
  { id: "pig", label: "Pig", filename: "pig.png", unlockType: "shop", cost: SHOP_COST },
  { id: "duck", label: "Duck", filename: "duck.png", unlockType: "shop", cost: SHOP_COST },
  { id: "raccoon", label: "Raccoon", filename: "raccoon.png", unlockType: "shop", cost: SHOP_COST },
  { id: "spider", label: "Spider", filename: "spider.png", unlockType: "shop", cost: SHOP_COST },
  { id: "llama", label: "Llama", filename: "llama.png", unlockType: "shop", cost: SHOP_COST },
  { id: "reindeer", label: "Reindeer", filename: "reindeer.png", unlockType: "shop", cost: SHOP_COST },
  { id: "bear", label: "Bear", filename: "bear.png", unlockType: "shop", cost: SHOP_COST },
  { id: "eagle", label: "Eagle", filename: "eagle.png", unlockType: "shop", cost: SHOP_COST },
  { id: "frog", label: "Frog", filename: "frog.png", unlockType: "shop", cost: SHOP_COST },
  { id: "hamster", label: "Hamster", filename: "hamster.png", unlockType: "shop", cost: SHOP_COST },
  { id: "ostrich", label: "Ostrich", filename: "ostrich.png", unlockType: "shop", cost: SHOP_COST },
  { id: "penguin", label: "Penguin", filename: "penguin.png", unlockType: "shop", cost: SHOP_COST },
  { id: "puffer-fish", label: "Puffer Fish", filename: "puffer-fish.png", unlockType: "shop", cost: SHOP_COST },
  { id: "rabbit", label: "Rabbit", filename: "rabbit.png", unlockType: "shop", cost: SHOP_COST },
  { id: "sea-lion", label: "Sea Lion", filename: "sea-lion.png", unlockType: "shop", cost: SHOP_COST },
  { id: "shark", label: "Shark", filename: "shark.png", unlockType: "shop", cost: SHOP_COST },
  { id: "swan", label: "Swan", filename: "swan.png", unlockType: "shop", cost: SHOP_COST },
  { id: "monkey", label: "Monkey", filename: "monkey.png", unlockType: "shop", cost: SHOP_COST },
  { id: "meerkat", label: "Meerkat", filename: "meerkat.png", unlockType: "shop", cost: SHOP_COST },
  { id: "red-panda", label: "Red Panda", filename: "red-panda.png", unlockType: "shop", cost: SHOP_COST },
  { id: "walrus", label: "Walrus", filename: "walrus.png", unlockType: "shop", cost: SHOP_COST },
  { id: "tiger", label: "Tiger", filename: "tiger.png", unlockType: "shop", cost: SHOP_COST },
  { id: "lynx", label: "Lynx", filename: "lynx.png", unlockType: "shop", cost: SHOP_COST },
];

// noUncheckedIndexedAccess is on, so [0]?.id is `string | undefined`.
// Defensive fallback to satisfy `string` annotation.
export const DEFAULT_AVATAR_ID: string = AVATAR_OPTIONS[0]?.id ?? "fox";

const LEGACY_AVATAR_IDS: Record<string, string | null> = {
  "fox-purple": "fox",
  "bichon-brown": "bichon",
  "bull-terrier-blue": "dog",
  "sloth-blue": "sloth",
  "sloth-face-blue": "sloth",
  "weasel-brown": "weasel",
  "rhino-red": "rhino",
  "koala-brown": "koala",
  "koala-purple": "koala",
  "alpaca-brown": "alpaca",
  "alpaca-red": "alpaca",
  "lion-green": "lion",
  "cow-brown": "cow",
  "horse-red": "horse",
  "beaver-green": "beaver",
  "zebra-brown": "zebra",
  "dog-blue": "dog",
  "dog-green": "dog",
  "hippo-blue": "hippo",
  "hippo-brown": "hippo",
  "camel-green": "camel",
  "giraffe-blue": "giraffe",
  "sheep-red": "sheep",
  "sheep-purple": "sheep",
  "pig-blue": "pig",
  "pig-green": "pig",
  "duck-blue": "duck",
  "raccoon-red": "raccoon",
  "spider-brown": "spider",
  "llama-blue": "llama",
  "reindeer-purple": "reindeer",
  "bear-purple": "bear",
  "frog-": "frog",
  hamster_5904268: "hamster",
  hamster_8158504: "hamster",
  sloth_9308973: "sloth",
  chimpanzee: "monkey",
  "kid-purple": null,
  "kid-winter-purple": null,
  "snowman-purple": null,
  "bellhop-purple": null,
};

export function getAvatar(id: string): AvatarOption | undefined {
  return AVATAR_OPTIONS.find((a) => a.id === id);
}

export function normalizeAvatarId(id: string | undefined): string {
  if (!id) return DEFAULT_AVATAR_ID;
  const legacy = LEGACY_AVATAR_IDS[id];
  if (legacy === null) return DEFAULT_AVATAR_ID;
  const normalized = legacy ?? id;
  return getAvatar(normalized) ? normalized : DEFAULT_AVATAR_ID;
}
