import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Supabase úložiště odkazu na počítač. Ostatní testy je nahrazují falešným
 * úložištěm, takže podmínky dotazů (WHERE) hlídá až tenhle soubor: klient je
 * podvržený a jen zaznamenává volání, do databáze nic nejde.
 */

type Call = [method: string, args: unknown[]];
const calls: Call[] = [];
let result: { data: unknown; error: { message: string } | null } = { data: [], error: null };

function builder(): unknown {
  const proxy: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
            Promise.resolve(result).then(res, rej);
        }
        return (...args: unknown[]) => {
          calls.push([String(prop), args]);
          return proxy;
        };
      },
    },
  );
  return proxy;
}

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from(table: string) {
      calls.push(["from", [table]]);
      return builder();
    },
  }),
}));

import { supabaseJobsStore } from "../jobs";
import { supabaseUnsubscribeStore } from "../unsubscribe";

const ID = "3f2b8c1e-5d4a-4c6b-9a1e-0123456789ab";
const AT = new Date("2026-11-19T10:00:00Z");

beforeEach(() => {
  calls.length = 0;
  result = { data: [], error: null };
});

describe("supabaseJobsStore", () => {
  it("claimReminder nárokuje jen řádek, který připomínku pořád smí dostat", async () => {
    result = { data: [{ id: ID }], error: null };
    expect(await supabaseJobsStore().claimReminder(ID, AT)).toBe(true);
    expect(calls).toContainEqual(["update", [{ reminder_sent_at: AT.toISOString() }]]);
    for (const filter of [
      ["eq", ["id", ID]],
      ["is", ["reminder_sent_at", null]],
      ["eq", ["marketing_consent", true]],
      ["is", ["unsubscribed_at", null]],
      ["is", ["opened_at", null]],
      ["is", ["anonymized_at", null]],
    ] as Call[]) {
      expect(calls).toContainEqual(filter);
    }
  });

  it("claimReminder bez dotčeného řádku: nárok nezískán", async () => {
    result = { data: [], error: null };
    expect(await supabaseJobsStore().claimReminder(ID, AT)).toBe(false);
  });

  it("anonymize maže e-mail i send_error", async () => {
    expect(await supabaseJobsStore().anonymize(ID, AT)).toBe(true);
    expect(calls).toContainEqual([
      "update",
      [{ email: null, send_error: null, anonymized_at: AT.toISOString() }],
    ]);
    expect(calls).toContainEqual(["is", ["anonymized_at", null]]);
  });

  it("siblingsByEmail hledá podle adresy bez filtru stavu a stáří", async () => {
    result = { data: [{ id: ID }], error: null };
    expect(await supabaseJobsStore().siblingsByEmail(["jana@seznam.cz"])).toEqual([{ id: ID }]);
    expect(calls).toContainEqual(["in", ["email", ["jana@seznam.cz"]]]);
    const filters = calls.filter(([m]) => ["eq", "is", "gte", "lte", "lt", "not", "or"].includes(m));
    expect(filters).toEqual([]);
  });

  it("siblingsByEmail chybu hází, nevrací prázdný seznam", async () => {
    result = { data: null, error: { message: "db" } };
    await expect(supabaseJobsStore().siblingsByEmail(["a@b.cz"])).rejects.toThrow("db");
  });
});

describe("supabaseUnsubscribeStore", () => {
  it("findSiblings: stejná adresa, jiná žádost, se souhlasem a neodhlášená", async () => {
    result = { data: [{ id: "x" }], error: null };
    expect(await supabaseUnsubscribeStore().findSiblings("jana@seznam.cz", ID)).toEqual(["x"]);
    for (const filter of [
      ["eq", ["email", "jana@seznam.cz"]],
      ["neq", ["id", ID]],
      ["eq", ["marketing_consent", true]],
      ["is", ["unsubscribed_at", null]],
    ] as Call[]) {
      expect(calls).toContainEqual(filter);
    }
  });

  it("findSiblings chybu hází", async () => {
    result = { data: null, error: { message: "db" } };
    await expect(supabaseUnsubscribeStore().findSiblings("a@b.cz", ID)).rejects.toThrow("db");
  });

  it("find čte i e-mail (kvůli dalším žádostem na stejnou adresu)", async () => {
    result = { data: null, error: null };
    await supabaseUnsubscribeStore().find(ID);
    const select = calls.find(([m]) => m === "select");
    expect(String(select?.[1][0])).toMatch(/\bemail\b/);
  });
});
