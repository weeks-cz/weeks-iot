import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MonoLabel } from "@/components/ui/Surface";
import { getSession } from "@/features/account/session";
import { getChildren } from "@/features/children/queries";
import { DeleteAccountForm } from "@/features/consent/components/DeleteAccountForm";
import { voiceFor } from "@/features/account/voice";

export const metadata: Metadata = { title: "Zrušení účtu" };

const REASONS: Record<string, string> = {
  souhlas:
    "Odvoláním souhlasu zákonného zástupce ztrácíme právní základ pro zpracování údajů dítěte. " +
    "Účet se proto ruší celý — jinak bychom drželi data, na která nemáme nárok.",
  podminky:
    "Podmínky užití nejsou souhlas, ale smlouva — bez nich nelze účet provozovat. " +
    "Jejich odmítnutí proto znamená zrušení účtu.",
};

export default async function DeleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ duvod?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (!session) redirect("/prihlaseni");

  const children = await getChildren(session.userId);
  const voice = voiceFor(session.account?.account_type);
  const reason = params.duvod ? REASONS[params.duvod] : undefined;

  return (
    <div className="max-w-xl">
      <MonoLabel className="mb-2">Nevratný krok</MonoLabel>
      <h1 className="heading-2 mb-4">Zrušení účtu</h1>

      <DeleteAccountForm
        reason={reason}
        childNames={children.map((c) => c.nick)}
        isSelfManaged={!voice.canAddProfiles}
        email={session.email}
      />
    </div>
  );
}
