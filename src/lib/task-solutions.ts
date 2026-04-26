/**
 * Per-task bulk validators + canonical reference solutions.
 *
 * Ported 1:1 from legacy-vanilla/app.js:
 *   - TASK_SOLUTION_CODE → app.js TASK_SOLUTIONS (lines 168-659): canonical
 *     Arduino C++ source shown via the "Reseni" hint. NOT used for validation.
 *   - TASK_SOLUTIONS (Record<string, Validator>) → app.js taskSpecificChecks
 *     lambdas (lines 2806-3054): per-task bulk checks returning {ok,message}.
 *   - validateTaskCode() → app.js getCodeValidationResult (lines 2759-3058):
 *     the same orchestration — empty-draft check, base Arduino shape, strict
 *     rules first, bulk validator catch-all.
 *
 * Naming note: the plan's "TASK_SOLUTIONS as Record<string, Validator>" is the
 * v2 NEW shape; Štěpán's `taskSpecificChecks` already had this shape inline.
 * The legacy string-map is renamed `TASK_SOLUTION_CODE` to disambiguate.
 *
 * IMPORTANT: do NOT improve regexes/conditions here — that's a v2.1+ task.
 * Any obscure trick (e.g. the buzzer "direct mirror" allowance) is replicated
 * literally with a comment. All callers consume {ok, message} only — never
 * mix `valid`/`feedback` naming.
 */

import type { ValidationResult } from "@/types";
import {
  countMatches,
  hasAll,
  hasAny,
  normalizeCodeForValidation,
} from "./validation";
import { STRICT_TASK_RULES } from "./strict-rules";

type Validator = (normalized: string) => ValidationResult;

// ---------------------------------------------------------------------------
// Canonical reference solutions (from app.js TASK_SOLUTIONS string map).
// Used by the "Reseni" help card in TaskDetail. NOT consumed by validation.
// ---------------------------------------------------------------------------
export const TASK_SOLUTION_CODE: Record<string, string> = {
  "beginner-led": `// C++ code
//
int X = 0;

void setup()
{
  pinMode(7, INPUT);
  pinMode(8, OUTPUT);
}

void loop()
{
  X = digitalRead(7);
  if (X == 1) {
    digitalWrite(8, HIGH);
  } else {
    digitalWrite(8, LOW);
  }
  delay(500); // Wait for 500 millisecond(s)
}`,
  "beginner-potentiometer": `// C++ code
//
int X = 0;

void setup()
{
  pinMode(A3, INPUT);
  Serial.begin(9600);
}

void loop()
{
  X = analogRead(A3);
  Serial.println(X);
  delay(500); // Wait for 500 millisecond(s)
}`,
  "beginner-and-or": `// C++ code
//
int A = 0;
int B = 0;

void setup()
{
  pinMode(2, INPUT);
  pinMode(3, INPUT);
  pinMode(8, OUTPUT);
  pinMode(9, OUTPUT);
}

void loop()
{
  A = digitalRead(2);
  B = digitalRead(3);

  if (A == 1 || B == 1) {
    digitalWrite(8, HIGH);
  } else {
    digitalWrite(8, LOW);
  }

  if (A == 1 && B == 1) {
    digitalWrite(9, HIGH);
  } else {
    digitalWrite(9, LOW);
  }
}`,
  "beginner-traffic-light": `// C++ code
//
void setup()
{
  pinMode(9, OUTPUT);
  pinMode(8, OUTPUT);
  pinMode(7, OUTPUT);
}

void loop()
{
  digitalWrite(9, HIGH);
  delay(3000); // Wait for 3000 millisecond(s)
  digitalWrite(8, HIGH);
  delay(1000); // Wait for 1000 millisecond(s)
  digitalWrite(9, LOW);
  digitalWrite(8, LOW);
  digitalWrite(7, HIGH);
  delay(3000); // Wait for 3000 millisecond(s)
  digitalWrite(7, LOW);
  digitalWrite(8, HIGH);
  delay(1000); // Wait for 1000 millisecond(s)
  digitalWrite(8, LOW);
}`,
};

// ---------------------------------------------------------------------------
// Per-task bulk validators. Each receives the *normalized* code string and
// returns {ok, message}. Ported verbatim from app.js taskSpecificChecks
// (lines 2806-3054). The catch-all `{ ok: true }` mirrors the legacy
// `taskCheck ? taskCheck() : { ok: true }` fallback at line 3057.
// ---------------------------------------------------------------------------
export const TASK_SOLUTIONS: Record<string, Validator> = {
  "beginner-led": (normalized) => {
    const readsInput = countMatches(normalized, /digitalread\s*\(/g) >= 1;
    const writesOutput = normalized.includes("digitalwrite");
    const hasCondition = hasAny(normalized, ["if(", "if (", "?", " else "]);
    if (!readsInput) {
      return { ok: false, message: "U LED ukolu ti chybi blok, ktery cte stav tlacitka nebo jineho vstupu." };
    }
    if (!hasCondition) {
      return { ok: false, message: "Zkus pridat podminku typu kdyz plati..., aby se podle tlacitka rozhodlo, co ma LED delat." };
    }
    if (!writesOutput) {
      return { ok: false, message: "V programu chybi blok, ktery nastavi LED na zapnuto nebo vypnuto." };
    }
    return { ok: true };
  },
  "beginner-potentiometer": (normalized) => {
    if (countMatches(normalized, /analogread\s*\(/g) < 1) {
      return { ok: false, message: "Zkus pridat blok pro cteni analogove hodnoty z potenciometru." };
    }
    if (!hasAny(normalized, ["serial.begin", "serial.println", "serial.print"])) {
      return { ok: false, message: "Chybi blok, ktery vypise namerenou hodnotu do serioveho monitoru." };
    }
    return { ok: true };
  },
  "beginner-and-or": (normalized) => {
    const reads = countMatches(normalized, /digitalread\s*\(/g);
    const writes = countMatches(normalized, /digitalwrite\s*\(/g);
    const hasLogic = hasAny(normalized, ["&&", "||"]);
    if (reads < 2) {
      return { ok: false, message: "Tady potrebujes precist dva vstupy. Zkontroluj, ze mas bloky pro obe tlacitka." };
    }
    if (!hasLogic) {
      return { ok: false, message: "Zkus v blocich pouzit logiku A nebo NEBO, aby program dokazal porovnat oba vstupy." };
    }
    if (writes < 1) {
      return { ok: false, message: "Program by mel podle vysledku logiky ovladat aspon jednu LED." };
    }
    return { ok: true };
  },
  "beginner-traffic-light": (normalized) => {
    const outputWrites = countMatches(normalized, /digitalwrite\s*\(/g);
    const delays = countMatches(normalized, /delay\s*\(/g);
    if (outputWrites < 3) {
      return { ok: false, message: "Semafor potrebuje vic kroku pro prepinani svetel. Pridej dalsi bloky pro zapnuti a vypnuti LED." };
    }
    if (delays < 2) {
      return { ok: false, message: "Mezi zmenami svetel ti nejspis chybi blok cekani." };
    }
    return { ok: true };
  },
  "beginner-buzzer-button": (normalized) => {
    const buttonReads = countMatches(normalized, /digitalread\s*\(/g);
    const hasSound = hasAny(normalized, ["tone(", "notone(", "digitalwrite(", "analogwrite("]);
    if (buttonReads < 1) {
      return { ok: false, message: "Nejdriv potrebujes blok, ktery precte stav tlacitka." };
    }
    // Obscure trick from source: allow "direct mirror" expressions like
    // analogWrite(9, digitalRead(8)) to satisfy the "needs a condition"
    // check, since they functionally mirror the button straight to the pin.
    const hasDirectMirror =
      /(?:analogwrite|digitalwrite)\s*\(\s*9\s*,\s*digitalread\s*\(\s*8\s*\)\s*\)/.test(normalized);
    if (!hasAny(normalized, ["if(", "if ("]) && !hasDirectMirror) {
      return { ok: false, message: "Pridej podminku, aby zvuk bezel jen kdyz je tlacitko stisknute, nebo primo prenes stav tlacitka na vystup." };
    }
    if (!hasSound) {
      return { ok: false, message: "Chybi blok, ktery spusti nebo vypne zvuk na bzucaku." };
    }
    return { ok: true };
  },
  "beginner-light-sensor": (normalized) => {
    const lightRead = countMatches(normalized, /analogread\s*\(/g) >= 1;
    const ledReaction = hasAny(normalized, ["digitalwrite(", "analogwrite("]);
    if (!lightRead) {
      return { ok: false, message: "Chybi blok pro cteni hodnoty z fotorezistoru." };
    }
    if (!hasAny(normalized, ["if(", "if ("])) {
      return { ok: false, message: "Zkus pridat podminku, ktera rozhodne, kdy je uz dost tma na rozsviceni LED." };
    }
    if (!ledReaction) {
      return { ok: false, message: "Program by mel podle svetla zmenit stav LED." };
    }
    return { ok: true };
  },
  "advanced-stair-light": (normalized) => {
    const reads = countMatches(normalized, /digitalread\s*\(/g);
    const hasTiming = hasAny(normalized, ["millis(", "delay("]);
    if (reads < 2) {
      return { ok: false, message: "Schodistove svetlo potrebuje cist dve tlacitka nebo dva vstupy." };
    }
    if (!hasTiming) {
      return { ok: false, message: "Chybi blok pro casovani, aby LED nezhasla hned." };
    }
    if (!hasAny(normalized, ["if(", "if ("])) {
      return { ok: false, message: "Zkus pridat podminky pro rozsviceni a pozdejsi zhasnuti svetla." };
    }
    return { ok: true };
  },
  "advanced-crosswalk": (normalized) => {
    const outputWrites = countMatches(normalized, /digitalwrite\s*\(/g);
    const inputReads = countMatches(normalized, /digitalread\s*\(/g);
    if (inputReads < 1) {
      return { ok: false, message: "Prechod potrebuje blok, ktery cte tlacitko pro chodce." };
    }
    if (outputWrites < 4) {
      return { ok: false, message: "Cyklus semaforu je zatim moc kratky. Pridej vic kroku pro prepinani svetel." };
    }
    if (!hasAny(normalized, ["if(", "if ("])) {
      return { ok: false, message: "Nejdriv rozhodni podminkou, kdy se ma spustit semaforovy cyklus." };
    }
    return { ok: true };
  },
  "advanced-parking": (normalized) => {
    const hasDistanceMeasure = hasAny(normalized, ["pulsein(", "ultrasonic", "distance", "readultrasonicdistance"]);
    const hasReaction = hasAny(normalized, ["digitalwrite(", "tone(", "serial.println", "serial.print"]);
    if (!hasDistanceMeasure) {
      return { ok: false, message: "Chybi cast programu, ktera zmeri vzdalenost ze senzoru." };
    }
    if (!hasReaction) {
      return { ok: false, message: "Po mereni by mel program nejak reagovat: LED, bzucak nebo vypis hodnoty." };
    }
    return { ok: true };
  },
  "advanced-motion": (normalized) => {
    if (countMatches(normalized, /digitalread\s*\(/g) < 1) {
      return { ok: false, message: "Chybi blok, ktery cte signal z PIR senzoru." };
    }
    if (!hasAny(normalized, ["if(", "if ("])) {
      return { ok: false, message: "Pridej podminku, ktera rozpozna pohyb a spusti reakci." };
    }
    if (!hasAny(normalized, ["serial.println", "serial.print", "digitalwrite("])) {
      // Note: source uses "rozsviť" with diacritic — preserved verbatim.
      return { ok: false, message: "Po detekci pohybu by mel program neco udelat: rozsviť LED nebo vypis zpravu." };
    }
    return { ok: true };
  },
  "advanced-temperature-alarm": (normalized) => {
    const tempRead = countMatches(normalized, /analogread\s*\(/g) >= 1;
    const hasDecision = hasAny(normalized, ["if(", "if (", " else "]);
    const hasAlarmOutput = hasAny(normalized, ["digitalwrite(", "analogwrite(", "tone(", "serial.println", "serial.print"]);
    if (!tempRead) {
      return { ok: false, message: "Nejdriv potrebujes precist hodnotu z teplotniho senzoru." };
    }
    if (!hasDecision) {
      return { ok: false, message: "Zkus rozdelit teplotu do vice stavu pomoci podminek kdyz - jinak kdyz - jinak." };
    }
    if (!hasAlarmOutput) {
      return { ok: false, message: "Program by mel podle teploty ovladat LED nebo bzucak." };
    }
    return { ok: true };
  },
  "advanced-counter": (normalized) => {
    const reads = countMatches(normalized, /digitalread\s*\(/g);
    const hasCounterChange = hasAny(normalized, ["++", "--", "+=", "-="]);
    const hasSerialOutput = hasAny(normalized, ["serial.println", "serial.print"]);
    if (reads < 2) {
      return { ok: false, message: "Pocitadlo potrebuje dva vstupy: jeden pro plus a druhy pro minus." };
    }
    if (!hasCounterChange) {
      return { ok: false, message: "Chybi krok, kde se hodnota promenne zvysi nebo snizi." };
    }
    if (!hasSerialOutput) {
      // Note: source uses Czech diacritics here — preserved verbatim.
      return { ok: false, message: "Po změně by měl program vypsat aktuální číslo do sériového monitoru." };
    }
    return { ok: true };
  },
  "expert-servo": (normalized) => {
    if (!hasAll(normalized, ["servo", "attach", "write"])) {
      return { ok: false, message: "U serva ti chybi bloky pro pripojeni serva a nastaveni jeho polohy." };
    }
    if (!hasAny(normalized, ["analogread(", "map("])) {
      return { ok: false, message: "Zkus precist vstup z potenciometru a prevest ho na uhel serva." };
    }
    return { ok: true };
  },
  "expert-servo-loop": (normalized) => {
    const hasLooping = hasAny(normalized, ["while(", "for("]);
    if (!hasAll(normalized, ["servo", "attach", "write"])) {
      return { ok: false, message: "Servo potrebuje blok pro pripojeni a bloky pro zmenu polohy." };
    }
    if (!hasLooping) {
      return { ok: false, message: "Plynuly pohyb chce opakovani vice kroku za sebou. Pridej smycku nebo opakovani." };
    }
    return { ok: true };
  },
  "expert-rgb-loop": (normalized) => {
    const analogReads = countMatches(normalized, /analogread\s*\(/g);
    const analogWrites = countMatches(normalized, /analogwrite\s*\(/g);
    if (analogReads < 3) {
      return { ok: false, message: "RGB mixer potrebuje precist tri vstupy, jeden pro kazdou barvu." };
    }
    if (analogWrites < 3) {
      return { ok: false, message: "Chybi bloky, ktere nastavi cervenou, zelenou i modrou slozku LED." };
    }
    return { ok: true };
  },
  "expert-reaction-game": (normalized) => {
    const hasDelayOrTime = hasAny(normalized, ["random(", "millis(", "delay("]);
    const hasButtonRead = countMatches(normalized, /digitalread\s*\(/g) >= 1;
    const hasOutputReaction = hasAny(normalized, ["digitalwrite(", "serial.println", "serial.print"]);
    if (!hasDelayOrTime) {
      return { ok: false, message: "Reakcni hra potrebuje cekani nebo nahodny cas pred startem kola." };
    }
    if (!hasButtonRead) {
      return { ok: false, message: "Chybi blok, ktery precte reakci hrace na tlacitku." };
    }
    if (!hasOutputReaction) {
      return { ok: false, message: "Po startu hry by se mela LED rozsvitit nebo by se mel vypsat vysledek." };
    }
    return { ok: true };
  },
  "expert-led-roulette": (normalized) => {
    const outputWrites = countMatches(normalized, /digitalwrite\s*\(/g);
    const hasLooping = hasAny(normalized, ["for(", "while("]);
    if (outputWrites < 2) {
      return { ok: false, message: "Ruleta potrebuje vic kroku pro prepinani LED mezi sebou." };
    }
    if (!hasLooping) {
      return { ok: false, message: "Animace se nejlip sklada opakovanim. Pridej smycku nebo vice opakovanych kroku." };
    }
    if (!hasAny(normalized, ["random(", "delay("])) {
      return { ok: false, message: "Zkus pridat cekani mezi kroky a nejaky nahodny prvek pro finalni zastaveni." };
    }
    return { ok: true };
  },
  "expert-arduino-piano": (normalized) => {
    const buttonReads = countMatches(normalized, /digitalread\s*\(/g);
    const hasToneControl = hasAny(normalized, ["tone(", "notone("]);
    if (buttonReads < 2) {
      return { ok: false, message: "Piano potrebuje cist vic tlacitek, aby kazde hralo jiny ton." };
    }
    if (!hasAny(normalized, ["if(", "if ("])) {
      return { ok: false, message: "Pridej podminky, ktere podle stisku vyberou spravny ton." };
    }
    if (!hasToneControl) {
      return { ok: false, message: "Chybi bloky pro prehrani a zastaveni tonu." };
    }
    return { ok: true };
  },
  "expert-smart-barrier": (normalized) => {
    const hasServoControl = hasAll(normalized, ["servo", "attach", "write"]);
    const hasDistanceMeasure = hasAny(normalized, ["pulsein(", "distance", "readultrasonicdistance"]);
    if (!hasDistanceMeasure) {
      return { ok: false, message: "Automaticka zavora potrebuje nejdriv zmerit vzdalenost senzorem." };
    }
    if (!hasServoControl) {
      return { ok: false, message: "Chybi bloky, ktere servu reknou, kdy ma otevrit a kdy zavrit." };
    }
    if (!hasAny(normalized, ["if(", "if ("])) {
      return { ok: false, message: "Pridej podminku, ktera rozhodne, kdy je auto dost blizko na otevreni zavory." };
    }
    return { ok: true };
  },
};

// ---------------------------------------------------------------------------
// Orchestrator — single entry point used by the UI. Mirrors app.js
// getCodeValidationResult (lines 2759-3058):
//   1. empty draft → friendly nudge.
//   2. base Arduino shape (setup + loop + at least one Arduino call).
//   3. STRICT_TASK_RULES first matching failure wins.
//   4. Per-task bulk validator catch-all.
//   5. If neither strict rules nor a bulk validator exist for a task,
//      we accept (mirrors `taskCheck ? taskCheck() : { ok: true }`).
// ---------------------------------------------------------------------------
export function validateTaskCode(taskId: string, rawCode: string): ValidationResult {
  const trimmed = rawCode.trim();
  if (!trimmed) {
    return {
      ok: false,
      message: "Nejdriv sloz aspon zaklad programu v blocich a preved ho do kodu.",
    };
  }

  const normalized = normalizeCodeForValidation(trimmed);

  // Base Arduino shape — must have setup(), loop(), and at least one
  // Arduino-specific call. Ported from app.js lines 2770-2793.
  const hasSetup = /\bsetup\s*\(/.test(normalized);
  const hasLoop = /\bloop\s*\(/.test(normalized);
  const hasArduinoAction =
    normalized.includes("digitalwrite") ||
    normalized.includes("digitalread") ||
    normalized.includes("analogread") ||
    normalized.includes("analogwrite") ||
    normalized.includes("pinmode") ||
    normalized.includes("serial.") ||
    normalized.includes("servo");

  if (!(hasSetup && hasLoop && hasArduinoAction)) {
    if (!hasSetup || !hasLoop) {
      return {
        ok: false,
        message: "V blocich ti nejspis chybi zakladni cast programu: blok pro start a blok, ktery se porad opakuje.",
      };
    }
    return {
      ok: false,
      message: "Program zatim nevypada jako Arduino reseni. Zkus pridat bloky pro cteni, rozhodovani nebo ovladani soucastek.",
    };
  }

  // Granular strict rules — first failing pattern wins.
  const strictRules = STRICT_TASK_RULES[taskId];
  if (strictRules?.length) {
    const failedRule = strictRules.find((rule) => !rule.pattern.test(normalized));
    if (failedRule) {
      return { ok: false, message: failedRule.message };
    }
  }

  // Bulk validator catch-all. Tasks without an entry are accepted (matches
  // legacy `taskCheck ? taskCheck() : { ok: true }`).
  const validator = TASK_SOLUTIONS[taskId];
  if (!validator) {
    return { ok: true };
  }
  return validator(normalized);
}
