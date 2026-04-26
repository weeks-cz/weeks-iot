import type { Section, Task } from "@/types";
import { SECTION_UNLOCK_COSTS } from "./config";

/**
 * Tasks data ported 1:1 from `legacy-vanilla/app.js` (lines ~794-1675).
 *
 * Notes vs plan:
 * - Plan said "21 tasks". Source actually has 31 (beginner 8, advanced 10, expert 13).
 *   All 31 are ported here in the order defined by SECTION_TASK_ORDER in app.js.
 * - app.js uses `wiringHelp: string[]` / `codeHelp: string[]`. The Task.hints type is
 *   `{ code?: string; wiring?: string }`, so each array is joined into a single
 *   newline-bulleted string. `goals` and `imageLabel` from app.js are dropped (not in type).
 * - Image keys come from TASK_IMAGE_CONFIG; only 9 tasks have images. Others omit imageKey.
 * - Czech diacritics restored throughout (Codex stripped them in the legacy source).
 */

function bullets(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

const beginnerTasks: Task[] = [
  {
    id: "beginner-led",
    sectionId: "beginner",
    title: "LED",
    description:
      "Ovládej první LED tlačítkem bez programu a druhou LED pomocí programu v Arduinu.",
    reward: 5,
    imageKey: "led",
    hints: {
      wiring: bullets([
        "Připrav jednu LED ovládanou přímo tlačítkem a druhou LED zapojenou na digitální výstup Arduina.",
        "Tlačítko připoj jako vstup a druhou LED nech řídit přes výstupní pin.",
        "Obě LED zapoj přes rezistory a spoj GND breadboardu s GND na Arduinu.",
      ]),
      code: bullets([
        "V setup nastav pin tlačítka jako INPUT a pin druhé LED jako OUTPUT.",
        "V loop přečti stav tlačítka pomocí digitalRead().",
        "Když je tlačítko stisknuté, nastav LED na HIGH, jinak LOW.",
      ]),
    },
  },
  {
    id: "beginner-buzzer-button",
    sectionId: "beginner",
    title: "Tlačítko + buzzer",
    description:
      "Po stisku tlačítka spusť zvuk na buzzeru, po puštění se má zvuk zastavit.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Tlačítko zapoj na samostatný digitální vstup s definovaným klidovým stavem.",
        "Piezo buzzer připoj na výstupní pin a GND.",
        "Dohlídni na společnou zem a přehledné vedení vodičů na breadboardu.",
      ]),
      code: bullets([
        "V setup nastav tlačítko jako INPUT a buzzer jako OUTPUT.",
        "V loop čti stav tlačítka přes digitalRead().",
        "Při stisku použij tone() nebo digitalWrite() pro aktivaci buzzeru, jinak noTone() nebo LOW.",
      ]),
    },
  },
  {
    id: "beginner-potentiometer",
    sectionId: "beginner",
    title: "Potenciometr",
    description:
      "Načti hodnotu z potenciometru a vypisuj ji do sériového monitoru.",
    reward: 5,
    imageKey: "potenciometr",
    hints: {
      wiring: bullets([
        "Krajní vývody potenciometru veď na 5V a GND.",
        "Střední vývod zapoj na analogový pin, podle referenčního úkolu třeba A3.",
        "LED může sloužit jako jednoduchá indikace na výstupu přes rezistor.",
      ]),
      code: bullets([
        "Spusť Serial.begin() v setup().",
        "V loop čti analogRead() z vybraného analogového pinu.",
        "Hodnotu vypiš přes Serial.println() a přidej krátké delay().",
      ]),
    },
  },
  {
    id: "beginner-pwm-led",
    sectionId: "beginner",
    title: "Plynulá LED",
    description:
      "Pomocí PWM nastavuj jas LED a vyzkoušej plynulý přechod mezi tmou a plným svitem.",
    reward: 5,
    hints: {
      wiring: bullets([
        "LED připoj přes rezistor na pin s podporou PWM a na GND.",
        "Ověř si, že používáš vhodný výstupní pin označený symbolem PWM.",
        "Zapojení nech co nejjednodušší, ať se můžeš soustředit na program.",
      ]),
      code: bullets([
        "Použij analogWrite() pro nastavení jasu LED.",
        "Jas ukládej do proměnné a postupně ho zvětšuj nebo zmenšuj.",
        "Mezi změnami přidej krátký delay(), aby byl přechod viditelný.",
      ]),
    },
  },
  {
    id: "beginner-traffic-light",
    sectionId: "beginner",
    title: "Semafor",
    description:
      "Rozblikej semafor se třemi LED v klasickém cyklu červená - oranžová - zelená.",
    reward: 5,
    imageKey: "semafor",
    hints: {
      wiring: bullets([
        "Každou LED dej na vlastní digitální výstup přes rezistor.",
        "Spoj všechny záporné větve s GND.",
        "Barvy LED si označ tak, aby bylo jasné, která je červená, oranžová a zelená.",
      ]),
      code: bullets([
        "V setup nastav tři výstupní piny jako OUTPUT.",
        "V loop postupně přepínej LED pomocí digitalWrite().",
        "Mezi jednotlivými stavy použij delay() podle požadované délky světel.",
      ]),
    },
  },
  {
    id: "beginner-light-sensor",
    sectionId: "beginner",
    title: "Noční světlo",
    description:
      "Pomocí fotorezistoru rozsviť LED jen tehdy, když je kolem tma.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Fotorezistor zapoj jako dělič napětí s rezistorem a výstup veď na analogový pin.",
        "LED připoj na digitální nebo PWM výstup přes rezistor.",
        "Napájecí větve 5V a GND rozveď přehledně po breadboardu.",
      ]),
      code: bullets([
        "V loop čti hodnotu senzoru pomocí analogRead().",
        "Stanov si hranici, pod kterou budeš brát prostředí jako tmu.",
        "Pomocí if podmínky přepínej LED na HIGH a LOW podle změřené hodnoty.",
      ]),
    },
  },
  {
    id: "beginner-and-or",
    sectionId: "beginner",
    title: "AND - OR",
    description:
      "Postav logickou úlohu se dvěma vstupy a LED výstupy pro operace AND a OR.",
    reward: 5,
    imageKey: "and-or",
    hints: {
      wiring: bullets([
        "Připrav dvě tlačítka jako dva samostatné vstupy a dvě LED jako dva výstupy.",
        "Každou LED připoj přes vlastní rezistor a dávej pozor na správnou orientaci diod.",
        "Tlačítka musejí mít definovaný klidový stav.",
      ]),
      code: bullets([
        "Načti dva vstupy pomocí digitalRead().",
        "Pro OR rozsviť LED, když je aktivní alespoň jeden vstup.",
        "Pro AND rozsviť LED jen tehdy, když jsou aktivní oba vstupy najednou.",
      ]),
    },
  },
  {
    id: "beginner-rgb-button",
    sectionId: "beginner",
    title: "RGB tlačítko",
    description:
      "Jedním tlačítkem přepínej mezi barvami RGB LED a vytvoř jednoduchý barevný režim.",
    reward: 5,
    hints: {
      wiring: bullets([
        "RGB LED připoj na tři samostatné výstupy přes rezistory.",
        "Tlačítko zapoj na digitální vstup s jasným klidovým stavem.",
        "Zkontroluj, jestli máš správně zapojenou společnou nožičku RGB LED.",
      ]),
      code: bullets([
        "Drž si index aktuální barvy v proměnné.",
        "Při stisku tlačítka index posuň na další hodnotu.",
        "Podle indexu nastav kombinaci výstupů pro červenou, zelenou a modrou.",
      ]),
    },
  },
];

const advancedTasks: Task[] = [
  {
    id: "advanced-counter",
    sectionId: "advanced",
    title: "Počítadlo + a -",
    description:
      "Dvě tlačítka mají zvětšovat a zmenšovat počítadlo, jehož hodnotu vypisuješ do sériového monitoru.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Připrav dvě tlačítka jako dva samostatné vstupy s jasně definovaným klidovým stavem.",
        "Není potřeba žádný výstupní prvek, pokud budeš výsledek sledovat jen v sériovém monitoru.",
        "Pokud chceš, můžeš přidat LED jako indikaci změny hodnoty.",
      ]),
      code: bullets([
        "Vytvoř proměnnou pro uložení aktuální hodnoty počítadla.",
        "Při stisku prvního tlačítka hodnotu zvětšuj, při druhém zmenšuj.",
        "Každou změnu vypiš přes Serial.println() a ošetři krátké zpoždění proti více stiskům.",
      ]),
    },
  },
  {
    id: "advanced-seven-segment-counter",
    sectionId: "advanced",
    title: "7-segment počítadlo",
    description:
      "Pomocí dvou tlačítek ovládej číslo na 7-segmentovém displeji a zobrazuj hodnoty 0 až 9.",
    reward: 5,
    hints: {
      wiring: bullets([
        "7-segment display zapoj přes rezistory na výstupní piny Arduina.",
        "Použij dvě tlačítka jako samostatné vstupy pro plus a minus.",
        "Předem si označ segmenty a ověř, jestli máš správný typ displeje.",
      ]),
      code: bullets([
        "Udržuj aktuální hodnotu v proměnné.",
        "Podle stisku tlačítek ji zvětšuj nebo zmenšuj.",
        "Pro každé číslo si připrav funkci nebo tabulku, která nastaví správné segmenty.",
      ]),
    },
  },
  {
    id: "advanced-motion",
    sectionId: "advanced",
    title: "Detekce pohybu",
    description: "Zapoj PIR senzor a vytvoř reakci na zaznamenaný pohyb.",
    reward: 5,
    imageKey: "detekce-pohybu",
    hints: {
      wiring: bullets([
        "PIR senzor připoj na 5V, GND a výstupní signální pin.",
        "Signál senzoru veď na digitální vstup Arduina.",
        "Pro test můžeš přidat LED na výstupní pin.",
      ]),
      code: bullets([
        "Nastav signální pin PIR jako INPUT.",
        "V loop čti stav senzoru přes digitalRead().",
        "Při aktivaci proveď akci, např. rozsviť LED nebo vypiš zprávu do sériového monitoru.",
      ]),
    },
  },
  {
    id: "advanced-reaction-buzzer",
    sectionId: "advanced",
    title: "Reakční stopky",
    description:
      "Po náhodné pauze se rozsvítí LED nebo pípne buzzer a hráč musí co nejrychleji stisknout tlačítko.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Použij jedno tlačítko jako vstup a LED nebo buzzer jako výstup pro start signál.",
        "Tlačítko musí mít stabilní klidový stav.",
        "Pro větší efekt můžeš spojit LED i buzzer dohromady.",
      ]),
      code: bullets([
        "Použij random() nebo millis() pro náhodné čekání před startem kola.",
        "Před startem kontroluj, jestli hráč nedrží tlačítko.",
        "Po start signálu měř dobu do stisku a vypiš nebo jinak oznam výsledek.",
      ]),
    },
  },
  {
    id: "advanced-door-alarm",
    sectionId: "advanced",
    title: "Dveřní alarm",
    description:
      "Pomocí tlačítka nebo magnetického kontaktu simuluj otevření dveří a spusť světelný nebo zvukový alarm.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Použij spínač nebo tlačítko jako simulaci senzoru dveří.",
        "LED a buzzer připoj na samostatné výstupy.",
        "Dohlídni na stabilní klidový stav vstupu, aby alarm nespouštěl náhodně.",
      ]),
      code: bullets([
        "V loop stále kontroluj stav vstupu pomocí digitalRead().",
        "Při aktivaci vstupu zapni LED nebo buzzer.",
        "Při návratu do klidu alarm vypni a ponech systém připravený na další otevření.",
      ]),
    },
  },
  {
    id: "advanced-stair-light",
    sectionId: "advanced",
    title: "Schodišťové světlo",
    description:
      "Přidej druhé tlačítko a naprogramuj světlo tak, aby po posledním stisku zhaslo až po 3 sekundách.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Vycházej ze zapojení se světlem a doplň druhé tlačítko jako další vstup.",
        "Obě tlačítka veď do samostatných vstupních pinů.",
        "LED nech na výstupním pinu přes rezistor.",
      ]),
      code: bullets([
        "Ulož si čas posledního stisku do proměnné pomocí millis().",
        "Když je stisknuté kterékoli tlačítko, LED rozsviť a aktualizuj čas poslední aktivity.",
        "LED zhasni až ve chvíli, kdy od poslední aktivity uběhly více než 3 sekundy.",
      ]),
    },
  },
  {
    id: "advanced-distance-bar",
    sectionId: "advanced",
    title: "Měřič vzdálenosti",
    description:
      "Udělej z ultrazvukového senzoru jednoduchý ukazatel vzdálenosti s více LED úrovněmi.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Připoj ultrazvukový senzor stejně jako u parkovacího systému.",
        "Připrav řadu více LED na samostatných výstupních pinech.",
        "Každou LED zapoj přes rezistor a sjednoť všechny země.",
      ]),
      code: bullets([
        "Nejdřív změř vzdálenost a ulož ji do proměnné.",
        "Rozděl si hodnoty na několik pásem, např. daleko, středně, blízko.",
        "Podle pásma rozsvěcuj jednu, dvě nebo tři LED.",
      ]),
    },
  },
  {
    id: "advanced-temperature-alarm",
    sectionId: "advanced",
    title: "Teplotní alarm",
    description:
      "Měř teplotu senzorem a podle hodnoty přepínej LED nebo spusť varování.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Teplotní senzor připoj na 5V, GND a analogový výstup.",
        "Tři LED dej na samostatné výstupy přes rezistory.",
        "Buzzer můžeš přidat jako doplněk pro kritickou teplotu.",
      ]),
      code: bullets([
        "Nejdřív čti analogovou hodnotu senzoru pomocí analogRead().",
        "Podle typu senzoru převeď hodnotu na orientační teplotu nebo nastav hranice přímo nad analogovými hodnotami.",
        "Pomocí if / else přepínej LED a případně aktivuj tone() pro alarm.",
      ]),
    },
  },
  {
    id: "advanced-crosswalk",
    sectionId: "advanced",
    title: "Semafor + přechod",
    description:
      "Rozšiř semafor o tlačítko pro chodce. Po stisku proběhne bezpečný cyklus a pak se vrátí zelená pro auta.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Použij stejné tři LED jako u semaforu a přidej jedno tlačítko pro chodce.",
        "Tlačítko zapoj jako samostatný vstup.",
        "LED nech rozdělené na tři samostatné výstupy.",
      ]),
      code: bullets([
        "Ve výchozím stavu nech svítit zelenou.",
        "Při stisku tlačítka nespouštěj cyklus znovu opakovaně, ale jednorázově.",
        "Cyklus slož ze sekvence digitalWrite() a delay(), případně z jednoduchého stavového automatu.",
      ]),
    },
  },
  {
    id: "advanced-parking",
    sectionId: "advanced",
    title: "Parkovací systém",
    description:
      "Použij ultrazvukový snímač, tři LED a případně buzzer pro signalizaci vzdálenosti překážky.",
    reward: 5,
    imageKey: "parkovaci-system",
    hints: {
      wiring: bullets([
        "Připoj ultrazvukový snímač na napájení a signální piny podle typu modulu.",
        "Tři LED dej na tři výstupní piny, každou přes rezistor.",
        "Buzzer zapoj jako další výstup, pokud ho chceš použít.",
      ]),
      code: bullets([
        "Nejdřív změř vzdálenost senzorem a ulož ji do proměnné.",
        "Podle hranic, např. 20 cm a 5 cm, přepínej jednotlivé LED.",
        "Pro kritickou vzdálenost přidej digitalWrite() nebo tone() pro buzzer.",
      ]),
    },
  },
];

const expertTasks: Task[] = [
  {
    id: "expert-servo",
    sectionId: "expert",
    title: "Servo motor",
    description:
      "Ovládej servo pomocí potenciometru a mapuj analogovou hodnotu na rozsah úhlů serva.",
    reward: 5,
    imageKey: "servo-motor",
    hints: {
      wiring: bullets([
        "Potenciometr zapoj mezi 5V a GND, střední vývod dej na analogový vstup.",
        "Servo připoj na napájení, zem a signální pin.",
        "Signál serva veď na vhodný řídicí pin a spoj všechny země dohromady.",
      ]),
      code: bullets([
        "Použij knihovnu Servo a vytvoř objekt serva.",
        "Načti analogRead() z potenciometru a převeď hodnotu pomocí map().",
        "Odešli výsledek do serva pomocí write().",
      ]),
    },
  },
  {
    id: "expert-arduino-piano",
    sectionId: "expert",
    title: "Arduino piano",
    description:
      "Pomocí více tlačítek zahraj na buzzer různé tóny jako jednoduché mini piano.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Zapoj více tlačítek na samostatné vstupní piny.",
        "Piezo buzzer připoj na výstupní pin a GND.",
        "Tlačítka zapoj tak, aby měla stabilní klidový stav a vzájemně se nerušila.",
      ]),
      code: bullets([
        "V loop postupně kontroluj jednotlivá tlačítka přes digitalRead().",
        "Každému tlačítku přiřaď jinou frekvenci v tone().",
        "Pokud není aktivní žádné tlačítko, vypni zvuk pomocí noTone().",
      ]),
    },
  },
  {
    id: "expert-servo-loop",
    sectionId: "expert",
    title: "Loop servo",
    description:
      "Rozhýbej servo sem a tam v plynulé smyčce a řiď jeho pohyb v obou směrech.",
    reward: 5,
    imageKey: "loop-servo",
    hints: {
      wiring: bullets([
        "Použij jednoduché zapojení serva s napájením a signálním pinem.",
        "Napájení serva nech stabilní a společnou zem spoj s Arduinem.",
        "Není potřeba další vstup, pokud servo není řízené potenciometrem.",
      ]),
      code: bullets([
        "Udržuj aktuální úhel v proměnné a v každém kroku jej zvětšuj nebo zmenšuj.",
        "Při dosažení hranic 0 a 180 obrať směr pohybu.",
        "Mezi kroky nech malé delay() pro plynulý efekt.",
      ]),
    },
  },
  {
    id: "expert-rgb-loop",
    sectionId: "expert",
    title: "RGB mixer",
    description:
      "Namixuj barvu RGB LED pomocí tří potenciometrů a vytvoř vlastní světelné scény.",
    reward: 5,
    imageKey: "loop-rgb",
    hints: {
      wiring: bullets([
        "RGB LED připoj na tři výstupní piny přes rezistory.",
        "Každý potenciometr zapoj mezi 5V a GND, střední vývod vede na vlastní analogový vstup.",
        "Dohlídni na správnou orientaci RGB LED a společnou zem.",
      ]),
      code: bullets([
        "Čti hodnoty ze tří analogových vstupů, např. A0, A1 a A2.",
        "Podle hodnot nastav výstupy pomocí analogWrite().",
        "Pokud je třeba, hodnoty zmapuj na rozsah 0 až 255.",
      ]),
    },
  },
  {
    id: "expert-reaction-game",
    sectionId: "expert",
    title: "Reakční hra",
    description:
      "Po náhodné době se rozsvítí LED. Hráč musí co nejrychleji zmáčknout tlačítko, jinak prohraje nebo podvádí.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Použij jednu LED na výstupu a jedno tlačítko na vstupu.",
        "Tlačítko musí mít jasně definovaný klidový stav.",
        "LED připoj přes rezistor a mysli na společnou zem.",
      ]),
      code: bullets([
        "Vygeneruj náhodné čekání pomocí random() a vyčkej na rozsvícení LED.",
        "Před startem kontroluj, jestli hráč nedrží tlačítko.",
        "Po rozsvícení LED měř dobu do stisku a podle výsledku oznam úspěch nebo podvádění.",
      ]),
    },
  },
  {
    id: "expert-led-roulette",
    sectionId: "expert",
    title: "LED ruleta",
    description:
      "Vytvoř řadu LED, která se po stisku tlačítka nejdřív rozjede, pak zpomalí a zastaví na náhodné diodě.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Připrav řadu více LED na samostatných výstupních pinech.",
        "Tlačítko přidej jako spouštěč sekvence.",
        "Každou LED připoj přes vlastní rezistor.",
      ]),
      code: bullets([
        "Ukládej si seznam výstupních pinů LED do pole.",
        "Postupně rozsvěcuj jednotlivé LED s měnícím se zpožděním mezi kroky.",
        "Před koncem zpomaluj a ukonči animaci na náhodně zvoleném indexu.",
      ]),
    },
  },
  {
    id: "expert-smart-barrier",
    sectionId: "expert",
    title: "Automatická závora",
    description:
      "Spoj ultrazvukový senzor a servo tak, aby se závora otevřela při příjezdu auta a po chvíli zase zavřela.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Připoj ultrazvukový senzor na napájení a signální piny.",
        "Servo zapoj na napájení, GND a signální výstup.",
        "Pro lepší orientaci můžeš přidat LED, která ukáže stav otevřeno nebo zavřeno.",
      ]),
      code: bullets([
        "Použij funkci pro měření vzdálenosti podobně jako u parkovacího systému.",
        "Podle změřené hodnoty nastav servo do otevřené nebo zavřené polohy.",
        "Pro stabilnější chování doplň podmínku s millis() nebo krátkým delay() mezi změnami stavu.",
      ]),
    },
  },
  {
    id: "expert-servo-lock",
    sectionId: "expert",
    title: "Kódový zámek se servem",
    description:
      "Pomocí tlačítek nebo sériového vstupu simuluj zadání kódu a po správném heslu odemkni servo zámek.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Servo připoj na napájení, GND a řídicí pin.",
        "Jako vstup použij tlačítka nebo sériový monitor podle zvolené varianty.",
        "Při použití více tlačítek si připrav jasné rozdělení, co které tlačítko zadává.",
      ]),
      code: bullets([
        "Ulož si správný kód do proměnné nebo pole.",
        "Sbírej vstup a po dokončení ho porovnej s očekávanou hodnotou.",
        "Při správné shodě nastav servo do otevřené polohy a po chvíli ho zavři.",
      ]),
    },
  },
  {
    id: "expert-joystick-servo",
    sectionId: "expert",
    title: "Joystick + servo",
    description:
      "Ovládej servo joystickem a přidej aspoň dva režimy, třeba přesné řízení a rychlý návrat do středu.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Joystick zapoj na 5V, GND a analogové výstupy os.",
        "Servo připoj na napájení, GND a signální pin.",
        "Pokud joystick obsahuje i tlačítko, můžeš ho použít pro změnu režimu.",
      ]),
      code: bullets([
        "Čti hodnotu z analogové osy joysticku.",
        "Pomocí map() ji převeď na rozsah serva 0 až 180.",
        "Pro další režim použij tlačítko joysticku nebo další podmínku v programu.",
      ]),
    },
  },
  {
    id: "expert-dht-station",
    sectionId: "expert",
    title: "Meteostanice DHT",
    description:
      "Pomocí DHT11 nebo DHT22 měř teplotu a vlhkost a zobrazuj nebo signalizuj, jak se mění prostředí.",
    reward: 5,
    hints: {
      wiring: bullets([
        "DHT senzor zapoj na napájení, GND a datový pin podle typu modulu v Tinkercadu.",
        "Jako výstup použij LED, buzzer nebo jen sériový monitor.",
        "Předem si ověř, jak Tinkercad pracuje s vybraným DHT modulem.",
      ]),
      code: bullets([
        "Použij připravený blok nebo knihovnu pro čtení DHT senzoru.",
        "Pravidelně čti teplotu a vlhkost a ukládej je do proměnných.",
        "Pomocí if podmínek rozliš, kdy je prostředí moc suché, moc teplé nebo v pořádku.",
      ]),
    },
  },
  {
    id: "expert-smart-greenhouse",
    sectionId: "expert",
    title: "Chytrý skleník",
    description:
      "Spoj fotorezistor, DHT a výstupy do jednoho automatického systému, který reaguje na světlo i teplotu.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Fotorezistor zapoj na analogový vstup jako dělič napětí.",
        "DHT senzor připoj na samostatný datový pin.",
        "Jako výstup použij více LED nebo buzzer pro různé alarmové stavy.",
      ]),
      code: bullets([
        "Čti hodnoty z obou senzorů v jednom programu.",
        "Rozděl si chování na více stavů, např. tma, horko, sucho, ideální stav.",
        "Kombinuj více if podmínek nebo použij jednodušší stavovou logiku.",
      ]),
    },
  },
  {
    id: "expert-parking-display",
    sectionId: "expert",
    title: "Parkovací asistent s displejem",
    description:
      "Rozšiř parkovací systém o 7-segment display, který ukazuje zóny nebo orientační vzdálenost.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Připoj ultrazvukový senzor stejně jako v parkovacím systému.",
        "7-segment display zapoj na výstupní piny přes rezistory.",
        "LED nebo buzzer nech jako doplňkovou signalizaci blízkosti.",
      ]),
      code: bullets([
        "Nejdřív změř vzdálenost a rozhodni, co se má ukázat.",
        "Pro zobrazení připrav segmenty pro čísla nebo zónové hodnoty 1, 2, 3.",
        "Vedle displeje udrž i logiku pro LED nebo zvuk podle vzdálenosti.",
      ]),
    },
  },
  {
    id: "expert-memory-game",
    sectionId: "expert",
    title: "Paměťová hra",
    description:
      "Vytvoř sekvenci světel nebo tónů, kterou musí hráč zopakovat ve správném pořadí.",
    reward: 5,
    hints: {
      wiring: bullets([
        "Použij více tlačítek jako vstupy a více LED nebo buzzer jako výstupy.",
        "Každý vstup i výstup drž oddělené a přehledně označené.",
        "Pro jednoduchou variantu stačí tři tlačítka a tři LED.",
      ]),
      code: bullets([
        "Sekvenci si ulož do pole a přehrávej ji ve smyčce.",
        "Čti vstupy od hráče a porovnávej je s očekávanými hodnotami.",
        "Při chybě oznam neúspěch, při správné sekvenci přidej další krok nebo pochvalu.",
      ]),
    },
  },
];

export const SECTIONS: Section[] = [
  {
    id: "beginner",
    label: "Začátečník",
    tasks: beginnerTasks,
  },
  {
    id: "advanced",
    label: "Pokročilý",
    unlockCost: SECTION_UNLOCK_COSTS.advanced,
    tasks: advancedTasks,
  },
  {
    id: "expert",
    label: "Expert",
    unlockCost: SECTION_UNLOCK_COSTS.expert,
    tasks: expertTasks,
  },
];

export function getAllTasks(): Task[] {
  return SECTIONS.flatMap((s) => s.tasks);
}

export function findTask(id: string): Task | undefined {
  return getAllTasks().find((t) => t.id === id);
}

export function findSectionByTaskId(id: string): Section | undefined {
  return SECTIONS.find((s) => s.tasks.some((t) => t.id === id));
}
