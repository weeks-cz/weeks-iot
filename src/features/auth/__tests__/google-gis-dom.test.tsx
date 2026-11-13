import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { GoogleCredentialResponse, GoogleIdApi } from "../google-identity";

/* Hlavní cesta na produkci: tlačítko GIS (je nastavené NEXT_PUBLIC_GOOGLE_CLIENT_ID).
   Google je tu podvržený — test chytá volby předané do renderButton
   a callback z initialize, a hraje za Google klik a vydaný token. */

const track = vi.hoisted(() => vi.fn());
const loadGoogleIdentity = vi.hoisted(() => vi.fn());
const signInWithIdToken = vi.hoisted(() => vi.fn());
const completeGoogleSignInAction = vi.hoisted(() => vi.fn());

vi.mock("@/features/analytics/track", async (orig) => ({
  ...(await orig<typeof import("@/features/analytics/track")>()),
  track,
}));
vi.mock("@/features/auth/google-identity", () => ({ loadGoogleIdentity }));
vi.mock("@/features/auth/google", () => ({
  generateRawNonce: () => "surovy-nonce",
  hashNonce: async () => "hash-nonce",
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithIdToken } }),
}));
vi.mock("@/features/auth/actions", () => ({
  completeGoogleSignInAction,
  signInWithGoogleAction: vi.fn(),
}));

import { GoogleSignIn } from "../components/GoogleSignIn";

type InitConfig = Parameters<GoogleIdApi["initialize"]>[0];
type ButtonOptions = Parameters<GoogleIdApi["renderButton"]>[1];

let initConfig: InitConfig | undefined;
let buttonOptions: ButtonOptions | undefined;

function fakeGoogle(): GoogleIdApi {
  return {
    initialize: (config) => {
      initConfig = config;
    },
    renderButton: (_parent, options) => {
      buttonOptions = options;
    },
  };
}

beforeAll(() => {
  /* jsdom ResizeObserver nemá. */
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  track.mockReset();
  loadGoogleIdentity.mockReset();
  signInWithIdToken.mockReset();
  completeGoogleSignInAction.mockReset();
  initConfig = undefined;
  buttonOptions = undefined;
});
afterEach(cleanup);

async function renderReady() {
  loadGoogleIdentity.mockResolvedValue(fakeGoogle());
  render(<GoogleSignIn page="registrace" next="/registrace/onboarding" clientId="klient-123" />);
  await waitFor(() => expect(buttonOptions).toBeDefined());
}

const credential: GoogleCredentialResponse = { credential: "jwt" };

describe("GIS tlačítko Googlu", () => {
  it("klik přes click_listener (tlačítko je cizí iframe)", async () => {
    await renderReady();
    act(() => buttonOptions?.click_listener?.());

    expect(track).toHaveBeenCalledWith("auth_google_click", {
      page: "registrace",
      env: "browser",
      mode: "gis",
    });
  });

  it("přijatý token = úspěch, pak teprve přesměrování", async () => {
    signInWithIdToken.mockResolvedValue({ error: null });
    await renderReady();

    await act(async () => initConfig?.callback(credential));

    expect(track).toHaveBeenCalledWith("auth_google_success", { page: "registrace", env: "browser" });
    expect(completeGoogleSignInAction).toHaveBeenCalledWith("/registrace/onboarding");
  });

  it("odmítnutý token = chyba ve fázi token, bez textu chyby", async () => {
    signInWithIdToken.mockResolvedValue({ error: { message: "Bad ID token for rodic@example.cz" } });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await renderReady();

    await act(async () => initConfig?.callback(credential));

    expect(track).toHaveBeenCalledWith("auth_google_error", {
      page: "registrace",
      env: "browser",
      stage: "token",
    });
    expect(JSON.stringify(track.mock.calls)).not.toContain("rodic@example.cz");
    expect(completeGoogleSignInAction).not.toHaveBeenCalled();
  });

  it("nenačtený skript Googlu = chyba ve fázi script a záložní tlačítko", async () => {
    loadGoogleIdentity.mockRejectedValue(new Error("blokátor"));
    const { findByRole } = render(
      <GoogleSignIn page="prihlaseni" next="/ucet" clientId="klient-123" />,
    );

    expect(await findByRole("button", { name: /Pokračovat přes Google/ })).toBeTruthy();
    expect(track).toHaveBeenCalledWith("auth_google_error", {
      page: "prihlaseni",
      env: "browser",
      stage: "script",
    });
  });
});
