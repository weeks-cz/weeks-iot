import type { ReactNode } from "react";

/**
 * Slovníček příkazů.
 *
 * ── Co tím opravujeme ──────────────────────────────────────────────────────
 * Krok s programem házel dítě do vody: komentář „tady řekneš Arduinu"
 * nevysvětluje, JAK se to Arduinu říká. Slovníček ukazuje u každého
 * příkazu jeho tvar a jednu větu o tom, co dělá — dítě opisuje tvar
 * a dosazuje svoje hodnoty, což je přesně to, co dělá začátečník
 * s tahákem vedle klávesnice.
 *
 * Karty se vybírají podle VZOROVÉHO řešení lekce, ne podle toho, co dítě
 * napsalo — tahák má obsahovat to, co bude potřebovat, ne to, co už zná.
 */

export interface VocabularyEntry {
  /** Podle čeho se pozná, že lekce příkaz potřebuje. */
  needle: string;
  /** Tvar příkazu, jak se píše. */
  syntax: string;
  /** Jedna věta pro dítě. */
  what: ReactNode;
}

const ENTRIES: VocabularyEntry[] = [
  {
    needle: "pinMode",
    syntax: "pinMode(pin, OUTPUT)",
    what: "Řekne Arduinu, co pin dělá. OUTPUT = ovládá, INPUT_PULLUP = poslouchá tlačítko.",
  },
  {
    needle: "digitalWrite",
    syntax: "digitalWrite(pin, HIGH)",
    what: "Zapne pin (HIGH), nebo vypne (LOW). Tím se rozsvěcí a zhasíná.",
  },
  {
    needle: "digitalRead",
    syntax: "digitalRead(pin)",
    what: "Zeptá se pinu, co se děje. Držené tlačítko vrátí LOW.",
  },
  {
    needle: "delay",
    syntax: "delay(1000)",
    what: "Počká a nic nedělá. Číslo jsou tisíciny vteřiny — 1000 je jedna vteřina.",
  },
  {
    needle: "analogWrite",
    syntax: "analogWrite(pin, 128)",
    what: "Nastaví sílu od 0 (nic) do 255 (naplno). Funguje jen na pinech s vlnovkou.",
  },
  {
    needle: "analogRead",
    syntax: "analogRead(A0)",
    what: "Změří hodnotu ze senzoru — číslo od 0 do 1023.",
  },
  {
    needle: "noTone",
    syntax: "noTone(pin)",
    what: "Vypne tón. Bez toho bzučák hraje dál a dál.",
  },
  {
    needle: "tone(",
    syntax: "tone(pin, 440)",
    what: "Pustí tón. Čím vyšší číslo, tím vyšší pískání — 440 je komorní A.",
  },
  {
    needle: "Serial.println",
    syntax: "Serial.println(hodnota)",
    what: "Vypíše číslo do sériového monitoru, ať vidíš, co Arduino měří.",
  },
  {
    needle: "if (",
    syntax: "if (podmínka) { … } else { … }",
    what: "Rozhodnutí: když podmínka platí, udělá se první blok. Jinak ten za else.",
  },
  {
    needle: "for (",
    syntax: "for (int i = 0; i <= 255; i++) { … }",
    what: "Smyčka: zopakuje blok pro každé číslo od 0 do 255.",
  },
];

/** Karty pro lekci — podle příkazů, které používá vzorové řešení. */
export function vocabularyFor(solution: string): VocabularyEntry[] {
  return ENTRIES.filter((entry) => solution.includes(entry.needle));
}
