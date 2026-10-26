import { AppHeader } from "@/features/shell/components/AppHeader";
import { getViewer } from "@/features/shell/queries";

/**
 * Dětská část (`/ucim-se/**`).
 *
 * Jedna hlavička pro všechny stránky pod ní — dřív si ji každá stránka
 * kreslila sama a výběr profilu neměl žádnou. Přihlášení si dál hlídají
 * stránky; `getViewer()` je cachovaný, takže stránka, která se ptá na
 * totéž, nic navíc nestojí.
 */
export default async function ChildLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader viewer={viewer} />
      {children}
    </div>
  );
}
