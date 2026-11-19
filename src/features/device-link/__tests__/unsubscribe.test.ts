import { describe, expect, it, vi } from "vitest";
import { unsubscribe, type UnsubscribeStore } from "../unsubscribe";
import { signRequestId } from "../token";
import { DEVICE_LINK_MARKETING_TEXT } from "@/features/consent/texts";

const SECRET = "test-secret-aaaaaaaaaaaaaaaaaaaaaaaa";
const REQ_ID = "3f2b8c1e-5d4a-4c6b-9a1e-0123456789ab";
const NOW = new Date("2026-11-19T10:00:00Z");
const TOKEN = signRequestId(REQ_ID, SECRET);
const CTX = { ip: "1.2.3.4", userAgent: "UA" };

type Row = {
  marketing_consent: boolean;
  unsubscribed_at: string | null;
  anonymized_at: string | null;
};

const CONSENTED: Row = { marketing_consent: true, unsubscribed_at: null, anonymized_at: null };

function setup(initial: Row | null = CONSENTED, consentFails = false) {
  let row = initial;
  const store = {
    find: vi.fn(async (..._a: unknown[]) => row),
    insertConsent: vi.fn(async (..._a: unknown[]) => !consentFails),
    markUnsubscribed: vi.fn(async (_id: string, at: Date) => {
      if (row) row = { ...row, marketing_consent: false, unsubscribed_at: at.toISOString() };
    }),
  } satisfies UnsubscribeStore;
  const run = (token = TOKEN) =>
    unsubscribe(token, CTX, { service: store, secret: () => SECRET, now: NOW });
  return { store, run };
}

describe("unsubscribe", () => {
  it("zapíše právě jeden consent řádek s granted false a pak shodí příznak", async () => {
    const t = setup();
    expect(await t.run()).toBe("done");
    expect(t.store.insertConsent).toHaveBeenCalledTimes(1);
    expect(t.store.insertConsent).toHaveBeenCalledWith({
      parent_id: null,
      child_id: null,
      kind: "marketing",
      version: DEVICE_LINK_MARKETING_TEXT.version,
      text_snapshot: DEVICE_LINK_MARKETING_TEXT.full,
      granted: false,
      ip: "1.2.3.4",
      user_agent: "UA",
      device_link_request_id: REQ_ID,
    });
    expect(t.store.markUnsubscribed).toHaveBeenCalledWith(REQ_ID, NOW);
  });

  it("druhé volání: already, žádný další řádek", async () => {
    const t = setup();
    await t.run();
    expect(await t.run()).toBe("already");
    expect(t.store.insertConsent).toHaveBeenCalledTimes(1);
  });

  it("řádek bez souhlasu: already, nic se nezapisuje", async () => {
    const t = setup({ ...CONSENTED, marketing_consent: false });
    expect(await t.run()).toBe("already");
    expect(t.store.insertConsent).not.toHaveBeenCalled();
  });

  it("unsubscribe of anonymized request is a no-op", async () => {
    const t = setup({ ...CONSENTED, anonymized_at: NOW.toISOString() });
    expect(await t.run()).toBe("already");
    expect(t.store.insertConsent).not.toHaveBeenCalled();
    expect(t.store.markUnsubscribed).not.toHaveBeenCalled();
  });

  it("neexistující řádek: already", async () => {
    const t = setup(null);
    expect(await t.run()).toBe("already");
    expect(t.store.insertConsent).not.toHaveBeenCalled();
  });

  it("neplatný token: invalid bez dotazu do databáze", async () => {
    const t = setup();
    expect(await t.run(`${REQ_ID}.AAAA`)).toBe("invalid");
    expect(t.store.find).not.toHaveBeenCalled();
  });

  it("příznak se nezmění, když doklad nejde zapsat", async () => {
    const t = setup(CONSENTED, true);
    expect(await t.run()).toBe("error");
    expect(t.store.markUnsubscribed).not.toHaveBeenCalled();
  });
});
