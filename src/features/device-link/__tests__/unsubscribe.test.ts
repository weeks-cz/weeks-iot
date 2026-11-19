import { describe, expect, it, vi } from "vitest";
import { unsubscribe, type UnsubscribeStore } from "../unsubscribe";
import { signRequestId } from "../token";
import { DEVICE_LINK_MARKETING_TEXT } from "@/features/consent/texts";

const SECRET = "test-secret-aaaaaaaaaaaaaaaaaaaaaaaa";
const REQ_ID = "3f2b8c1e-5d4a-4c6b-9a1e-0123456789ab";
const NOW = new Date("2026-11-19T10:00:00Z");
const TOKEN = signRequestId(REQ_ID, SECRET, "unsub");
const CTX = { ip: "1.2.3.4", userAgent: "UA" };

type Row = {
  email: string | null;
  marketing_consent: boolean;
  unsubscribed_at: string | null;
  anonymized_at: string | null;
};

const CONSENTED: Row = {
  email: "jana@seznam.cz",
  marketing_consent: true,
  unsubscribed_at: null,
  anonymized_at: null,
};

function setup(
  initial: Row | null = CONSENTED,
  consentFails = false,
  flagFails = false,
  findFails = false,
  opts: { siblings?: string[]; siblingsFail?: boolean } = {},
) {
  let row = initial;
  let siblings = opts.siblings ?? [];
  const store = {
    find: vi.fn(async (..._a: unknown[]) => {
      if (findFails) throw new Error("db");
      return row;
    }),
    findSiblings: vi.fn(async (..._a: unknown[]) => {
      if (opts.siblingsFail) throw new Error("db");
      return siblings;
    }),
    insertConsent: vi.fn(async (..._a: unknown[]) => !consentFails),
    markUnsubscribed: vi.fn(async (id: string, at: Date) => {
      if (flagFails) return false;
      if (id === REQ_ID && row) {
        row = { ...row, marketing_consent: false, unsubscribed_at: at.toISOString() };
      }
      siblings = siblings.filter((s) => s !== id);
      return true;
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

  it("token z odkazu do lekce odhlášení neprovede", async () => {
    const t = setup();
    expect(await t.run(signRequestId(REQ_ID, SECRET, "open"))).toBe("invalid");
    expect(t.store.find).not.toHaveBeenCalled();
  });

  it("příznak se nezmění, když doklad nejde zapsat", async () => {
    const t = setup(CONSENTED, true);
    expect(await t.run()).toBe("error");
    expect(t.store.markUnsubscribed).not.toHaveBeenCalled();
  });

  it("chyba čtení z databáze: error, ne already", async () => {
    const t = setup(CONSENTED, false, false, true);
    expect(await t.run()).toBe("error");
    expect(t.store.insertConsent).not.toHaveBeenCalled();
  });

  it("doklad zapsán, ale příznak se nepodařilo shodit: error, ne done", async () => {
    const t = setup(CONSENTED, false, true);
    expect(await t.run()).toBe("error");
    expect(t.store.insertConsent).toHaveBeenCalledTimes(1);
  });
});

describe("unsubscribe – víc žádostí na stejnou adresu", () => {
  const SIBLING = "aaaaaaaa-5d4a-4c6b-9a1e-0123456789ab";
  const requestIds = (calls: unknown[][]) =>
    calls.map(([r]) => (r as { device_link_request_id: string }).device_link_request_id);

  it("odvolá i druhou žádost: doklad i příznak pro každou", async () => {
    const t = setup(CONSENTED, false, false, false, { siblings: [SIBLING] });
    expect(await t.run()).toBe("done");
    expect(t.store.findSiblings).toHaveBeenCalledWith("jana@seznam.cz", REQ_ID);
    expect(requestIds(t.store.insertConsent.mock.calls)).toEqual([REQ_ID, SIBLING]);
    for (const [r] of t.store.insertConsent.mock.calls) {
      expect(r).toMatchObject({ granted: false, kind: "marketing" });
    }
    expect(t.store.markUnsubscribed.mock.calls.map(([id]) => id).sort()).toEqual(
      [REQ_ID, SIBLING].sort(),
    );
  });

  it("kliknutý řádek se shodí až nakonec (opakování pak nenarazí na „už odhlášeno“)", async () => {
    const t = setup(CONSENTED, false, false, false, { siblings: [SIBLING] });
    await t.run();
    const order = t.store.markUnsubscribed.mock.calls.map(([id]) => id);
    expect(order[order.length - 1]).toBe(REQ_ID);
  });

  it("selže doklad u druhé žádosti: error, žádný příznak se nemění", async () => {
    const t = setup(CONSENTED, false, false, false, { siblings: [SIBLING] });
    t.store.insertConsent.mockImplementation(
      async (r: unknown) =>
        (r as { device_link_request_id: string }).device_link_request_id !== SIBLING,
    );
    expect(await t.run()).toBe("error");
    expect(t.store.markUnsubscribed).not.toHaveBeenCalled();
  });

  it("selže příznak u druhé žádosti: error, kliknutý řádek zůstane neodhlášený", async () => {
    const t = setup(CONSENTED, false, false, false, { siblings: [SIBLING] });
    t.store.markUnsubscribed.mockImplementation(async (id: string) => id !== SIBLING);
    expect(await t.run()).toBe("error");
    expect(t.store.markUnsubscribed).not.toHaveBeenCalledWith(REQ_ID, NOW);
  });

  it("chyba při hledání dalších žádostí: error, nic se nezapíše", async () => {
    const t = setup(CONSENTED, false, false, false, { siblingsFail: true });
    expect(await t.run()).toBe("error");
    expect(t.store.insertConsent).not.toHaveBeenCalled();
    expect(t.store.markUnsubscribed).not.toHaveBeenCalled();
  });

  it("kliknutý řádek už odhlášený, další žádost má souhlas: odvolá ji (done)", async () => {
    const t = setup(
      { ...CONSENTED, marketing_consent: false, unsubscribed_at: NOW.toISOString() },
      false,
      false,
      false,
      { siblings: [SIBLING] },
    );
    expect(await t.run()).toBe("done");
    expect(requestIds(t.store.insertConsent.mock.calls)).toEqual([SIBLING]);
    expect(t.store.markUnsubscribed).toHaveBeenCalledWith(SIBLING, NOW);
    expect(t.store.markUnsubscribed).not.toHaveBeenCalledWith(REQ_ID, NOW);
  });

  it("anonymizovaný řádek (bez e-mailu) další žádosti nehledá", async () => {
    const t = setup({ ...CONSENTED, email: null, anonymized_at: NOW.toISOString() });
    expect(await t.run()).toBe("already");
    expect(t.store.findSiblings).not.toHaveBeenCalled();
  });
});
