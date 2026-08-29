import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/ui/AuthShell";
import { GoogleButton } from "@/features/auth/components/GoogleButton";
import { SignUpForm } from "@/features/auth/components/SignUpForm";
import { AnonProgressNotice } from "@/features/anon-session/components/AnonProgressNotice";

export const metadata: Metadata = {
  title: "Založení účtu",
};

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Krok 1 ze 2"
      title="Založte účet rodiče"
      lead="Účet zakládá rodič, dítě má pod ním svůj profil. Je to podmínka zákona i způsob, jak vám můžeme posílat, co dítě dokázalo."
      aside={
        <p>
          Už účet máte?{" "}
          <Link href="/prihlaseni" className="font-semibold text-primary-600 underline underline-offset-4">
            Přihlásit se
          </Link>
        </p>
      }
    >
      <div className="flex flex-col gap-5">
        <AnonProgressNotice />

        <GoogleButton next="/registrace/onboarding" />

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-ink/15" />
          <span className="mono-label">nebo</span>
          <span className="h-px flex-1 bg-ink/15" />
        </div>

        <SignUpForm />
      </div>
    </AuthShell>
  );
}
