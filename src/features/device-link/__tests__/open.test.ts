import { describe, expect, it, vi } from "vitest";
import { markOpened, type OpenStore } from "../open";
import { signRequestId } from "../token";

const SECRET = "test-secret-aaaaaaaaaaaaaaaaaaaaaaaa";
const REQ_ID = "3f2b8c1e-5d4a-4c6b-9a1e-0123456789ab";
const NOW = new Date("2026-11-19T10:00:00Z");
const TOKEN = signRequestId(REQ_ID, SECRET);

function setup(opts: { alreadyOpened?: boolean } = {}) {
  const store = {
    setVerified: vi.fn(async (..._a: unknown[]) => {}),
    setOpened: vi.fn(async (..._a: unknown[]) => !opts.alreadyOpened),
    insertEvent: vi.fn(async (..._a: unknown[]) => {}),
  } satisfies OpenStore;
  const run = (token = TOKEN, device: "computer" | "phone" = "computer", env = "browser") =>
    markOpened(token, device, env, { service: store, secret: () => SECRET, now: NOW });
  return { store, run };
}

describe("markOpened", () => {
  it("opened_at se nastaví jednou: první otevření na počítači", async () => {
    const t = setup();
    expect(await t.run()).toBe("opened");
    expect(t.store.setOpened).toHaveBeenCalledWith(REQ_ID, NOW);
    expect(t.store.setVerified).toHaveBeenCalledWith(REQ_ID, NOW);
  });

  it("druhé otevření na počítači: already, opened_at se nepřepisuje", async () => {
    const t = setup({ alreadyOpened: true });
    expect(await t.run()).toBe("already");
    /* setOpened je podmíněný update (where opened_at is null) a vrací,
       jestli něco změnil; fake říká, že ne. */
    expect(t.store.setOpened).toHaveBeenCalledTimes(1);
  });

  it("otevření na telefonu nenastaví opened_at, ale ověří schránku", async () => {
    const t = setup();
    expect(await t.run(TOKEN, "phone")).toBe("phone");
    expect(t.store.setOpened).not.toHaveBeenCalled();
    expect(t.store.setVerified).toHaveBeenCalledWith(REQ_ID, NOW);
  });

  it("událost nemá anon_id ani id žádosti, jen device a env", async () => {
    const t = setup();
    await t.run(TOKEN, "computer", "instagram");
    expect(t.store.insertEvent).toHaveBeenCalledWith("device_link_open", {
      device: "computer",
      env: "instagram",
    });
    const written = JSON.stringify(t.store.insertEvent.mock.calls);
    expect(written).not.toContain(REQ_ID);
    expect(written).not.toContain("anon");
  });

  it("událost se zapíše i na telefonu a při opakovaném otevření", async () => {
    const t = setup({ alreadyOpened: true });
    await t.run(TOKEN, "phone");
    await t.run(TOKEN, "computer");
    expect(t.store.insertEvent).toHaveBeenCalledTimes(2);
  });

  it("neplatný podpis: invalid a žádný dotaz do databáze", async () => {
    const t = setup();
    expect(await t.run(`${REQ_ID}.AAAA`)).toBe("invalid");
    expect(await t.run("nesmysl")).toBe("invalid");
    expect(t.store.setOpened).not.toHaveBeenCalled();
    expect(t.store.setVerified).not.toHaveBeenCalled();
    expect(t.store.insertEvent).not.toHaveBeenCalled();
  });

  it("chybějící secret: invalid a žádný dotaz (fail-closed)", async () => {
    const t = setup();
    const r = await markOpened(TOKEN, "computer", "browser", {
      service: t.store,
      secret: () => {
        throw new Error("chybí");
      },
    });
    expect(r).toBe("invalid");
    expect(t.store.setOpened).not.toHaveBeenCalled();
  });
});
