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

/** Nejstarší a nejmladší přípustné datum narození. */
export function birthDateRange(now: Date = new Date()): { min: string; max: string } {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return { min: `${y - MAX_AGE}-${m}-${d}`, max: `${y - MIN_AGE}-${m}-${d}` };
}

/**
 * Přesný věk v celých letech.
 *
 * Počítá se z data, ne z ročníku. Rozdíl ročníků je totiž nespolehlivý:
 * dítě narozené 20. 12. 2011 mělo 29. 8. 2026 teprve 14 let a 8 měsíců,
 * ale 2026 − 2011 dá 15. Na tom závisí, kdo smí podepsat souhlas, takže
 * to musí sedět na den.
 *
 * Vše v UTC — datum narození je prostý den bez času a míchání s místním
 * pásmem by u lidí narozených kolem půlnoci posunulo věk o den.
 */
export function ageOn(birthDate: string, now: Date = new Date()): number {
  const born = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(born.getTime())) return Number.NaN;

  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - born.getUTCMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < born.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function needsParentalConsent(birthDate: string, now: Date = new Date()): boolean {
  const age = ageOn(birthDate, now);
  /* Nečitelné datum ať radši spadne na přísnější variantu než na volnější. */
  if (Number.isNaN(age)) return true;
  return age < DIGITAL_CONSENT_AGE;
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

export const birthDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Zadejte datum narození")
  .refine((value) => {
    /* Regex pustí i 2026-02-31. Zpětný převod odhalí, že takový den
       neexistuje — Date by ho tiše posunul na 3. března. */
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }, "Takové datum neexistuje")
  .refine((value) => {
    const age = ageOn(value);
    return age >= MIN_AGE && age <= MAX_AGE;
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
export const onboardingSchema = z
  .object({
    regionCode: regionSchema,
    childNick: nickSchema,
    childBirthDate: birthDateSchema,
    childAvatar: avatarSchema.optional(),

    acceptTerms: z.literal(true, {
      message: "Bez potvrzení podmínek nejde účet založit",
    }),
    /* Jeden z těch dvou musí být true — který, rozhoduje věk. Nejde to
       vyjádřit jako z.literal(true) u obou, protože pak by nešlo projít
       nikdy: nikdo nedává oba souhlasy naráz. */
    parentalConsent: z.boolean().default(false),
    selfConsent: z.boolean().default(false),
    marketingConsent: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (needsParentalConsent(data.childBirthDate)) {
      if (!data.parentalConsent) {
        ctx.addIssue({
          code: "custom",
          path: ["parentalConsent"],
          message: "Bez souhlasu zákonného zástupce nemůžeme údaje dítěte zpracovávat",
        });
      }
      return;
    }

    if (!data.selfConsent) {
      ctx.addIssue({
        code: "custom",
        path: ["selfConsent"],
        message: "Bez souhlasu nemůžeme tvoje údaje zpracovávat",
      });
    }
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
  birthDate: birthDateSchema,
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
