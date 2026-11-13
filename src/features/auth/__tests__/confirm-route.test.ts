import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.hoisted(() => vi.fn());
const insert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createStatelessClient: () => ({
    auth: { verifyOtp, signOut: vi.fn(async () => ({ error: null })) },
  }),
  createServiceClient: () => ({ from: () => ({ insert }) }),
}));
/* `after()` mimo požadavek Next.js nefunguje; v testu se spustí hned. */
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => unknown) => void fn(),
}));

import { GET } from "@/app/auth/confirm/route";

const IG_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 355.0.0.20.108";

function request(query: string, ua = "Mozilla/5.0 Chrome/130.0.0.0") {
  return new Request(`https://ucebna.weeks.cz/auth/confirm?${query}`, {
    headers: { "user-agent": ua },
  });
}

beforeEach(() => {
  verifyOtp.mockReset();
  insert.mockReset().mockResolvedValue({ error: null });
});

describe("/auth/confirm měří potvrzení", () => {
  it("úspěch: parent_id z ověřeného tokenu, prostředí, kde se odkaz otevřel", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: "rodic-1" } }, error: null });

    const res = await GET(request("token_hash=abc&type=signup&next=%2Fregistrace%2Fonboarding", IG_UA));

    expect(res.headers.get("location")).toContain("/prihlaseni?potvrzeno=1");
    expect(insert).toHaveBeenCalledWith({
      type: "email_confirmed",
      parent_id: "rodic-1",
      props: { ok: true, env: "instagram" },
    });
  });

  it("vypršený odkaz: bez parent_id, s důvodem", async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { message: "x", code: "otp_expired" } });

    const res = await GET(request("token_hash=abc&type=signup"));

    expect(res.headers.get("location")).toContain("chyba=expired");
    expect(insert).toHaveBeenCalledWith({
      type: "email_confirmed",
      parent_id: null,
      props: { ok: false, reason: "expired", env: "browser" },
    });
  });

  it("selhání zápisu měření přesměrování neshodí", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: "rodic-1" } }, error: null });
    insert.mockRejectedValue(new Error("síť"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await GET(request("token_hash=abc&type=signup"));

    expect(res.headers.get("location")).toContain("/prihlaseni?potvrzeno=1");
  });

  it("odkaz bez tokenu nic neměří", async () => {
    await GET(request("type=signup"));
    expect(insert).not.toHaveBeenCalled();
  });
});
