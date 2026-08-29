import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Alert, Badge, Card, MonoLabel } from "@/components/ui/Surface";
import { createClient } from "@/lib/supabase/server";
import { segmentForRegion } from "@/lib/regions";
import { Avatar } from "@/features/children/avatars";
import { ContinueButton } from "@/features/children/components/ContinueButton";
import { getChildren } from "@/features/children/queries";
import { getCampCatchment } from "@/features/onboarding/queries";
import { consentStatuses } from "@/features/consent/logic";
import { CampCta } from "@/features/onboarding/components/CampCta";
import { voiceFor } from "@/features/account/voice";

export const metadata: Metadata = { title: "Přehled" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ vitejte?: string; heslo?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/prihlaseni");

  const [{ data: parent }, children, catchment, { data: consents }] = await Promise.all([
    supabase
      .from("parents")
      .select("region_code, plan, created_at, account_type")
      .eq("id", auth.user.id)
      .maybeSingle(),
    getChildren(auth.user.id),
    getCampCatchment(),
    supabase
      .from("consents")
      .select("kind, version, granted, created_at, id")
      .eq("parent_id", auth.user.id),
  ]);

  const segment = segmentForRegion(
    (parent?.region_code ?? null) as never,
    catchment,
  );
  const voice = voiceFor(parent?.account_type);
  const outdated = consentStatuses(
    consents ?? [],
    parent?.account_type !== "self",
  ).filter((s) => s.outdated);

  return (
    <div className="flex flex-col gap-8">
      {params.vitejte && (
        <Alert tone="success" title="Účet je hotový">
          Profil dítěte je připravený. Můžete rovnou začít první lekcí.
        </Alert>
      )}
      {params.heslo === "zmeneno" && <Alert tone="success">Heslo bylo změněno.</Alert>}

      {outdated.length > 0 && (
        <Alert tone="warning" title="Aktualizovali jsme znění souhlasů">
          <p>
            Prosím projděte si je a potvrďte.{" "}
            <Link href="/ucet/souhlasy" className="font-semibold underline underline-offset-4">
              Přejít na souhlasy
            </Link>
          </p>
        </Alert>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <MonoLabel className="mb-2">{voice.nav.profiles}</MonoLabel>
            <h1 className="heading-2">{voice.overviewHeading}</h1>
          </div>
          <ButtonLink href="/ucet/deti" variant="outline" size="sm">
            {voice.canAddProfiles ? "Spravovat profily" : "Upravit profil"}
          </ButtonLink>
        </div>

        {children.length === 0 ? (
          <Card className="p-6">
            <p className="mb-4 text-ink-500">Zatím tu není žádný profil.</p>
            <ButtonLink href="/ucet/deti">
              {voice.canAddProfiles ? "Přidat dítě" : "Vytvořit profil"}
            </ButtonLink>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => (
              <li key={child.id}>
                <Card interactive className="h-full p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <Avatar id={child.avatar} className="block size-12 text-ink" />
                    {child.isLocked ? (
                      <Badge tone="danger">zamčeno</Badge>
                    ) : child.hasPin ? (
                      <Badge>PIN</Badge>
                    ) : null}
                  </div>

                  <h2 className="heading-3 mb-1 text-ink">{child.nick}</h2>
                  <p className="font-mono text-xs text-ink-500">
                    ročník {child.birth_year} · dokončeno {child.lessonsCompleted}
                  </p>

                  <div className="mt-4">
                    <ContinueButton
                      childId={child.id}
                      hasPin={child.hasPin}
                      isLocked={child.isLocked}
                    />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CampCta segment={segment} placement="ucet" />
    </div>
  );
}
