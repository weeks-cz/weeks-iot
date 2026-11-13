import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
const trackOnce = vi.hoisted(() => vi.fn());
const signUpAction = vi.hoisted(() => vi.fn());

vi.mock("@/features/analytics/track", async (orig) => ({
  ...(await orig<typeof import("@/features/analytics/track")>()),
  track,
  trackOnce,
}));
/* Serverové akce do prohlížečového testu nepatří — jen jejich odpověď. */
vi.mock("@/features/auth/actions", () => ({
  signUpAction,
  signInWithGoogleAction: vi.fn(),
  completeGoogleSignInAction: vi.fn(),
}));

import { SignUpForm } from "../components/SignUpForm";
import { SignUpView } from "../components/SignUpView";
import { GoogleSignIn } from "../components/GoogleSignIn";
import { GoogleRedirectError } from "../components/GoogleRedirectError";

const FB_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.40.107;]";

beforeEach(() => {
  track.mockReset();
  trackOnce.mockReset();
  signUpAction.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function submitSignUp() {
  fireEvent.change(screen.getByLabelText(/Váš e-mail/), { target: { value: "rodic@example.cz" } });
  fireEvent.change(screen.getByLabelText(/Heslo/), { target: { value: "tri nahodna slova" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Založit účet/ }));
  });
}

describe("formulář registrace měří výsledek, ne obsah", () => {
  it("odeslaný e-mail", async () => {
    signUpAction.mockResolvedValue({ success: "Poslali jsme vám potvrzovací e-mail." });
    render(<SignUpForm />);
    await submitSignUp();

    await waitFor(() =>
      expect(track).toHaveBeenCalledWith("signup_email_submit", {
        result: "sent",
        invalid: null,
        env: "browser",
      }),
    );
    /* Nikde se neposílá zadaná adresa ani heslo. */
    expect(JSON.stringify(track.mock.calls)).not.toContain("rodic@example.cz");
    expect(JSON.stringify(track.mock.calls)).not.toContain("tri nahodna slova");
  });

  it("chyba ve validaci nese jen názvy polí", async () => {
    signUpAction.mockResolvedValue({
      fieldErrors: { password: "Aspoň 10 znaků", email: "Neplatná adresa" },
    });
    render(<SignUpForm />);
    await submitSignUp();

    await waitFor(() =>
      expect(track).toHaveBeenCalledWith("signup_email_submit", {
        result: "invalid",
        invalid: "email,password",
        env: "browser",
      }),
    );
  });

  it("chyba serveru", async () => {
    signUpAction.mockResolvedValue({ error: "Příliš mnoho pokusů." });
    render(<SignUpForm />);
    await submitSignUp();

    await waitFor(() =>
      expect(track).toHaveBeenCalledWith("signup_email_submit", {
        result: "error",
        invalid: null,
        env: "browser",
      }),
    );
  });

  it("bez odeslání nic neměří", () => {
    render(<SignUpForm />);
    expect(track).not.toHaveBeenCalled();
  });
});

describe("zobrazení registrace", () => {
  it("nese prostředí a jestli rodič přišel po lekci", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(FB_UA);
    render(<SignUpView />);
    expect(trackOnce).toHaveBeenCalledWith("signup_view", "registrace", {
      env: "facebook",
      had_lesson: false,
    });
  });
});

describe("Google", () => {
  it("klik v záložním toku se změří se stránkou a prostředím", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(FB_UA);
    render(<GoogleSignIn page="registrace" next="/registrace/onboarding" clientId={null} />);

    fireEvent.click(screen.getByRole("button", { name: /Pokračovat přes Google/ }));

    expect(track).toHaveBeenCalledWith("auth_google_click", {
      page: "registrace",
      env: "facebook",
      mode: "redirect",
    });
  });

  it("chyba vrácená přesměrováním na přihlášení", () => {
    render(<GoogleRedirectError />);
    expect(track).toHaveBeenCalledWith("auth_google_error", {
      page: "prihlaseni",
      env: "browser",
      stage: "redirect",
    });
  });
});
