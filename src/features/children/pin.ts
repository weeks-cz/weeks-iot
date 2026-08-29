import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * PIN profilu dítěte.
 *
 * ── Co se změnilo proti táborovému kiosku ──────────────────────────────────
 * Dnešek má tři úrovně PINů uložené v klientském stavu, s natvrdo zapsanými
 * zálohami 123, 2468 a 321 — kdokoli si je přečte v JS bundlu. Tohle je
 * jejich náhrada a mizí s nimi i jejich role: PIN už není přístupová brána
 * do aplikace, ale přepínač profilu pro rodinu se dvěma dětmi na jednom
 * počítači.
 *
 * ── Proč tedy vůbec hashovat ───────────────────────────────────────────────
 * PIN není bezpečnostní hranice — je to zábrana proti sourozenci, ne proti
 * útočníkovi. Přesto nesmí být divadlo. Čtyři číslice mají jen 10 000
 * možností, takže hash sám o sobě moc nezmůže; co skutečně chrání, je
 * zamčení po pěti pokusech. Hash řeší jiný problém: aby se PIN nedal
 * přečíst z databáze ani z bundlu, protože děti si ho zvolí stejný jako
 * jinde.
 *
 * Celý tenhle modul je serverový. Sloupec `pin_hash` je mimo klientský
 * grant, takže ověření nemůže proběhnout v prohlížeči ani omylem.
 */

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
/* N=16384 je rozumný kompromis pro serverless: ~50 ms na požadavek. Vyšší
   hodnota by u zamykání po pěti pokusech nic nepřidala a jen prodloužila
   studený start. */
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const PIN_LENGTH = 4;
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;

/** Čtyři číslice. Nic jiného — u dětí by delší PIN znamenal jen zapomínání. */
export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/**
 * PINy, které nejsou PIN.
 *
 * Nejde o bezpečnost, ale o to, aby přepínač profilu vůbec něco dělal:
 * když si obě děti zvolí 1234, nepřepíná nic.
 */
const WEAK_PINS = new Set([
  "0000", "1111", "2222", "3333", "4444",
  "5555", "6666", "7777", "8888", "9999",
  "1234", "4321", "1122", "1212", "2121",
  "0123", "9876",
]);

export function isWeakPin(pin: string): boolean {
  return WEAK_PINS.has(pin);
}

/** Formát `scrypt$<sůl v hex>$<klíč v hex>` — sůl na záznam, ne globální. */
export async function hashPin(pin: string): Promise<string> {
  if (!isValidPinFormat(pin)) {
    throw new Error(`PIN musí být ${PIN_LENGTH} číslice`);
  }

  const salt = randomBytes(SALT_LENGTH);
  const key = (await scryptAsync(pin, salt, KEY_LENGTH, SCRYPT_PARAMS)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

/**
 * Ověření PINu.
 *
 * Porovnává se timingSafeEqual, ne ===. U čtyřmístného PINu je časový únik
 * spíš teoretický, ale správné porovnání stojí jeden řádek a špatné se
 * později kopíruje do míst, kde už teoretické není.
 *
 * Nikdy nevyhazuje výjimku — poškozený nebo chybějící hash je „neplatný PIN",
 * ne pád. Výjimka by se v Server Action proměnila v 500 a prozradila by,
 * že u tohohle profilu je s hashem něco jinak.
 */
export async function verifyPin(pin: string, stored: string | null): Promise<boolean> {
  if (!stored || !isValidPinFormat(pin)) return false;

  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const [, saltHex, keyHex] = parts;
  if (!saltHex || !keyHex) return false;

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(keyHex, "hex");
    if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) return false;

    const actual = (await scryptAsync(pin, salt, KEY_LENGTH, SCRYPT_PARAMS)) as Buffer;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export interface PinLockState {
  pin_failed_attempts: number;
  pin_locked_until: string | null;
}

export function isPinLocked(state: PinLockState, now: Date = new Date()): boolean {
  if (!state.pin_locked_until) return false;
  return Date.parse(state.pin_locked_until) > now.getTime();
}

export function pinLockRemainingMs(state: PinLockState, now: Date = new Date()): number {
  if (!state.pin_locked_until) return 0;
  return Math.max(0, Date.parse(state.pin_locked_until) - now.getTime());
}

/**
 * Další stav zámku po neúspěšném pokusu.
 *
 * Počítadlo se nuluje spolu se zamčením — po vypršení zámku dostane člověk
 * zase pět pokusů. Kdyby se nenulovalo, byl by po pátém špatném pokusu
 * profil zamčený navždy po patnáctiminutových krocích.
 */
export function nextLockState(state: PinLockState, now: Date = new Date()): PinLockState {
  const attempts = state.pin_failed_attempts + 1;

  if (attempts >= MAX_PIN_ATTEMPTS) {
    return {
      pin_failed_attempts: 0,
      pin_locked_until: new Date(now.getTime() + PIN_LOCK_MINUTES * 60_000).toISOString(),
    };
  }

  return { pin_failed_attempts: attempts, pin_locked_until: null };
}

export function clearedLockState(): PinLockState {
  return { pin_failed_attempts: 0, pin_locked_until: null };
}
