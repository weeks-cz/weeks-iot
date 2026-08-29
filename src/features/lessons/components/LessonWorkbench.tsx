"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Circle, Lightbulb, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert, Card, MonoLabel, Stepper } from "@/components/ui/Surface";
import { CircuitBuilder } from "@/features/circuit/components/CircuitBuilder";
import { useWokwiElements } from "@/features/circuit/components/useWokwiElements";
import { checkWiring } from "@/features/circuit/wiring-check";
import type { Circuit } from "@/features/circuit/types";
import { Celebration } from "./Celebration";
import { CodeEditor } from "./CodeEditor";
import { PartsIntro } from "./PartsIntro";
import { CurrentStep, StepList } from "./WiringGuide";
import { useBuzzerSound } from "./useBuzzerSound";
import { NO_FRAMES, useFramePlayer } from "./useFramePlayer";
import { clearDraft, loadDraft, saveDraft } from "../draft";
import { runLessonChecks, type LessonRunResult } from "../run-check";
import { lessonSeedCircuit } from "../seed-circuit";
import { currentStep, wiringSteps } from "../wiring-steps";
import type { Lesson } from "../types";

const STEPS = ["Zadání", "Součástky", "Zapojení", "Program"] as const;

/* Indexy kroků. Pojmenované, protože `step === 2` po pár týdnech nikdo
   nepřečte a přidání kroku doprostřed by tiše rozhodilo zbytek. */
const STEP = { BRIEF: 0, PARTS: 1, WIRING: 2, CODE: 3 } as const;

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
  const partsReady = useWokwiElements();

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
    setStep(STEP.WIRING);
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

  /* Zapojení rozložené na kroky. Odškrtává se samo podle obvodu, takže
     dítě smí zapojovat i v jiném pořadí, než navrhujeme. */
  const steps = useMemo(() => wiringSteps(circuit, lesson.wiring), [circuit, lesson.wiring]);
  const step2 = useMemo(() => currentStep(steps), [steps]);

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
      {/* Odměna za dvacet minut práce. Zelený rámeček je oznámení,
          konfety jsou odměna — a ten rozdíl je přesně to, proč se
          v Duolingu chce pokračovat. */}
      <Celebration active={solved} />

      <Stepper steps={STEPS} current={step} label="Postup lekcí" />

      {step === STEP.BRIEF && (
        <section className="flex flex-col gap-5">
          {/* Cíl lekce je v hlavičce stránky; opakovat ho tady by z něj
              udělalo dvojitý nadpis nad sebou. */}
          <h2 ref={stepHeading} tabIndex={-1} className="heading-3 outline-none">
            Co tě čeká
          </h2>

          <div className="flex flex-col gap-3">
            {lesson.brief.map((paragraph) => (
              <p key={paragraph} className="lesson-body max-w-prose text-ink-700">
                {paragraph}
              </p>
            ))}
          </div>

          {lesson.concept && (
            <Card className="border-l-4 border-l-primary-600 p-5">
              <MonoLabel className="mb-2">Nová věc</MonoLabel>
              <h3 className="mb-2 text-lg font-semibold text-ink">{lesson.concept.title}</h3>
              <p className="lesson-body max-w-prose text-ink-500">{lesson.concept.body}</p>
            </Card>
          )}

          <div>
            <Button size="lg" onClick={() => setStep(STEP.PARTS)}>
              Jdu na to →
            </Button>
          </div>
        </section>
      )}

      {step === STEP.PARTS && (
        <section className="flex flex-col gap-5">
          <h2 ref={stepHeading} tabIndex={-1} className="heading-3 outline-none">
            Seznam se se součástkami
          </h2>

          <p className="lesson-body max-w-prose text-ink-500">
            Tohle jsou všechny součástky, které budeš potřebovat. Podívej se na
            ně — za chvíli je budeš skládat dohromady.
          </p>

          <PartsIntro
            parts={["arduino-uno", ...lesson.palette]}
            ready={partsReady}
          />

          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => setStep(STEP.BRIEF)}>
              ← Zpátky na zadání
            </Button>
            <Button size="lg" onClick={() => setStep(STEP.WIRING)}>
              Jdu zapojovat →
            </Button>
          </div>
        </section>
      )}

      {step === STEP.WIRING && (
        <section className="flex flex-col gap-4">
          <h2 ref={stepHeading} tabIndex={-1} className="heading-3 outline-none">
            Zapoj obvod
          </h2>

          {/* Aktuální krok těsně nad plochou, celý seznam až pod ní. Celý
              průvodce nahoře plochu vytlačil z obrazovky a dítě pak rolovalo
              mezi tím, CO má udělat, a tím, KDE to má udělat. */}
          <CurrentStep steps={steps} current={step2} />

          <CircuitBuilder
            palette={lesson.palette}
            initialCircuit={circuit}
            onChange={onCircuitChange}
            flagged={flagged}
            /* Piny aktuálního kroku blikají, takže je vidět, kam kliknout.
               Bez toho je plocha les stejných teček. */
            highlightPins={step2?.pins}
            /* Krok „polož součástku" rozsvítí tu správnou kartičku
               v paletě, ať ji dítě nehledá podle názvu. */
            suggested={step2?.place ?? null}
            showPins
            /* Vyšší než jinde: v tomhle kroku se do plochy míří prstem
               a čím větší je, tím větší jsou rozestupy mezi nožičkami.
               Kdo chce ještě víc místa, roztáhne si ji přes celou
               obrazovku — návod pojede s ním. */
            height={560}
            toolbar={<CurrentStep steps={steps} current={step2} />}
            resetTo={seed}
            onReset={() => {
              setWiringChecked(false);
              setRun(null);
            }}
          />

          <StepList steps={steps} current={step2} />

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
            <Button variant="ghost" onClick={() => setStep(STEP.PARTS)}>
              ← Zpátky k součástkám
            </Button>
            {wiring.ok && (
              <Button size="lg" onClick={() => setStep(STEP.CODE)}>
                Napsat program →
              </Button>
            )}
          </div>
        </section>
      )}

      {step === STEP.CODE && (
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
                  <div className="animate-pop">
                    <Alert tone="success" title="Funguje to!">
                      Program dělá přesně to, co měl. Podívej se, jak obvod běží —
                      a až se vynadíváš, pojď dál.
                    </Alert>
                  </div>

                  <div>
                    <Button size="lg" className="animate-glow" onClick={onContinue}>
                      Mám hotovo →
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <Button variant="ghost" onClick={() => setStep(STEP.WIRING)}>
              ← Zpátky k zapojení
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
