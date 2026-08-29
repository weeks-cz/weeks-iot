import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MonoLabel } from "@/components/ui/Surface";
import { createClient } from "@/lib/supabase/server";
import { CONTROLLER } from "@/lib/site";
import { consentStatuses } from "@/features/consent/logic";
import { ConsentList } from "@/features/consent/components/ConsentList";

export const metadata: Metadata = { title: "Souhlasy" };

export default async function ConsentsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/prihlaseni");

  const { data: consents } = await supabase
    .from("consents")
    .select("id, kind, version, granted, created_at")
    .eq("parent_id", auth.user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <MonoLabel className="mb-2">Ochrana údajů</MonoLabel>
        <h1 className="heading-2 mb-3">Souhlasy</h1>
        <p className="leading-relaxed text-ink-500">
          Správcem vašich údajů je {CONTROLLER.name}, IČO {CONTROLLER.ico}. Každou změnu
          si ukládáme s datem a zněním, které jste v tu chvíli viděli.
        </p>
      </header>

      <ConsentList statuses={consentStatuses(consents ?? [])} />

      <div className="mt-8 border-t border-ink/10 pt-6">
        <h2 className="heading-3 mb-2">Zrušení účtu</h2>
        <p className="mb-4 max-w-prose leading-relaxed text-ink-500">
          Zrušením smažeme profily dětí, jejich postup i uložené projekty. Je to nevratné.
        </p>
        <Link
          href="/ucet/smazat"
          className="rounded-sm text-sm font-semibold text-danger-600 underline underline-offset-4 hover:text-danger-700"
        >
          Chci zrušit účet
        </Link>
      </div>
    </div>
  );
}
