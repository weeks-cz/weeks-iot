import { z } from "zod";

/** Prázdný řetězec z formuláře = pole nevyplněno. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const UTM_VALUE = /^[A-Za-z0-9._-]+$/;

/**
 * Hodnota UTM z adresy. Neplatnou (jiné znaky, delší než 200) tiše zahodí:
 * UTM rodič nevyplňuje, takže kvůli němu nikdy nesmí vidět chybu. Úzká
 * abeceda zároveň brání tomu, aby se do odkazu v e-mailu dostalo cokoli
 * jiného než označení kampaně.
 */
const utmValue = z
  .unknown()
  .transform((v) => {
    if (typeof v !== "string") return undefined;
    const value = v.trim();
    return value.length <= 200 && UTM_VALUE.test(value) ? value : undefined;
  })
  .optional();

export const deviceLinkFormSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Zkontrolujte prosím e-mail.")
    .email("Zkontrolujte prosím e-mail."),
  /** Zaškrtnuté políčko posílá "on", nezaškrtnuté nic. */
  marketingConsent: z
    .string()
    .optional()
    .transform((v) => v === "on"),
  /**
   * Honeypot. Lidé ho nevidí; vyplněný ho řeší až handler (bot nemá dostat
   * chybu). Název je schválně nic neříkající: pole „website“ by mohlo
   * vyplnit automatické doplňování prohlížeče a rodič by „byl robot“.
   */
  hp_field_x: z.string().optional().default(""),
  utmSource: utmValue,
  utmMedium: utmValue,
  utmCampaign: utmValue,
  utmContent: utmValue,
  utmTerm: utmValue,
  referrer: optionalText(500),
  env: z
    .enum(["facebook", "instagram", "browser", "unknown"])
    .catch("unknown")
    .default("unknown"),
  fbclid: optionalText(255),
  eventId: z
    .string()
    .trim()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type DeviceLinkInput = z.infer<typeof deviceLinkFormSchema>;
