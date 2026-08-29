import { describe, expect, it } from "vitest";
import {
  MAX_PIN_ATTEMPTS,
  PIN_LOCK_MINUTES,
  clearedLockState,
  hashPin,
  isPinLocked,
  isValidPinFormat,
  isWeakPin,
  nextLockState,
  pinLockRemainingMs,
  verifyPin,
} from "../pin";

describe("isValidPinFormat", () => {
  it("přijme čtyři číslice", () => {
    expect(isValidPinFormat("0000")).toBe(true);
    expect(isValidPinFormat("9137")).toBe(true);
  });

  it("odmítne jinou délku", () => {
    expect(isValidPinFormat("123")).toBe(false);
    expect(isValidPinFormat("12345")).toBe(false);
    expect(isValidPinFormat("")).toBe(false);
  });

  it("odmítne nečíslice", () => {
    expect(isValidPinFormat("12a4")).toBe(false);
    expect(isValidPinFormat("12 4")).toBe(false);
    expect(isValidPinFormat("+123")).toBe(false);
  });

  it("odmítne vícerádkový vstup", () => {
    // Kotvy ^$ v JS bez /m nechají projít "1234\n" u $ — regex musí být těsný.
    expect(isValidPinFormat("1234\n")).toBe(false);
    expect(isValidPinFormat("\n1234")).toBe(false);
  });
});

describe("isWeakPin", () => {
  it("odmítne opakované číslice a řady", () => {
    expect(isWeakPin("0000")).toBe(true);
    expect(isWeakPin("1111")).toBe(true);
    expect(isWeakPin("1234")).toBe(true);
    expect(isWeakPin("4321")).toBe(true);
  });

  it("pustí běžný PIN", () => {
    expect(isWeakPin("9137")).toBe(false);
    expect(isWeakPin("2748")).toBe(false);
  });
});

describe("hashPin / verifyPin", () => {
  it("ověří správný PIN", async () => {
    const hash = await hashPin("9137");
    await expect(verifyPin("9137", hash)).resolves.toBe(true);
  });

  it("odmítne špatný PIN", async () => {
    const hash = await hashPin("9137");
    await expect(verifyPin("9138", hash)).resolves.toBe(false);
    await expect(verifyPin("0000", hash)).resolves.toBe(false);
  });

  it("stejný PIN dává pokaždé jiný hash", async () => {
    // Sůl na záznam. Bez ní by shodný hash prozradil, že dvě děti mají
    // stejný PIN, a umožnil předpočítanou tabulku pro všech 10 000 hodnot.
    const a = await hashPin("9137");
    const b = await hashPin("9137");
    expect(a).not.toBe(b);
    await expect(verifyPin("9137", a)).resolves.toBe(true);
    await expect(verifyPin("9137", b)).resolves.toBe(true);
  });

  it("hash neobsahuje PIN v čitelné podobě", async () => {
    const hash = await hashPin("9137");
    expect(hash).not.toContain("9137");
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  it("profil bez PINu se neověří", async () => {
    await expect(verifyPin("9137", null)).resolves.toBe(false);
  });

  it("poškozený hash vrátí false, ne výjimku", async () => {
    // V Server Action by výjimka znamenala 500 a prozradila by, že
    // u tohohle profilu je s hashem něco jinak.
    await expect(verifyPin("9137", "")).resolves.toBe(false);
    await expect(verifyPin("9137", "nesmysl")).resolves.toBe(false);
    await expect(verifyPin("9137", "scrypt$zzz$zzz")).resolves.toBe(false);
    await expect(verifyPin("9137", "scrypt$abcd$ef")).resolves.toBe(false);
    await expect(verifyPin("9137", "bcrypt$aa$bb")).resolves.toBe(false);
    await expect(verifyPin("9137", "scrypt$only-two")).resolves.toBe(false);
  });

  it("neplatný formát PINu se neověřuje vůbec", async () => {
    const hash = await hashPin("9137");
    await expect(verifyPin("913", hash)).resolves.toBe(false);
    await expect(verifyPin("91377", hash)).resolves.toBe(false);
    await expect(verifyPin("", hash)).resolves.toBe(false);
  });

  it("odmítne uložit PIN ve špatném formátu", async () => {
    await expect(hashPin("12")).rejects.toThrow();
    await expect(hashPin("abcd")).rejects.toThrow();
  });
});

describe("zamykání po neúspěšných pokusech", () => {
  const now = new Date("2026-08-29T20:00:00Z");

  it("první pokusy jen zvyšují počítadlo", () => {
    let state = clearedLockState();
    for (let i = 1; i < MAX_PIN_ATTEMPTS; i++) {
      state = nextLockState(state, now);
      expect(state.pin_failed_attempts).toBe(i);
      expect(state.pin_locked_until).toBeNull();
      expect(isPinLocked(state, now)).toBe(false);
    }
  });

  it("pátý pokus zamkne profil", () => {
    let state = clearedLockState();
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) state = nextLockState(state, now);

    expect(state.pin_locked_until).not.toBeNull();
    expect(isPinLocked(state, now)).toBe(true);
    expect(pinLockRemainingMs(state, now)).toBe(PIN_LOCK_MINUTES * 60_000);
  });

  it("po zamčení se počítadlo nuluje", () => {
    // Kdyby se nenulovalo, byl by profil po pátém špatném pokusu zamčený
    // navždy po patnáctiminutových krocích.
    let state = clearedLockState();
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) state = nextLockState(state, now);
    expect(state.pin_failed_attempts).toBe(0);
  });

  it("zámek vyprší a pustí dál", () => {
    let state = clearedLockState();
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) state = nextLockState(state, now);

    const later = new Date(now.getTime() + (PIN_LOCK_MINUTES + 1) * 60_000);
    expect(isPinLocked(state, later)).toBe(false);
    expect(pinLockRemainingMs(state, later)).toBe(0);
  });

  it("profil bez zámku není zamčený", () => {
    expect(isPinLocked(clearedLockState(), now)).toBe(false);
    expect(pinLockRemainingMs(clearedLockState(), now)).toBe(0);
  });

  it("úspěšné ověření vyčistí i zámek, nejen počítadlo", () => {
    expect(clearedLockState()).toEqual({ pin_failed_attempts: 0, pin_locked_until: null });
  });
});
