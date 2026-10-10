import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * Veřejná část se indexuje. Rodičovská zóna, dětské obrazovky, přihlášení
 * a legacy tábor ne. Lekce kromě první mají `noindex` na stránce samé —
 * nezakazujeme je v robots.txt, protože by Google nikdy neviděl tu značku.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/ucet",
          "/ucim-se",
          "/prihlaseni",
          "/registrace",
          "/obnova-hesla",
          "/api/",
          "/tabor",
          "/admin",
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
