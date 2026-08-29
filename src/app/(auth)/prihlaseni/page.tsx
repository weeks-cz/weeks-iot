import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/ui/AuthShell";
import { Alert } from "@/components/ui/Surface";
import { GoogleButton } from "@/features/auth/components/GoogleButton";
import { SignInForm } from "@/features/auth/components/SignInForm";
import { isSafeNextPath } from "@/features/auth/safe-path";

export const metadata: Metadata = {
  title: "Přihlášení",
};

const ERRORS: Record<string, string> = {
  google: "Přihlášení přes Google se nepovedlo. Zkuste to prosím znovu nebo použijte e-mail.",
  callback: "Odkaz už není platný. Požádejte prosím o nový.",
  expired: "Odkaz vypršel. Požádejte prosím o nový.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; chyba?: string }>;
}) {
  const params = await searchParams;

  /* `next` prochází kontrolou hned tady, ne až v callbacku. Kdyby se
     nepovolená hodnota jen předala dál, doputovala by do skrytého pole
     formuláře a byla by o krok blíž k přesměrování ven. */
  const next = isSafeNextPath(params.next) ? params.next : "/ucet";
  const error = params.chyba ? ERRORS[params.chyba] : undefined;

  return (
    <AuthShell
      eyebrow="Rodičovský účet"
      title="Přihlášení"
      lead="Účet patří rodiči. Dítě má pod ním svůj profil."
      aside={
        <p>
          Ještě nemáte účet?{" "}
          <Link href="/registrace" className="font-semibold text-primary-600 underline underline-offset-4">
            Založit účet
          </Link>
        </p>
      }
    >
      <div className="flex flex-col gap-5">
        {error && <Alert tone="danger">{error}</Alert>}

        <GoogleButton next={next} />

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-ink/15" />
          <span className="mono-label">nebo</span>
          <span className="h-px flex-1 bg-ink/15" />
        </div>

        <SignInForm next={next} />
      </div>
    </AuthShell>
  );
}
