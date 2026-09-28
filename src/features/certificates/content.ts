/**
 * Co stojí na certifikátu kromě jména a data.
 *
 * Dovednosti jsou shrnutí osnovy (cílů jednotlivých lekcí), ne slib nad
 * její rámec — rodič je čte jako „tohle moje dítě umí". Proto konkrétně
 * a jen to, co lekce opravdu kontrolují.
 *
 * Název kurzu se bere z databáze, projekt z názvu poslední lekce. Kurz,
 * který tu nemá záznam, certifikát nevydává.
 */

export interface CertificateContent {
  /** Lekce, jejíž název se uvede jako závěrečný projekt. */
  projectLessonSlug: string;
  skills: string[];
}

export const CERTIFICATES: Record<string, CertificateContent> = {
  iot: {
    projectLessonSlug: "nocni-svetlo",
    skills: [
      "Zapojit obvod na nepájivém poli — LED, rezistor, tlačítko, bzučák",
      "Ovládat výstupy a číst vstupy Arduina",
      "Pracovat s analogovou hodnotou: fotorezistor a plynulý jas",
      "Napsat program se smyčkou, podmínkou a časováním",
    ],
  },
};
