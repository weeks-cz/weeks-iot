import { PublicFooter, PublicHeader } from "@/components/ui/PublicChrome";
import { AttributionCapture } from "@/features/analytics/components/AttributionCapture";
import { DeviceLinkOpenCapture } from "@/features/device-link/components/DeviceLinkOpenCapture";

/**
 * Veřejná zóna.
 *
 * Indexuje se — na tom stojí celá akvizice. Dnešní aplikace má plošné
 * noindex v kořenovém layoutu (nález N2), což schová i tuhle část.
 *
 * `AttributionCapture` musí být tady, ne jen na vstupní stránce: reklama
 * míří i rovnou na lekci, a UTM se zachytávají při PRVNÍ návštěvě, ať už
 * přijde kamkoli.
 *
 * `DeviceLinkOpenCapture` zachytí `?odkaz=` z e-mailu s odkazem na počítač
 * (stránka /pro-rodice) a hned ho z adresy odstraní.
 *
 * `PublicHeader` čte session: přihlášený tu vidí svou hlavičku (logo do
 * učebny, v kurzu a lekci navigaci a menu pod avatarem), ne „Přihlásit“.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AttributionCapture />
      <DeviceLinkOpenCapture />
      <PublicHeader />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  );
}
