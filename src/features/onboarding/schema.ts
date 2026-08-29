import { z } from "zod";
import { REGION_CODES } from "@/lib/regions";

/**
 * Validace registrace a onboardingu.
 *
 * Schéma je jediný zdroj pravdy o tvaru vstupu — formulář z něj čerpá
 * i chybové hlášky, takže se klientská a serverová kontrola nemůžou
 * rozejít. Server validuje vždy znovu; klientská validace je pohodlí,
 * ne bezpečnost.
 */

/* Věkové pásmo. 10–15 je cílová skupina, hranice jsou o rok širší, aby
   se neodmítalo dítě, které má za měsíc narozeniny, ani sourozenec,
   který se veze s ním. */
export const MIN_AGE = 6;
export const MAX_AGE = 18;

/** Věk souhlasu podle § 7 zák. č. 110/2019 Sb. */
export const DIGITAL_CONSENT_AGE = 15;

export function currentYear(now: Date = new Date()): number {
  return now.getUTCFullYear();
}

export function birthYearRange(now: Date = new Date()): { min: number; max: number } {
  const year = currentYear(now);
  return { min: year - MAX_AGE, max: year - MIN_AGE };
}

/** Přibližný věk z roku narození. Přesnější to být nemá — datum neukládáme. */
export function approximateAge(birthYear: number, now: Date = new Date()): number {
  return currentYear(now) - birthYear;
}

export function needsParentalConsent(birthYear: number, now: Date = new Date()): boolean {
  return approximateAge(birthYear, now) < DIGITAL_CONSENT_AGE;
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, "Zadejte e-mailovou adresu")
  .max(254, "E-mailová adresa je příliš dlouhá")
  .email("Tohle nevypadá jako e-mailová adresa");

/**
 * Heslo.
 *
 * Délka místo skladby znaků. Požadavek na velké písmeno, číslici a symbol
 * lidi spolehlivě dotlačí k „Heslo123!" — což je horší než „modrykonvalinka".
 * NIST to doporučuje od roku 2017 a je to i méně otravné na telefonu.
 */
export const MIN_PASSWORD_LENGTH = 10;

/* Kontrola proti plnému seznamu úniků by znamenala volání do Have I Been
   Pwned na každý pokus. Tohle je levná pojistka proti tomu, co lidé
   opravdu píšou, když je formulář nutí do deseti znaků. */
const COMMON_PASSWORDS = new Set([
  "heslo12345", "heslo123456", "password12", "password123", "1234567890",
  "qwertyuiop", "12345678910", "heslo123456789", "administrator",
  "abcdefghij", "aaaaaaaaaa", "0987654321", "qwertzuiop", "asdfghjkl1",
]);

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Heslo musí mít aspoň ${MIN_PASSWORD_LENGTH} znaků`)
  .max(128, "Heslo je příliš dlouhé")
  .refine(
    (value) => !COMMON_PASSWORDS.has(value.toLowerCase()),
    "Tohle heslo je příliš časté. Zkuste třeba tři náhodná slova za sebou.",
  );

export const regionSchema = z.enum(REGION_CODES, {
  message: "Vyberte kraj",
});

export const nickSchema = z
  .string()
  .trim()
  .min(1, "Zadejte přezdívku")
  .max(24, "Přezdívka může mít nejvýš 24 znaků")
  .refine((v) => !/^\s*$/.test(v), "Zadejte přezdívku");

export const birthYearSchema = z.coerce
  .number()
  .int("Zadejte rok narození")
  .refine((year) => {
    const { min, max } = birthYearRange();
    return year >= min && year <= max;
  }, `Učebna je pro děti od ${MIN_AGE} do ${MAX_AGE} let`);

export const avatarSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^[a-z0-9-]+$/, "Neplatný avatar")
  .default("robot");

/**
 * Celý onboarding.
 *
 * Souhlasy jsou tři nezávislá pole. Sdružené „souhlasím se vším" by bylo
 * podle čl. 7 odst. 2 GDPR neplatné — souhlas musí být konkrétní
 * a oddělitelný. Obchodní sdělení proto smí zůstat false.
 */
export const onboardingSchema = z.object({
  regionCode: regionSchema,
  childNick: nickSchema,
  childBirthYear: birthYearSchema,
  childAvatar: avatarSchema.optional(),

  acceptTerms: z.literal(true, {
    message: "Bez potvrzení podmínek nejde účet založit",
  }),
  parentalConsent: z.literal(true, {
    message: "Bez souhlasu zákonného zástupce nemůžeme údaje dítěte zpracovávat",
  }),
  marketingConsent: z.boolean().default(false),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Zadejte heslo"),
});

export const magicLinkSchema = z.object({ email: emailSchema });

export const resetRequestSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Hesla se neshodují",
    path: ["confirm"],
  });

export const childSchema = z.object({
  nick: nickSchema,
  birthYear: birthYearSchema,
  avatar: avatarSchema.optional(),
});

export const waitlistSchema = z.object({
  city: z
    .string()
    .trim()
    .min(2, "Zadejte město")
    .max(80, "Název města je příliš dlouhý"),
  regionCode: regionSchema.optional(),
  email: emailSchema.optional(),
});
