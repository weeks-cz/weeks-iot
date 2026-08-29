"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Circle, Lightbulb, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert, Card, MonoLabel, Stepper } from "@/components/ui/Surface";
import { CircuitBuilder } from "@/features/circuit/components/CircuitBuilder";
import { checkWiring } from "@/features/circuit/wiring-check";
import type { Circuit } from "@/features/circuit/types";
import { CodeEditor } from "./CodeEditor";
import { useBuzzerSound } from "./useBuzzerSound";
import { NO_FRAMES, useFramePlayer } from "./useFramePlayer";
import { clearDraft, loadDraft, saveDraft } from "../draft";
import { runLessonChecks, type LessonRunResult } from "../run-check";
import { lessonSeedCircuit } from "../seed-circuit";
import type { Lesson } from "../types";

const STEPS = ["Zadání", "Zapojení", "Program"] as const;

interface Props {
  lesson: Lesson;
  /**
   * Zavolá se, až dítě projde všemi kontrolami. Zapíše postup.
   *
   * `hintsUsed` je počet nápověd, které si po cestě vyžádalo. Ukládá se
   * k postupu, protože „dokončeno na první dobrou" a „dokončeno se všemi
   * nápovědami" jsou o té lekci dvě úplně jiné zprávy.
   */
  onSolved: (hintsUsed: number) => void;
  /** Zavolá se, až si dítě výsledek prohlédne a chce jít dál. */
  onContinue: () => void;
  /** Nahlásí vyžádanou nápovědu — z toho se pozná, kde lekce drhne. */
  onHint?: (kind: "wiring" | "code", index: number) => void;
}

/**
 * Průchod lekcí.
 *
 * Tři kroky: přečti zadání, zapoj obvod, napiš program. Pořadí není
 * kosmetické — kdo napíše kód dřív, než zapojí, uvidí mrtvý obvod a
 * nepozná, jestli je chyba v kódu, nebo v drátcích.
 *
 * ── Proč se kontroluje chování, a ne text kódu ─────────────────────────────
 * Program se doopravdy spustí nad obvodem, který dítě postavilo. Projde
 * každé řešení, které funguje — i to, které nás nenapadlo. Původní kontrola
 * porovnávala kód se vzorem a u nočního světla vyžadovala proměnnou
 * pojmenovanou přesně `svetlo`; kdo napsal `hodnota`, dostal chybu za
 * funkční program.
 */
export function LessonWorkbench({ lesson, onSolved, onContinue, onHint }: Props) {
  const seed = useMemo(() => lessonSeedCircuit(lesson), [lesson]);

  const [step, setStep] = useState(0);
  const [circuit, setCircuit] = useState<Circuit>(seed);
  const [code, setCode] = useState(lesson.starterCode);
  const [wiringChecked, setWiringChecked] = useState(false);
  const [hints, setHints] = useState({ wiring: 0, code: 0 });
  const [run, setRun] = useState<LessonRunResult | null>(null);
  const [solved, setSolved] = useState(false);

  const stepHeading = useRef<HTMLHeadingElement>(null);
  const restored = useRef(false);

  /* Rozpracovaná lekce z minula.
     Načíst se dá jedině tady: localStorage na serveru není, takže obnovit
     ji přes počáteční hodnotu useState nejde — server by vykreslil
     startovní kód, klient uložený a hydratace by se rozešla. Je to jednorázové
     přečtení vnějšího stavu po připojení, ne řetězení stavů. */
  useEffect(() => {
    const draft = loadDraft(lesson.slug);
    if (!draft) return;

    restored.current = true;
    /* eslint-disable react-hooks/set-state-in-effect -- jednorázové přečtení
       vnějšího stavu po připojení, ne řetězení stavů; viz komentář výše. */
    setCode(draft.code);
    setCircuit(draft.circuit);
    /* Kdo se vrací k rozdělané práci, nechce znovu číst zadání. */
    setStep(1);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [lesson.slug]);

  useEffect(() => {
    /* Netknutá lekce se neukládá — jinak by se konceptem stalo i to, že
       ji dítě jen otevřelo a zavřelo. */
    if (!restored.current && code === lesson.starterCode && circuit === seed) return;
    saveDraft(lesson.slug, { code, circuit });
  }, [lesson.slug, lesson.starterCode, code, circuit, seed]);

  /* Po přepnutí kroku se fokus přesune na jeho nadpis. Bez toho zůstane
     na tlačítku, které zmizelo, a kdo jede klávesnicí, se ztratí. */
  useEffect(() => {
    stepHeading.current?.focus();
  }, [step]);

  const wiring = useMemo(() => checkWiring(circuit, lesson.wiring), [circuit, lesson.wiring]);

  const player = useFramePlayer(run?.preview ?? NO_FRAMES);
  const buzzer = player.frame?.buzzers.find((b) => b.frequency > 0);
  useBuzzerSound(buzzer?.frequency ?? 0, player.playing);

  const onCircuitChange = useCallback((next: Circuit) => {
    setCircuit(next);
    /* Změna zapojení zneplatní starý výsledek. Nechat na obrazovce zelené
       fajfky z předchozího obvodu by bylo lhaní. */
    setRun(null);
  }, []);

  function revealHint(kind: "wiring" | "code") {
    const shown = hints[kind] + 1;
    setHints({ ...hints, [kind]: shown });
    onHint?.(kind, shown);
  }

  function handleRun() {
    /* Přehrávání spustí sám přehrávač, jakmile dostane nové snímky.
       Volat to odsud by znamenalo sáhnout na stav, který se v tomhle
       renderu ještě nezměnil. */
    const result = runLessonChecks(lesson, circuit, code);
    setRun(result);

    if (result.passed && !solved) {
      setSolved(true);
      clearDraft(lesson.slug);
      onSolved(hints.wiring + hints.code);
    }
  }

  /* Součástky, o kterých mluví první nesplněný bod zapojení. Builder je
     orámuje, aby dítě nehledalo „tu LED" mezi pěti.

     Arduino a breadboard se nezvýrazňují: jsou na ploše vždycky a rámeček
     kolem celé desky neřekne nic. Zajímavá je ta součástka, která do
     spoje patří a chybí. */
  const workspaceRoles = new Set(
    lesson.wiring.parts
      .filter((p) => p.type === "arduino-uno" || p.type === "breadboard-half")
      .map((p) => p.role),
  );

  const flagged = (wiring.issues[0]?.roles ?? [])
    .filter((role) => !workspaceRoles.has(role))
    .map((role) => wiring.roles?.[role])
    .filter((id): id is string => Boolean(id));

  const firstUnmet = run?.outcomes.find((o) => !o.passed);

  return (
    <div className="flex flex-col gap-6">
      <Stepper steps={STEPS} current={step} label="Postup lekcí" />

      {step === 0 && (
        <section className="flex flex-col gap-5">
          {/* Cíl lekce je v hlavičce stránky; opakovat ho tady by z něj
              udělalo dvojitý nadpis nad sebou. */}
          <h2 ref={stepHeading} tabIndex={-1} className="heading-3 outline-none">
            Co tě čeká
          </h2>

          <div className="flex flex-col gap-3">
            {lesson.brief.map((paragraph) => (
              <p key={paragraph} className="max-w-prose leading-relaxed text-ink-700">
                {paragraph}
              </p>
            ))}
          </div>

          {lesson.concept && (
            <Card className="border-l-4 border-l-primary-600 p-5">
              <MonoLabel className="mb-2">Nová věc</MonoLabel>
              <h3 className="mb-2 font-semibold text-ink">{lesson.concept.title}</h3>
              <p className="max-w-prose leading-relaxed text-ink-500">{lesson.concept.body}</p>
            </Card>
          )}

          <div>
            <Button size="lg" onClick={() => setStep(1)}>
              Jdu na to →
            </Button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <h2 ref={stepHeading} tabIndex={-1} className="heading-3 outline-none">
            Zapoj obvod
          </h2>

          <p className="max-w-prose leading-relaxed text-ink-500">
            Součástky vezmi z palety a spoj je drátky. Až budeš myslet, že je to
            správně, dej zkontrolovat.
          </p>

          <CircuitBuilder
            palette={lesson.palette}
            initialCircuit={circuit}
            onChange={onCircuitChange}
            flagged={flagged}
            onReset={() => {
              setCircuit(seed);
              setWiringChecked(false);
              setRun(null);
            }}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setWiringChecked(true)}>Zkontrolovat zapojení</Button>

            {hints.wiring < lesson.wiringHints.length && (
              <button
                type="button"
                onClick={() => revealHint("wiring")}
                className="inline-flex items-center gap-1.5 rounded-sm text-sm text-ink-500 underline underline-offset-4 hover:text-ink"
              >
                <Lightbulb className="h-4 w-4" aria-hidden="true" />
                {hints.wiring === 0 ? "Poradit" : "Poradit víc"}
              </button>
            )}

            <span className="font-mono text-xs text-ink-300">
              {wiring.satisfied} z {wiring.total} spojů sedí
            </span>
          </div>

          {hints.wiring > 0 && (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink-500">
              {lesson.wiringHints.slice(0, hints.wiring).map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          )}

          {wiringChecked && wiring.ok && (
            <Alert tone="success" title="Zapojení sedí">
              Obvod je hotový. Teď mu řekneš, co má dělat.
            </Alert>
          )}

          {wiringChecked && !wiring.ok && wiring.issues[0] && (
            /* Jedna hláška, ne seznam. Pět chyb naráz je pro dítě totéž
               jako „všechno je špatně". */
            <Alert tone="warning" title="Ještě něco chybí">
              {wiring.issues[0].hint}
            </Alert>
          )}

          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => setStep(0)}>
              ← Zpátky na zadání
            </Button>
            {wiring.ok && (
              <Button size="lg" onClick={() => setStep(2)}>
                Napsat program →
              </Button>
            )}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-4">
          <h2 ref={stepHeading} tabIndex={-1} className="heading-3 outline-none">
            Napiš program
          </h2>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <CodeEditor
                value={code}
                onChange={(next) => {
                  setCode(next);
                  setRun(null);
                }}
                errorLine={run?.error?.line ?? null}
              />

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleRun}>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Spustit
                </Button>

                {player.playing && (
                  <Button variant="ghost" onClick={player.stop}>
                    <Square className="h-3.5 w-3.5" aria-hidden="true" />
                    Zastavit
                  </Button>
                )}

                {hints.code < lesson.codeHints.length && (
                  <button
                    type="button"
                    onClick={() => revealHint("code")}
                    className="inline-flex items-center gap-1.5 rounded-sm text-sm text-ink-500 underline underline-offset-4 hover:text-ink"
                  >
                    <Lightbulb className="h-4 w-4" aria-hidden="true" />
                    {hints.code === 0 ? "Poradit" : "Poradit víc"}
                  </button>
                )}
              </div>

              {hints.code > 0 && (
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink-500">
                  {lesson.codeHints.slice(0, hints.code).map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {/* Tady se obvod už jen ukazuje. Kdo potřebuje zapojení
                  změnit, vrátí se o krok zpátky — jinak by se dalo
                  nedopatřením přetáhnout drátek při sledování běhu. */}
              <CircuitBuilder
                palette={lesson.palette}
                initialCircuit={circuit}
                onChange={onCircuitChange}
                frame={player.frame}
                readOnly
                height={300}
              />

              {run?.error && (
                <Alert tone="danger" title={`Chyba na řádku ${run.error.line}`}>
                  {run.error.message}
                </Alert>
              )}

              {run && !run.error && (
                <Card className="p-4">
                  <MonoLabel className="mb-3">Kontrola</MonoLabel>

                  <ul className="flex flex-col gap-2">
                    {run.outcomes.map((outcome) => (
                      <li key={outcome.label} className="flex items-start gap-2 text-sm">
                        {outcome.passed ? (
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 text-trust-600"
                            aria-hidden="true"
                          />
                        ) : (
                          <Circle
                            className="mt-0.5 h-4 w-4 shrink-0 text-ink-300"
                            aria-hidden="true"
                          />
                        )}
                        <span className={outcome.passed ? "text-ink-500" : "text-ink"}>
                          {outcome.label}
                          <span className="sr-only">
                            {outcome.passed ? " — splněno" : " — zatím ne"}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  {firstUnmet && (
                    <p className="mt-3 border-t border-ink/10 pt-3 text-sm leading-relaxed text-ink-500">
                      {firstUnmet.hint}
                    </p>
                  )}
                </Card>
              )}

              {run?.passed && (
                <>
                  <Alert tone="success" title="Funguje to!">
                    Program dělá přesně to, co měl. Podívej se, jak obvod běží —
                    a až se vynadíváš, pojď dál.
                  </Alert>

                  <div>
                    <Button size="lg" onClick={onContinue}>
                      Mám hotovo →
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <Button variant="ghost" onClick={() => setStep(1)}>
              ← Zpátky k zapojení
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
