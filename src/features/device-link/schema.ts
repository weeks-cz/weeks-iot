import { z } from "zod";

/** Prázdný řetězec z formuláře = pole nevyplněno. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

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
  /** Honeypot. Lidé ho nevidí; vyplněný ho řeší až handler (bot nemá dostat chybu). */
  website: z.string().optional().default(""),
  utmSource: optionalText(200),
  utmMedium: optionalText(200),
  utmCampaign: optionalText(200),
  utmContent: optionalText(200),
  utmTerm: optionalText(200),
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
