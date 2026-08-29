type ClassValue = string | number | null | undefined | false | ClassValue[];

/**
 * Skládání tříd.
 *
 * Vlastní místo clsx: je to osm řádků a jedna závislost navíc by v tomhle
 * případě přinesla jen řešení konfliktů verzí.
 *
 * Nedělá slučování Tailwind tříd (jako twMerge) — poslední třída v pořadí
 * nevyhrává automaticky. Kde je potřeba přepsat výchozí styl, patří to do
 * varianty komponenty, ne do `className` zvenčí.
 */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];

  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) out.push(nested);
    } else {
      out.push(String(value));
    }
  }

  return out.join(" ");
}
