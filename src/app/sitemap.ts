import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * Indexovatelné stránky. Kurz `iot` a jeho první lekce jsou jediné, co se
 * veřejně nabízí bez účtu; ostatní lekce mají noindex (viz
 * `kurz/[slug]/[lekce]/page.tsx`), takže do mapy nepatří.
 *
 * Slugy jsou napevno: osnova žije v databázi, ale sitemap se generuje při
 * buildu bez dotazu na ni. Přidáš-li kurz, přidej ho sem.
 */
const PUBLIC_PATHS = [
  "/",
  "/ochrana-udaju/",
  "/podminky/",
  "/kurz/iot/",
  "/kurz/iot/rozsvit-ledku/",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
