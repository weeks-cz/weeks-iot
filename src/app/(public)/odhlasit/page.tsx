import type { Metadata } from "next";
import { Alert } from "@/components/ui/Surface";
import { UnsubscribeButton } from "@/features/device-link/components/UnsubscribeButton";
import { INVALID_LINK_MESSAGE } from "@/features/device-link/messages";
import { requestTokenSecret, verifyRequestToken } from "@/features/device-link/token";

const NBSP = "\u00a0";

export const metadata: Metadata = {
  title: "Odhlášení z e-mailů",
  robots: { index: false, follow: false },
};

/** Jen podpis, žádný dotaz do databáze: GET nikdy nic nemění ani nečte. */
function isValidToken(token: string | undefined): token is string {
  if (!token) return false;
  try {
    return verifyRequestToken(token, requestTokenSecret(), "unsub") !== null;
  } catch {
    return false;
  }
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).t;
  const token = Array.isArray(raw) ? raw[0] : raw;

  return (
    <main className="section-container py-12 sm:py-16">
      <div className="max-w-xl">
        <h1 className="heading-2 mb-4">Odhlášení z e-mailů</h1>
        {isValidToken(token) ? (
          <>
            <p className="mb-6 text-ink-500">
              Kliknutím na tlačítko přestaneme na tuto adresu posílat tipy z{NBSP}učebny
              a{NBSP}nabídky táborů Weeks.
            </p>
            <UnsubscribeButton token={token} />
          </>
        ) : (
          <Alert tone="danger">{INVALID_LINK_MESSAGE}</Alert>
        )}
      </div>
    </main>
  );
}
