import { beforeEach, describe, expect, it, vi } from "vitest";

const update = vi.fn();
const eq = vi.fn();
const getActiveChild = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const revalidatePath = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "parent-1" } } }) },
    from: () => ({
      update: (v: unknown) => {
        update(v);
        return {
          eq: (c: string, id: string) => {
            eq(c, id);
            return Promise.resolve({ error: null });
          },
        };
      },
    }),
  }),
  createServiceClient: () => ({}),
}));
vi.mock("../queries", () => ({ getActiveChild: (id: string) => getActiveChild(id) }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ clientIp: vi.fn(), rateLimit: vi.fn() }));

import { isAvatarId } from "../avatars";
import { setActiveChildAvatarAction } from "../actions";

function form(avatar?: string) {
  const f = new FormData();
  if (avatar !== undefined) f.set("avatar", avatar);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  getActiveChild.mockResolvedValue({ active: { id: "child-1" }, children: [] });
});

describe("isAvatarId", () => {
  it("přijme id z AVATARS, odmítne ostatní", () => {
    expect(isAvatarId("raketa")).toBe(true);
    expect(isAvatarId("fox")).toBe(false);
    expect(isAvatarId(null)).toBe(false);
  });
});

describe("setActiveChildAvatarAction", () => {
  it("neplatný avatar vrátí error a nezapisuje", async () => {
    const res = await setActiveChildAvatarAction({}, form("fox"));
    expect(res.error).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it("bez aktivního profilu vrátí error", async () => {
    getActiveChild.mockResolvedValue({ active: null, children: [] });
    const res = await setActiveChildAvatarAction({}, form("raketa"));
    expect(res.error).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it("zapíše avatar aktivnímu profilu a přesměruje do lobby", async () => {
    await expect(setActiveChildAvatarAction({}, form("raketa"))).rejects.toThrow("REDIRECT:/ucim-se");
    expect(update).toHaveBeenCalledWith({ avatar: "raketa" });
    expect(eq).toHaveBeenCalledWith("id", "child-1");
    expect(revalidatePath).toHaveBeenCalledWith("/ucim-se");
  });
});
