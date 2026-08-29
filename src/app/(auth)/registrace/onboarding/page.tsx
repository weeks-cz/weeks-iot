import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/ui/AuthShell";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/features/onboarding/components/OnboardingWizard";
import { getRegionOptions } from "@/features/onboarding/queries";

export const metadata: Metadata = {
  title: "Dokončení registrace",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    redirect("/prihlaseni?next=%2Fregistrace%2Fonboarding");
  }

  /* Kdo onboarding už prošel, sem nemá co chodit — jinak by si druhým
     odesláním založil druhé dítě se stejnou přezdívkou. */
  const { data: parent } = await supabase
    .from("parents")
    .select("onboarding_completed_at")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (parent?.onboarding_completed_at) {
    redirect("/ucet");
  }

  const regions = await getRegionOptions();

  return (
    <AuthShell
      eyebrow="Krok 2 ze 2"
      title="Ještě pár údajů"
      lead="Tři krátké kroky a máte hotovo."
    >
      <OnboardingWizard regions={regions} />
    </AuthShell>
  );
}
