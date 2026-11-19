import { describe, expect, it, vi } from "vitest";
import { deviceLinkFormSchema } from "../schema";
import {
  DEDUPE_WINDOW_MS,
  GENERIC_ERROR,
  RATE_LIMIT_ERROR,
  canonicalMailbox,
  emailKey,
  handleDeviceLinkRequest,
  type DeviceLinkStore,
} from "../request";
import { DEVICE_LINK_MARKETING_TEXT } from "@/features/consent/texts";
import { verifyRequestToken } from "../token";

const SECRET = "test-secret-aaaaaaaaaaaaaaaaaaaaaaaa";
const REQ_ID = "3f2b8c1e-5d4a-4c6b-9a1e-0123456789ab";
const NOW = new Date("2026-11-19T10:00:00Z");
const EVENT_ID = "11111111-2222-4333-8444-555555555555";

function input(over: Record<string, unknown> = {}) {
  return deviceLinkFormSchema.parse({
    email: "Jana@Seznam.cz",
    env: "instagram",
    utmSource: "ig",
    utmMedium: "paid",
    utmCampaign: "ucebna",
    eventId: EVENT_ID,
    fbclid: "abc",
    ...over,
  });
}

function setup(opts: { recent?: { id: string; marketing_consent: boolean } | null; sendOk?: boolean; limitDenied?: string; consentFails?: boolean } = {}) {
  const store = {
    findRecentSent: vi.fn(async () => opts.recent ?? null),
    insertRequest: vi.fn(async () => REQ_ID),
    insertConsent: vi.fn(async (..._a: unknown[]) => !opts.consentFails),
    setMarketingConsent: vi.fn(async () => {}),
    markSent: vi.fn(async () => {}),
    markSendError: vi.fn(async () => {}),
    insertEvent: vi.fn(async () => {}),
  } satisfies DeviceLinkStore;
  const send = vi.fn(async (..._a: unknown[]) =>
    opts.sendOk === false ? { ok: false, error: "x" } : { ok: true },
  );
  const meta = vi.fn(async (..._a: unknown[]) => true);
  const limit = vi.fn(async (name: string, _s?: string) => ({
    allowed: name !== opts.limitDenied,
    remaining: 0,
    retryAfterMs: 0,
  }));
  const deps = {
    service: store,
    send,
    meta,
    limit,
    defer: (fn: () => unknown) => void fn(),
    secret: () => SECRET,
  };
  const run = (inp = input(), extra: Record<string, unknown> = {}) =>
    handleDeviceLinkRequest(inp, {
      ip: "1.2.3.4",
      userAgent: "UA",
      fbp: "fb.1.2.3",
      now: NOW,
      deps: { ...deps, ...extra } as never,
    });
  return { store, send, meta, limit, run };
}

describe("handleDeviceLinkRequest", () => {
  it("honeypot: ok, nic se nevolá", async () => {
    const t = setup();
    const r = await t.run(input({ website: "spam" }));
    expect(r.ok).toBe(true);
    expect(t.send).not.toHaveBeenCalled();
    expect(t.store.insertRequest).not.toHaveBeenCalled();
    expect(t.limit).not.toHaveBeenCalled();
  });

  it("se souhlasem zapíše consent, pošle List-Unsubscribe a Lead", async () => {
    const t = setup();
    const r = await t.run(input({ marketingConsent: "on" }));
    expect(r).toEqual({ ok: true, email: "jana@seznam.cz" });

    expect(t.store.insertConsent).toHaveBeenCalledWith({
      parent_id: null,
      child_id: null,
      kind: "marketing",
      version: DEVICE_LINK_MARKETING_TEXT.version,
      text_snapshot: DEVICE_LINK_MARKETING_TEXT.full,
      granted: true,
      ip: "1.2.3.4",
      user_agent: "UA",
      device_link_request_id: REQ_ID,
    });

    const [to, template, , headers] = t.send.mock.calls[0] as unknown as [string, { content: { secondaryLink?: { url: string }; button?: { url: string } } }, unknown, Record<string, string>];
    expect(to).toBe("jana@seznam.cz");
    const unsub = template.content.secondaryLink?.url;
    expect(unsub).toContain("/odhlasit?t=");
    expect(headers["List-Unsubscribe"]).toBe(`<${unsub}>`);
    const token = new URL(unsub!).searchParams.get("t")!;
    expect(verifyRequestToken(token, SECRET)).toBe(REQ_ID);
    expect(template.content.button?.url).toContain("utm_term=odkaz-na-pc");
    expect(template.content.button?.url).toContain("utm_source=ig");

    expect(t.store.insertRequest).toHaveBeenCalledWith(
      expect.objectContaining({ marketing_consent: false }),
    );
    expect(t.store.setMarketingConsent).toHaveBeenCalledWith(REQ_ID);
    expect(t.store.markSent).toHaveBeenCalledWith(REQ_ID, NOW);
    expect(t.meta).toHaveBeenCalledTimes(1);
    const metaArg = t.meta.mock.calls[0]![0] as never as { eventName: string; eventId: string; userData: Record<string, unknown>; eventSourceUrl: string };
    expect(metaArg.eventName).toBe("Lead");
    expect(metaArg.eventId).toBe(EVENT_ID);
    expect(metaArg.userData.email).toBe("jana@seznam.cz");
    expect(metaArg.userData.fbp).toBe("fb.1.2.3");
    expect(metaArg.userData.fbc).toMatch(/^fb\.1\.\d+\.abc$/);
    expect(metaArg.eventSourceUrl).toMatch(/\/pro-rodice$/);

    expect(t.store.insertEvent).toHaveBeenCalledWith("device_link_submit", {
      env: "instagram",
      consent: true,
    });
  });

  it("bez souhlasu: žádný consent, meta ani hlavička", async () => {
    const t = setup();
    await t.run();
    expect(t.store.insertConsent).not.toHaveBeenCalled();
    expect(t.meta).not.toHaveBeenCalled();
    const [, template, , headers] = t.send.mock.calls[0] as unknown as [string, { content: { secondaryLink?: unknown } }, unknown, Record<string, string>];
    expect(headers).toEqual({});
    expect(template.content.secondaryLink).toBeUndefined();
    expect(t.store.insertEvent).toHaveBeenCalledWith("device_link_submit", {
      env: "instagram",
      consent: false,
    });
  });

  it("událost nenese e-mail", async () => {
    const t = setup();
    await t.run(input({ marketingConsent: "on" }));
    expect(JSON.stringify(t.store.insertEvent.mock.calls)).not.toContain("seznam");
  });

  it("selhání odeslání: výsledek ok, send_error se zapíše", async () => {
    const t = setup({ sendOk: false });
    const r = await t.run();
    expect(r.ok).toBe(true);
    expect(t.store.markSendError).toHaveBeenCalledWith(REQ_ID, "x");
    expect(t.store.markSent).not.toHaveBeenCalled();
  });

  it("dedupe: do 10 minut další e-mail neodejde", async () => {
    const t = setup({ recent: { id: "old", marketing_consent: false } });
    const r = await t.run();
    expect(r.ok).toBe(true);
    expect(t.send).not.toHaveBeenCalled();
    expect(t.store.insertRequest).not.toHaveBeenCalled();
    const since = t.store.findRecentSent.mock.calls[0] as unknown as [string, Date];
    expect(since[1].getTime()).toBe(NOW.getTime() - DEDUPE_WINDOW_MS);
  });

  it("dedupe se souhlasem napodruhé: consent k existujícímu řádku, e-mail neodejde", async () => {
    const t = setup({ recent: { id: "old", marketing_consent: false } });
    await t.run(input({ marketingConsent: "on" }));
    expect(t.send).not.toHaveBeenCalled();
    expect(t.store.insertRequest).not.toHaveBeenCalled();
    expect(t.store.insertConsent).toHaveBeenCalledWith(
      expect.objectContaining({ device_link_request_id: "old", kind: "marketing", granted: true }),
    );
    expect(t.store.setMarketingConsent).toHaveBeenCalledWith("old");
  });

  it("dedupe: řádek, který už souhlas má, ho nezapisuje podruhé", async () => {
    const t = setup({ recent: { id: "old", marketing_consent: true } });
    await t.run(input({ marketingConsent: "on" }));
    expect(t.store.insertConsent).not.toHaveBeenCalled();
    expect(t.store.setMarketingConsent).not.toHaveBeenCalled();
  });

  it("rate limit e-mailu vrátí chybu a nic nezapíše", async () => {
    const t = setup({ limitDenied: "deviceLinkEmail" });
    const r = await t.run();
    expect(r).toEqual({ ok: false, error: RATE_LIMIT_ERROR });
    expect(t.store.insertRequest).not.toHaveBeenCalled();
    expect(t.send).not.toHaveBeenCalled();
  });

  it("rate limit IP vrátí chybu dřív než se zkusí e-mail", async () => {
    const t = setup({ limitDenied: "deviceLinkIp" });
    const r = await t.run();
    expect(r).toEqual({ ok: false, error: RATE_LIMIT_ERROR });
    expect(t.limit).toHaveBeenCalledTimes(1);
  });

  it("e-mail v rate limitu je hashovaný", async () => {
    const t = setup();
    await t.run();
    const emailCall = t.limit.mock.calls.find((c) => c[0] === "deviceLinkEmail")!;
    expect(emailCall[1]).not.toContain("seznam");
  });

  it("selhal zápis souhlasu (první žádost): příznak se nenastaví, bez odhlášení a bez Lead", async () => {
    const t = setup({ consentFails: true });
    const r = await t.run(input({ marketingConsent: "on" }));
    expect(r.ok).toBe(true);
    expect(t.store.setMarketingConsent).not.toHaveBeenCalled();
    expect(t.store.insertRequest).toHaveBeenCalledWith(
      expect.objectContaining({ marketing_consent: false }),
    );
    const [, template, , headers] = t.send.mock.calls[0] as unknown as [string, { content: { secondaryLink?: unknown } }, unknown, Record<string, string>];
    expect(headers).toEqual({});
    expect(template.content.secondaryLink).toBeUndefined();
    expect(t.meta).not.toHaveBeenCalled();
    expect(t.store.insertEvent).toHaveBeenCalledWith("device_link_submit", {
      env: "instagram",
      consent: false,
    });
  });

  it("selhal zápis souhlasu (dedupe): příznak se nenastaví", async () => {
    const t = setup({ recent: { id: "old", marketing_consent: false }, consentFails: true });
    const r = await t.run(input({ marketingConsent: "on" }));
    expect(r.ok).toBe(true);
    expect(t.store.insertConsent).toHaveBeenCalledTimes(1);
    expect(t.store.setMarketingConsent).not.toHaveBeenCalled();
  });

  it("bez eventId z prohlížeče se Lead neposílá", async () => {
    const t = setup();
    await t.run(input({ marketingConsent: "on", eventId: "" }));
    expect(t.store.insertConsent).toHaveBeenCalled();
    expect(t.meta).not.toHaveBeenCalled();
  });

  it("chybějící secret nespotřebuje rate limit ani nic nezapíše", async () => {
    const t = setup();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await t.run(input(), {
      secret: () => {
        throw new Error("x");
      },
    });
    spy.mockRestore();
    expect(t.limit).not.toHaveBeenCalled();
  });

  it("chybějící secret: obecná chyba, žádný zápis", async () => {
    const t = setup();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await t.run(input(), {
      secret: () => {
        throw new Error("DEVICE_LINK_SECRET není nastaven.");
      },
    });
    spy.mockRestore();
    expect(r).toEqual({ ok: false, error: GENERIC_ERROR });
    expect(t.store.insertRequest).not.toHaveBeenCalled();
    expect(t.send).not.toHaveBeenCalled();
  });
});

describe("canonicalMailbox", () => {
  it("gmail tečky, +tag a googlemail dávají stejný klíč", () => {
    expect(canonicalMailbox("jana.novak+x@gmail.com")).toBe("jananovak@gmail.com");
    expect(canonicalMailbox("JanaNovak@googlemail.com")).toBe("jananovak@gmail.com");
    expect(emailKey("jana.novak+x@gmail.com", SECRET)).toBe(
      emailKey("JanaNovak@googlemail.com", SECRET),
    );
  });

  it("jiné domény: jen +tag, tečky zůstávají", () => {
    expect(canonicalMailbox("jana+x@seznam.cz")).toBe("jana@seznam.cz");
    expect(canonicalMailbox("jana.novak@seznam.cz")).toBe("jana.novak@seznam.cz");
  });

  it("klíč je HMAC: závisí na secretu a neobsahuje e-mail", () => {
    const k = emailKey("jana@seznam.cz", SECRET);
    expect(k).not.toBe(emailKey("jana@seznam.cz", "jiny-secret-bbbbbbbbbbbbbbbbbbbbbbbb"));
    expect(k).toMatch(/^[0-9a-f]{32}$/);
  });
});
