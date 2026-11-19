import { describe, expect, it, vi } from "vitest";
import {
  maskEmail,
  planDeviceLinkJobs,
  runDeviceLinkJobs,
  safeRunDeviceLinkJobs,
  type JobsStore,
} from "../jobs";
import { verifyRequestToken } from "../token";
import type { DeviceLinkRequestRow } from "@/lib/supabase/types";

const SECRET = "test-secret-aaaaaaaaaaaaaaaaaaaaaaaa";
const NOW = new Date("2026-11-19T10:00:00Z");
const H = 3_600_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

function row(over: Partial<DeviceLinkRequestRow> = {}): DeviceLinkRequestRow {
  return {
    id: "3f2b8c1e-5d4a-4c6b-9a1e-0123456789ab",
    email: "jana@seznam.cz",
    utm_source: "ig",
    utm_medium: "paid",
    utm_campaign: "ucebna",
    utm_content: null,
    utm_term: null,
    referrer: null,
    env: null,
    marketing_consent: true,
    sent_at: ago(72 * H),
    send_error: null,
    verified_at: null,
    opened_at: null,
    reminder_sent_at: null,
    unsubscribed_at: null,
    anonymized_at: null,
    created_at: ago(72 * H),
    ...over,
  };
}

const none = new Set<string>();
const plan = (rows: DeviceLinkRequestRow[], reg = none) =>
  planDeviceLinkJobs(rows, reg, NOW);

describe("planDeviceLinkJobs – připomínka", () => {
  it("pošle připomínku při splněných podmínkách", () => {
    expect(plan([row()]).remind).toEqual([row().id]);
  });
  it("bez souhlasu ne", () => {
    expect(plan([row({ marketing_consent: false })]).remind).toEqual([]);
  });
  it("otevřený na počítači ne", () => {
    expect(plan([row({ opened_at: ago(H) })]).remind).toEqual([]);
  });
  it("otevřený jen na telefonu (verified_at) připomínku nezruší", () => {
    expect(plan([row({ verified_at: ago(H) })]).remind).toHaveLength(1);
  });
  it("odhlášený ne", () => {
    expect(plan([row({ unsubscribed_at: ago(H) })]).remind).toEqual([]);
  });
  it("nikdy neodeslaný (sent_at null) ne", () => {
    expect(plan([row({ sent_at: null })]).remind).toEqual([]);
  });
  it("už připomenutý ne", () => {
    expect(plan([row({ reminder_sent_at: ago(H) })]).remind).toEqual([]);
  });
  it("anonymizovaný a bez e-mailu ne", () => {
    expect(plan([row({ anonymized_at: ago(H) })]).remind).toEqual([]);
    expect(plan([row({ email: null })]).remind).toEqual([]);
  });
  it("47 h ne, 49 h ano, 8 dní ne", () => {
    expect(plan([row({ created_at: ago(47 * H) })]).remind).toEqual([]);
    expect(plan([row({ created_at: ago(49 * H) })]).remind).toHaveLength(1);
    expect(plan([row({ created_at: ago(8 * 24 * H) })]).remind).toEqual([]);
  });
  it("skips registered email regardless of case", () => {
    const r = row({ email: "Jana@Seznam.cz" });
    expect(plan([r], new Set(["jana@seznam.cz"])).remind).toEqual([]);
  });
});

describe("planDeviceLinkJobs – anonymizace", () => {
  const old = { created_at: ago(91 * 24 * H) };
  it("91 dní bez souhlasu ano", () => {
    expect(plan([row({ ...old, marketing_consent: false })]).anonymize).toHaveLength(1);
  });
  it("91 dní se souhlasem ne", () => {
    expect(plan([row(old)]).anonymize).toEqual([]);
  });
  it("91 dní odhlášený ano", () => {
    const r = row({ ...old, marketing_consent: false, unsubscribed_at: ago(H) });
    expect(plan([r]).anonymize).toHaveLength(1);
    expect(plan([row({ ...old, unsubscribed_at: ago(H) })]).anonymize).toHaveLength(1);
  });
  it("už anonymizovaný ne", () => {
    const r = row({ ...old, marketing_consent: false, anonymized_at: ago(H), email: null });
    expect(plan([r]).anonymize).toEqual([]);
  });
  it("89 dní bez souhlasu ne", () => {
    expect(
      plan([row({ created_at: ago(89 * 24 * H), marketing_consent: false })]).anonymize,
    ).toEqual([]);
  });
});

function setup(
  opts: {
    rows?: DeviceLinkRequestRow[];
    registered?: string[];
    claim?: boolean;
    sendOk?: boolean;
    listFails?: boolean;
  } = {},
) {
  const rows = opts.rows ?? [row()];
  const store = {
    listCandidates: vi.fn(async (..._a: unknown[]) => {
      if (opts.listFails) throw new Error('relation "device_link_requests" does not exist');
      return rows;
    }),
    registeredEmails: vi.fn(async (..._a: unknown[]) => new Set(opts.registered ?? [])),
    claimReminder: vi.fn(async (..._a: unknown[]) => opts.claim !== false),
    anonymize: vi.fn(async (..._a: unknown[]) => true),
  } satisfies JobsStore;
  const send = vi.fn(async (..._a: unknown[]) =>
    opts.sendOk === false ? { ok: false, error: "resend" } : { ok: true },
  );
  const deps = { store, send, secret: () => SECRET };
  return { store, send, deps };
}

describe("runDeviceLinkJobs", () => {
  it("nárokuje před odesláním a pošle s List-Unsubscribe a open tokenem", async () => {
    const { store, send, deps } = setup();
    const order: string[] = [];
    store.claimReminder.mockImplementation(async () => (order.push("claim"), true));
    send.mockImplementation(async () => (order.push("send"), { ok: true }));
    const res = await runDeviceLinkJobs({ dryRun: false, now: NOW }, deps);
    expect(order).toEqual(["claim", "send"]);
    expect(res).toMatchObject({ reminded: 1, anonymized: 0, failed: 0 });
    const [to, template, attachments, headers] = send.mock.calls[0] as [
      string,
      unknown,
      unknown[],
      Record<string, string>,
    ];
    expect(to).toBe("jana@seznam.cz");
    expect(attachments).toEqual([]);
    expect(headers["List-Unsubscribe"]).toMatch(/^<https:\/\/.+\/odhlasit\?t=.+>$/);
    const json = JSON.stringify(template);
    expect(json).toContain("pripominka-na-pc");
    const url = json.match(/https:[^"\\]*kurz[^"\\]*/)![0];
    const token = new URL(url).searchParams.get("odkaz")!;
    expect(verifyRequestToken(token, SECRET, "open")).toBe(row().id);
  });

  it("neobsazený nárok (jiný běh ho vzal) neposílá", async () => {
    const { send, deps } = setup({ claim: false });
    const res = await runDeviceLinkJobs({ dryRun: false, now: NOW }, deps);
    expect(send).not.toHaveBeenCalled();
    expect(res.reminded).toBe(0);
  });

  it("selhané odeslání se započte jako failed a e-mail se nelogují", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps } = setup({ sendOk: false });
    const res = await runDeviceLinkJobs({ dryRun: false, now: NOW }, deps);
    expect(res).toMatchObject({ reminded: 0, failed: 1 });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("jana@seznam.cz");
    spy.mockRestore();
  });

  it("přeskočí e-mail z parents", async () => {
    const { send, deps } = setup({ registered: ["jana@seznam.cz"] });
    await runDeviceLinkJobs({ dryRun: false, now: NOW }, deps);
    expect(send).not.toHaveBeenCalled();
  });

  it("dryRun nic nenárokuje, neposílá, nemaže a maskuje adresy", async () => {
    const old = row({
      id: "aaaaaaaa-5d4a-4c6b-9a1e-0123456789ab",
      email: "karel@x.cz",
      marketing_consent: false,
      created_at: ago(100 * 24 * H),
    });
    const { store, send, deps } = setup({ rows: [row(), old] });
    const res = await runDeviceLinkJobs({ dryRun: true, now: NOW }, deps);
    expect(store.claimReminder).not.toHaveBeenCalled();
    expect(store.anonymize).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(res.plan).toEqual([
      { email: "ka***@x.cz", job: "anonymizace" },
      { email: "ja***@seznam.cz", job: "připomínka" },
    ]);
  });

  it("anonymizuje", async () => {
    const old = row({ marketing_consent: false, created_at: ago(100 * 24 * H) });
    const { store, deps } = setup({ rows: [old] });
    const res = await runDeviceLinkJobs({ dryRun: false, now: NOW }, deps);
    expect(store.anonymize).toHaveBeenCalledWith(old.id, NOW);
    expect(res.anonymized).toBe(1);
  });
});

describe("safeRunDeviceLinkJobs", () => {
  it("vrátí { error } místo výjimky", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps } = setup({ listFails: true });
    const res = await safeRunDeviceLinkJobs({ dryRun: false, now: NOW }, deps);
    expect(res).toEqual({ error: expect.stringContaining("device_link_requests") });
    spy.mockRestore();
  });
  it("při úspěchu vrátí výsledek", async () => {
    const { deps } = setup();
    expect(await safeRunDeviceLinkJobs({ dryRun: true, now: NOW }, deps)).toHaveProperty("plan");
  });
});

describe("maskEmail", () => {
  it("maskuje", () => expect(maskEmail("rodic@example.com")).toBe("ro***@example.com"));
});
