/**
 * Per-task granular "must-match" pattern lists.
 *
 * Ported 1:1 from legacy-vanilla/app.js lines 661-792 (Štěpán's commit
 * e865397, post-baseline addition). Each entry is checked in order against
 * the *normalized* code (see `normalizeCodeForValidation` in ./validation.ts);
 * the FIRST pattern that does NOT match wins and its message is shown to
 * the kid.
 *
 * IMPORTANT:
 *  - Patterns assume already-normalized input (lowercase, comments stripped,
 *    string literals collapsed, whitespace collapsed). Do NOT alter regexes.
 *  - Keys must match Task IDs declared in src/lib/tasks.ts.
 *  - Tasks without an entry here fall through to the bulk validator in
 *    task-solutions.ts.
 *  - Diacritics in messages were intentionally stripped in the source
 *    (legacy console-safe ASCII); preserve verbatim. Two messages still
 *    contain accented chars from the source — those are kept as-is too.
 */

export interface StrictRule {
  pattern: RegExp;
  message: string;
}

export const STRICT_TASK_RULES: Record<string, StrictRule[]> = {
  "beginner-led": [
    { pattern: /pinmode\s*\(\s*7\s*,\s*input\s*\)/, message: "Chybi blok, ktery nastavi tlacitko jako vstup." },
    { pattern: /pinmode\s*\(\s*8\s*,\s*output\s*\)/, message: "Chybi blok, ktery nastavi LED jako vystup." },
    { pattern: /digitalread\s*\(\s*7\s*\)/, message: "Chybi blok pro cteni tlacitka na spravnem pinu." },
    { pattern: /digitalwrite\s*\(\s*8\s*,\s*high\s*\)/, message: "Chybi blok pro rozsviceni LED." },
    { pattern: /digitalwrite\s*\(\s*8\s*,\s*low\s*\)/, message: "Chybi blok pro zhasnuti LED." },
  ],
  "beginner-potentiometer": [
    { pattern: /pinmode\s*\(\s*a3\s*,\s*input\s*\)/, message: "Chybi blok, ktery pripravi potenciometr na analogovem vstupu." },
    { pattern: /serial\.begin\s*\(\s*9600\s*\)/, message: "Chybi blok pro spusteni serioveho monitoru." },
    { pattern: /analogread\s*\(\s*a3\s*\)/, message: "Chybi blok pro cteni hodnoty z potenciometru." },
    { pattern: /serial\.println\s*\(/, message: "Chybi blok pro vypsani hodnoty do serioveho monitoru." },
  ],
  "beginner-and-or": [
    { pattern: /digitalread\s*\(\s*2\s*\)/, message: "Chybi blok pro cteni prvniho tlacitka." },
    { pattern: /digitalread\s*\(\s*3\s*\)/, message: "Chybi blok pro cteni druheho tlacitka." },
    { pattern: /\|\|/, message: "Chybi logika NEBO pro prvni LED." },
    { pattern: /&&/, message: "Chybi logika A pro druhou LED." },
    { pattern: /digitalwrite\s*\(\s*8\s*,\s*high\s*\)/, message: "Chybi krok, ktery rozsviti vystup pro OR." },
    { pattern: /digitalwrite\s*\(\s*9\s*,\s*high\s*\)/, message: "Chybi krok, ktery rozsviti vystup pro AND." },
  ],
  "beginner-traffic-light": [
    { pattern: /pinmode\s*\(\s*9\s*,\s*output\s*\)/, message: "Chybi nastaveni cervene LED jako vystupu." },
    { pattern: /pinmode\s*\(\s*8\s*,\s*output\s*\)/, message: "Chybi nastaveni oranzove LED jako vystupu." },
    { pattern: /pinmode\s*\(\s*7\s*,\s*output\s*\)/, message: "Chybi nastaveni zelene LED jako vystupu." },
    { pattern: /digitalwrite\s*\(\s*9\s*,\s*high\s*\)/, message: "Chybi krok pro rozsviceni cervene LED." },
    { pattern: /digitalwrite\s*\(\s*7\s*,\s*high\s*\)/, message: "Chybi krok pro rozsviceni zelene LED." },
    { pattern: /delay\s*\(\s*3000\s*\)/, message: "Chybi delsi cekani mezi stavy semaforu." },
  ],
  "beginner-buzzer-button": [
    {
      pattern: /(digitalread\s*\(\s*7\s*\)|digitalread\s*\(\s*8\s*\))/,
      message: "Chybi blok pro cteni tlacitka.",
    },
    {
      pattern: /(tone\s*\(\s*8\s*,\s*440\s*,\s*200\s*\)|analogwrite\s*\(\s*9\s*,\s*digitalread\s*\(\s*8\s*\)\s*\)|digitalwrite\s*\(\s*9\s*,\s*digitalread\s*\(\s*8\s*\)\s*\))/,
      message: "Chybi blok, ktery prenese stav tlacitka na bzucak nebo spusti ton.",
    },
  ],
  "beginner-light-sensor": [
    { pattern: /analogread\s*\(\s*a0\s*\)/, message: "Chybi blok pro cteni fotorezistoru." },
    { pattern: /svetlo\s*<\s*400/, message: "Chybi porovnani namerene hodnoty s hranici tmy." },
    { pattern: /digitalwrite\s*\(\s*9\s*,\s*high\s*\)/, message: "Chybi blok pro rozsviceni LED pri tme." },
    { pattern: /digitalwrite\s*\(\s*9\s*,\s*low\s*\)/, message: "Chybi blok pro zhasnuti LED pri svetle." },
  ],
  "advanced-stair-light": [
    { pattern: /digitalread\s*\(\s*2\s*\)/, message: "Chybi cteni prvniho tlacitka." },
    { pattern: /digitalread\s*\(\s*3\s*\)/, message: "Chybi cteni druheho tlacitka." },
    { pattern: /millis\s*\(\s*\)/, message: "Chybi blok pro praci s casem." },
    { pattern: /casposlednihostisku\s*=\s*millis\s*\(\s*\)/, message: "Chybi ulozeni casu posledniho stisku." },
    { pattern: /millis\s*\(\s*\)\s*-\s*casposlednihostisku\s*>\s*3000/, message: "Chybi podminka pro zhasnuti po 3 sekundach." },
  ],
  "advanced-crosswalk": [
    { pattern: /digitalread\s*\(\s*2\s*\)/, message: "Chybi blok pro cteni tlacitka pro chodce." },
    { pattern: /digitalwrite\s*\(\s*7\s*,\s*high\s*\)/, message: "Chybi vychozi zelena pro auta." },
    { pattern: /digitalwrite\s*\(\s*9\s*,\s*high\s*\)/, message: "Chybi krok pro cervenou LED." },
    { pattern: /delay\s*\(\s*3000\s*\)/, message: "Chybi delsi cekani v hlavni casti prechodu." },
  ],
  "advanced-parking": [
    { pattern: /readultrasonicdistance\s*\(/, message: "Chybi blok nebo cast programu pro mereni ultrazvukem." },
    { pattern: /serial\.println\s*\(\s*x\s*\)/, message: "Chybi vypsani namerene vzdalenosti." },
    { pattern: /x\s*>\s*20/, message: "Chybi hranice pro dalekou vzdalenost." },
    { pattern: /x\s*>\s*5/, message: "Chybi hranice pro stredni vzdalenost." },
    { pattern: /digitalwrite\s*\(\s*5\s*,\s*high\s*\)/, message: "Chybi krok pro cervenou signalizaci pri male vzdalenosti." },
  ],
  "advanced-motion": [
    { pattern: /digitalread\s*\(\s*2\s*\)/, message: "Chybi blok pro cteni PIR senzoru." },
    { pattern: /serial\.println\s*\(\s*""\s*\)/, message: "Chybi blok pro vypis zpravy pri detekci pohybu." },
    // Note: source uses "rozsviť" with diacritic — preserved verbatim.
    { pattern: /digitalwrite\s*\(\s*8\s*,\s*high\s*\)/, message: "Chybi reakce, ktera pri pohybu rozsviť LED." },
    { pattern: /digitalwrite\s*\(\s*8\s*,\s*low\s*\)/, message: "Chybi zhasnuti LED bez pohybu." },
  ],
  "advanced-temperature-alarm": [
    { pattern: /analogread\s*\(\s*a1\s*\)/, message: "Chybi blok pro cteni teplotniho senzoru." },
    { pattern: /teplota\s*<\s*250/, message: "Chybi prvni hranice teploty." },
    { pattern: /teplota\s*<\s*450/, message: "Chybi druha hranice teploty." },
    { pattern: /tone\s*\(\s*7\s*,\s*660\s*,\s*150\s*\)/, message: "Chybi zvukove varovani pro vysokou teplotu." },
  ],
  "advanced-counter": [
    { pattern: /digitalread\s*\(\s*6\s*\)/, message: "Chybi blok pro tlacitko plus." },
    { pattern: /digitalread\s*\(\s*7\s*\)/, message: "Chybi blok pro tlacitko minus." },
    { pattern: /hodnota\+\+/, message: "Chybi zvetseni hodnoty." },
    { pattern: /hodnota--/, message: "Chybi zmenseni hodnoty." },
    { pattern: /serial\.println\s*\(\s*hodnota\s*\)/, message: "Chybi vypsani aktualni hodnoty." },
  ],
  "expert-servo": [
    { pattern: /analogread\s*\(\s*a5\s*\)/, message: "Chybi blok pro cteni potenciometru." },
    { pattern: /map\s*\(\s*y\s*,\s*0\s*,\s*1023\s*,\s*0\s*,\s*180\s*\)/, message: "Chybi prevedeni hodnoty na uhel serva." },
    { pattern: /servo_3\.write\s*\(\s*x\s*\)/, message: "Chybi blok pro nastaveni polohy serva." },
  ],
  "expert-servo-loop": [
    { pattern: /while\s*\(\s*x\s*<\s*180\s*\)/, message: "Chybi cast, kde servo jede jednim smerem az do kraje." },
    { pattern: /while\s*\(\s*x\s*>\s*1\s*\)/, message: "Chybi cast, kde se servo vraci zpet." },
    { pattern: /servo_3\.write\s*\(\s*x\s*\)/, message: "Chybi posilani uhlu do serva." },
  ],
  "expert-rgb-loop": [
    { pattern: /analogread\s*\(\s*a0\s*\)/, message: "Chybi cteni prvniho potenciometru." },
    { pattern: /analogread\s*\(\s*a1\s*\)/, message: "Chybi cteni druheho potenciometru." },
    { pattern: /analogread\s*\(\s*a2\s*\)/, message: "Chybi cteni tretiho potenciometru." },
    { pattern: /analogwrite\s*\(\s*3\s*,\s*x\s*\/\s*4\s*\)/, message: "Chybi nastaveni cervene slozky RGB LED." },
    { pattern: /analogwrite\s*\(\s*5\s*,\s*y\s*\/\s*4\s*\)/, message: "Chybi nastaveni zelene slozky RGB LED." },
    { pattern: /analogwrite\s*\(\s*6\s*,\s*z\s*\/\s*4\s*\)/, message: "Chybi nastaveni modre slozky RGB LED." },
  ],
  "expert-reaction-game": [
    { pattern: /randomseed\s*\(\s*analogread\s*\(\s*a0\s*\)\s*\)/, message: "Chybi priprava nahodneho startu hry." },
    { pattern: /delay\s*\(\s*random\s*\(\s*2000\s*,\s*5000\s*\)\s*\)/, message: "Chybi nahodne cekani pred startem." },
    { pattern: /while\s*\(\s*digitalread\s*\(\s*2\s*\)\s*==\s*0\s*\)/, message: "Chybi cekani na reakci hrace po rozsviceni LED." },
    { pattern: /serial\.println\s*\(\s*""\s*\)/, message: "Chybi vypsani vysledku hry." },
  ],
  "expert-led-roulette": [
    { pattern: /randomseed\s*\(\s*analogread\s*\(\s*a0\s*\)\s*\)/, message: "Chybi priprava nahodneho cisla pro ruletu." },
    { pattern: /cil\s*=\s*random\s*\(\s*12\s*,\s*24\s*\)/, message: "Chybi nahodny vyber delky rulety." },
    { pattern: /for\s*\(\s*int\s+krok\s*=\s*0\s*;\s*krok\s*<\s*cil\s*;\s*krok\+\+\s*\)/, message: "Chybi opakovani kroku rulety." },
    { pattern: /delay\s*\(\s*60\s*\+\s*krok\s*\*\s*20\s*\)/, message: "Chybi zpomalovani rulety." },
  ],
  "expert-arduino-piano": [
    { pattern: /digitalread\s*\(\s*2\s*\)/, message: "Chybi cteni prvniho tlacitka piana." },
    { pattern: /digitalread\s*\(\s*3\s*\)/, message: "Chybi cteni druheho tlacitka piana." },
    { pattern: /digitalread\s*\(\s*4\s*\)/, message: "Chybi cteni tretiho tlacitka piana." },
    { pattern: /tone\s*\(\s*8\s*,\s*262\s*,\s*120\s*\)/, message: "Chybi prvni ton." },
    { pattern: /tone\s*\(\s*8\s*,\s*330\s*,\s*120\s*\)/, message: "Chybi druhy ton." },
    { pattern: /tone\s*\(\s*8\s*,\s*392\s*,\s*120\s*\)/, message: "Chybi treti ton." },
    { pattern: /notone\s*\(\s*8\s*\)/, message: "Chybi vypnuti zvuku, kdyz neni stisknute zadne tlacitko." },
  ],
  "expert-smart-barrier": [
    { pattern: /readultrasonicdistance\s*\(/, message: "Chybi cast programu pro mereni vzdalenosti." },
    { pattern: /servo_5\.attach\s*\(\s*5\s*,\s*500\s*,\s*2500\s*\)/, message: "Chybi pripojeni serva." },
    { pattern: /vzdalenost\s*<\s*15/, message: "Chybi podminka, kdy ma zavora otevrit." },
    { pattern: /servo_5\.write\s*\(\s*90\s*\)/, message: "Chybi otevreni zavory." },
    { pattern: /servo_5\.write\s*\(\s*0\s*\)/, message: "Chybi zavreni zavory." },
  ],
};
