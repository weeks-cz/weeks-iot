import { describe, expect, it } from "vitest";
import { deviceLinkFormSchema } from "../schema";

const UUID = "3f2b8c1e-5d4a-4c6b-9a1e-0123456789ab";

describe("deviceLinkFormSchema", () => {
  it("normalizuje e-mail", () => {
    const r = deviceLinkFormSchema.parse({ email: " Jana@Seznam.CZ " });
    expect(r.email).toBe("jana@seznam.cz");
  });

  it("neplatný e-mail vrátí chybu u pole email", () => {
    const r = deviceLinkFormSchema.safeParse({ email: "neni-email" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]!.path[0]).toBe("email");
      expect(r.error.issues[0]!.message).toBe("Zkontrolujte prosím e-mail.");
    }
  });

  it("UTM delší než 200 znaků zahodí, chybu nehlásí", () => {
    const r = deviceLinkFormSchema.safeParse({
      email: "a@b.cz",
      utmSource: "x".repeat(201),
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.utmSource).toBeUndefined();
  });

  it("UTM jen z písmen bez diakritiky, číslic a . _ -; jinak zahodí bez chyby", () => {
    const r = deviceLinkFormSchema.safeParse({
      email: "a@b.cz",
      utmSource: "ig",
      utmMedium: "paid_social",
      utmCampaign: "ucebna-2026.11",
      utmContent: "<script>",
      utmTerm: "kampaň s mezerou",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toMatchObject({
      utmSource: "ig",
      utmMedium: "paid_social",
      utmCampaign: "ucebna-2026.11",
    });
    expect(r.data.utmContent).toBeUndefined();
    expect(r.data.utmTerm).toBeUndefined();
    for (const bad of ["a&b", "a=b", "a/b", "a b", "ž", "a\nb"]) {
      const p = deviceLinkFormSchema.safeParse({ email: "a@b.cz", utmCampaign: bad });
      expect(p.success).toBe(true);
      if (p.success) expect(p.data.utmCampaign).toBeUndefined();
    }
  });

  it("souhlas: 'on' je true, jinak false", () => {
    expect(deviceLinkFormSchema.parse({ email: "a@b.cz", marketingConsent: "on" }).marketingConsent).toBe(true);
    expect(deviceLinkFormSchema.parse({ email: "a@b.cz" }).marketingConsent).toBe(false);
  });

  it("env má výchozí 'unknown' a neznámá hodnota na ni spadne", () => {
    expect(deviceLinkFormSchema.parse({ email: "a@b.cz" }).env).toBe("unknown");
    expect(deviceLinkFormSchema.parse({ email: "a@b.cz", env: "tiktok" }).env).toBe("unknown");
    expect(deviceLinkFormSchema.parse({ email: "a@b.cz", env: "instagram" }).env).toBe("instagram");
  });

  it("prázdná pole jsou undefined, eventId musí být uuid", () => {
    const r = deviceLinkFormSchema.parse({ email: "a@b.cz", utmSource: "", eventId: "" });
    expect(r.utmSource).toBeUndefined();
    expect(r.eventId).toBeUndefined();
    expect(deviceLinkFormSchema.parse({ email: "a@b.cz", eventId: UUID }).eventId).toBe(UUID);
    expect(deviceLinkFormSchema.safeParse({ email: "a@b.cz", eventId: "nope" }).success).toBe(false);
  });

  it("honeypot nikdy nehlásí chybu", () => {
    const r = deviceLinkFormSchema.parse({ email: "a@b.cz", hp_field_x: "http://spam" });
    expect(r.hp_field_x).toBe("http://spam");
  });
});
