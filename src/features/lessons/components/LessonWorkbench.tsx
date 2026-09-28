"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Braces, Check, Circle, Eye, Hand, Lightbulb, Play, Puzzle, Square, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert, Card, MonoLabel, Stepper } from "@/components/ui/Surface";
import { BlockEditor } from "@/features/blocks/components/BlockEditor";
import { loadEditorMode, saveEditorMode, type EditorMode } from "@/features/blocks/mode";
import { blocksToArduino, paletteFor, type WorkspaceState } from "@/features/blocks/program";
import { CircuitBuilder } from "@/features/circuit/components/CircuitBuilder";
import { useWokwiElements } from "@/features/circuit/components/useWokwiElements";
import { checkWiring } from "@/features/circuit/wiring-check";
import type { Circuit } from "@/features/circuit/types";
import { Celebration } from "./Celebration";
import { CodeEditor, CodeView } from "./CodeEditor";
import { PartsIntro } from "./PartsIntro";
import { CurrentStep, StepList } from "./WiringGuide";
import { useBuzzerSound } from "./useBuzzerSound";
import { NO_FRAMES, useFramePlayer } from "./useFramePlayer";
import { applyStep } from "../apply-step";
import { clearDraft, loadDraft, saveDraft } from "../draft";
import { runLessonChecks, type LessonRunResult } from "../run-check";
import { lessonSeedCircuit } from "../seed-circuit";
import { vocabularyFor } from "../vocabulary";
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
  /* Bloky, nebo kód. Bloky jsou výchozí: mladší děti syntaxe zastaví
     dřív, než pochopí, co program dělá. Obojí se překládá do téhož
     Arduino C a jde do téže kontroly. */
  const [mode, setMode] = useState<EditorMode>("blocks");
  const [blocks, setBlocks] = useState<WorkspaceState>(lesson.blocks.starter);
  const [pushedBlocks, setPushedBlocks] = useState<WorkspaceState | null>(null);
  /* Kód vzniklý z bloků při posledním přepnutí. Když ho dítě upraví,
     přepnutí zpátky na bloky ty úpravy zahodí — bloky kód číst neumí —
     a na to se musí zeptat dřív, než se to stane. */
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [confirmBlocks, setConfirmBlocks] = useState(false);
  const [wiringChecked, setWiringChecked] = useState(false);
  const [hints, setHints] = useState({ wiring: 0, code: 0 });
  /* Úniková cesta z obou kroků. Zaseknout se doteď znamenalo konec lekce:
     nápovědy jednou dojdou a dál nebylo nic. Do postupu se to počítá jednou
     za krok, ne za každé kliknutí — jinak by osm zapojených drátků vypadalo
     jako osm nápověd. */
  const [assisted, setAssisted] = useState({ wiring: false, code: false });
  const [showSolution, setShowSolution] = useState(false);
  /* Obvod poslaný do plochy. Musí to být pokaždé nový objekt — builder si
     obvod drží sám a porovnává reference. */
  const [pushed, setPushed] = useState<Circuit | null>(null);
  const [run, setRun] = useState<LessonRunResult | null>(null);
  const [running, setRunning] = useState(false);
  /* Tlačítka, která dítě právě drží. Simulace se s nimi přepočítá, takže
     stisk je vidět na obvodu okamžitě — a lekce o tlačítku má konečně
     smysl. */
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const [solved, setSolved] = useState(false);
  /* Rozdělaná práce z minula. Ukazuje se jako nabídka, ne jako skok:
     dřív se rovnou přepnulo na zapojování a dítě, které lekci jen kdysi
     otevřelo, se ocitlo v kroku 3 ze 4 bez zadání a bez seznámení se
     součástkami — a nechápalo proč. */
  const [hasDraft, setHasDraft] = useState(false);
  const partsReady = useWokwiElements();

  const stepHeading = useRef<HTMLHeadingElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const firstStep = useRef(true);

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
       vnějšího stavu po připojení, ne řetězení stavů; localStorage na
       serveru není, takže dřív to načíst nejde. */
    setCode(draft.code);
    setCircuit(draft.circuit);
    if (draft.blocks) setBlocks(draft.blocks);
    setHasDraft(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [lesson.slug]);

  useEffect(() => {
    /* Netknutá lekce se neukládá — jinak by se konceptem stalo i to, že
       ji dítě jen otevřelo a zavřelo. */
    const untouched =
      code === lesson.starterCode && circuit === seed && blocks === lesson.blocks.starter;
    if (!restored.current && untouched) return;
    saveDraft(lesson.slug, { code, circuit, blocks });
  }, [lesson.slug, lesson.starterCode, lesson.blocks.starter, code, circuit, blocks, seed]);

  /* Režim si prohlížeč pamatuje napříč lekcemi. Číst se dá až po
     připojení, ze stejného důvodu jako koncept výš. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- jednorázové přečtení localStorage
    setMode(loadEditorMode());
  }, []);

  const generated = useMemo(() => blocksToArduino(blocks), [blocks]);
  const blockPalette = useMemo(() => paletteFor(lesson.blocks.solution), [lesson.blocks.solution]);
  /* To, co se opravdu spustí. */
  const source = mode === "blocks" ? generated.code : code;
  const codeHints = mode === "blocks" ? lesson.blocks.hints : lesson.codeHints;

  function switchToCode() {
    setGeneratedCode(generated.code);
    setCode(generated.code);
    setMode("code");
    saveEditorMode("code");
    setConfirmBlocks(false);
    setRun(null);
  }

  function switchToBlocks(confirmed = false) {
    const edited = generatedCode === null ? code !== lesson.starterCode : code !== generatedCode;
    if (edited && !confirmed) {
      setConfirmBlocks(true);
      return;
    }
    setConfirmBlocks(false);
    setMode("blocks");
    saveEditorMode("blocks");
    setRun(null);
  }

  /* Po přepnutí kroku se fokus přesune na jeho nadpis. Bez toho zůstane
     na tlačítku, které zmizelo, a kdo jede klávesnicí, se ztratí.

     A rovnou se na ten nadpis odroluje: hlavička lekce je vysoká skoro
     čtyři sta pixelů, takže po přepnutí na zapojování by dítě koukalo na
     titulek a plocha, na které má pracovat, by byla mimo obrazovku. */
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }

    stepHeading.current?.focus({ preventScroll: true });
    /* Až po vykreslení nového kroku. Hned po přepnutí měla stránka ještě
       výšku toho starého, rolovalo se na špatné místo a nadpis kroku
       skončil schovaný pod lepivou hlavičkou. */
    const id = requestAnimationFrame(() =>
      stepHeading.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
    return () => cancelAnimationFrame(id);
  }, [step]);

  /* Úspěch a „Mám hotovo" jsou v pravém sloupci pod náhledem a kontrolou,
     na notebooku pod okrajem. Dítě by vidělo konfety, ale ne tlačítko,
     které vede dál. */
  const passed = Boolean(run?.passed);
  useEffect(() => {
    if (!passed) return;
    const id = requestAnimationFrame(() =>
      successRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
    return () => cancelAnimationFrame(id);
  }, [passed]);

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

  /* Nápovědy došly a dítě pořád neví. Do postupu se to hlásí jako nápověda
     za poslední nápovědou — z toho se v číslech pozná, kde lekce drhne
     natolik, že si na ni sama nestačí. */
  function markAssist(kind: "wiring" | "code", total: number) {
    if (assisted[kind]) return;
    setAssisted({ ...assisted, [kind]: true });
    onHint?.(kind, total + 1);
  }

  /**
   * Jeden krok zapojení za dítě.
   *
   * Jeden, ne celý obvod: na ploše má být vidět, CO přibylo. Další krok
   * pak většinou udělá samo.
   */
  function assistWiring() {
    if (!step2) return;

    const next = applyStep(circuit, step2);
    setCircuit(next);
    setPushed(next);
    setWiringChecked(false);
    setRun(null);
    markAssist("wiring", lesson.wiringHints.length);
  }

  function revealSolution() {
    setShowSolution(true);
    markAssist("code", codeHints.length);
  }

  /* Přepočet běhu, když dítě zmáčkne nebo pustí tlačítko. Program se
     pustí znovu s novým stavem obvodu — jinak by stisk nic neudělal. */
  const rerun = useCallback(
    (held: Set<string>) => {
      setRun((prev) => (prev ? runLessonChecks(lesson, circuit, source, held) : prev));
    },
    [lesson, circuit, source],
  );

  const handlePress = useCallback(
    (compId: string, down: boolean) => {
      setPressed((prev) => {
        const next = new Set(prev);
        if (down) next.add(compId);
        else next.delete(compId);
        rerun(next);
        return next;
      });
    },
    [rerun],
  );

  function handleRun() {
    /* Kontrola je synchronní a u jednoduchého programu doběhne dřív, než
       stihne prohlížeč překreslit — kliknutí by pak vypadalo, že se nic
       nestalo. Krátká prodleva dá tlačítku čas ukázat, že se něco děje. */
    setRunning(true);
    setRun(null);

    window.setTimeout(() => {
      /* Přehrávání spustí sám přehrávač, jakmile dostane nové snímky.
         Volat to odsud by znamenalo sáhnout na stav, který se v tomhle
         renderu ještě nezměnil. */
      const result = runLessonChecks(lesson, circuit, source, pressed);
      setRun(result);
      setRunning(false);

      if (result.passed && !solved) {
        setSolved(true);
        clearDraft(lesson.slug);
        onSolved(hints.wiring + hints.code + Number(assisted.wiring) + Number(assisted.code));
      }
    }, 160);
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

  /* Součástky, se kterými se dá při běhu hýbat. Zatím jen tlačítka. */
  const interactive = circuit.comps.filter((c) => c.type === "pushbutton");

  /* Tahák k příkazům téhle lekce. Vybírá se podle vzorového řešení —
     má obsahovat to, co dítě bude potřebovat, ne to, co už napsalo. */
  const vocabulary = vocabularyFor(lesson.solution);

  return (
    <div className="flex flex-col gap-6">
      {/* Odměna za dvacet minut práce. Zelený rámeček je oznámení,
          konfety jsou odměna — a ten rozdíl je přesně to, proč se
          v Duolingu chce pokračovat. */}
      <Celebration active={solved} />

      <Stepper steps={STEPS} current={step} label="Postup lekcí" tone="loud" />

      {step === STEP.BRIEF && (
        <section className="flex flex-col gap-5">
          {hasDraft && !solved && (
            <div className="animate-slide-in flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary-600 bg-primary-50 px-4 py-3">
              <p className="text-sm font-semibold text-primary-800">
                Minule jsi tu nechal{"\u00a0"}rozdělanou práci.
              </p>
              <Button size="sm" variant="outline" onClick={() => setStep(STEP.WIRING)}>
                Pokračovat, kde jsem skončil →
              </Button>
            </div>
          )}

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

          {/* Na širší obrazovce postup a tlačítka vedle plochy, ne pod ní.
              Na notebooku s výškou 750 px byl pod 560px plochou schovaný
              celý postup i jediné tlačítko, které vede dál — dítě
              zapojilo obvod a nevidělo, co teď. */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
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
              height={520}
              toolbar={<CurrentStep steps={steps} current={step2} />}
              pushCircuit={pushed}
              resetTo={seed}
              onReset={() => {
                setWiringChecked(false);
                setRun(null);
              }}
            />

            <div className="flex flex-col gap-4">
              {/* Jedno amber tlačítko, a to to, které vede dál. Dokud obvod
                  nesedí, je to kontrola; jakmile sedí, „Napsat program". Dvě
                  amber tlačítka vedle sebe dítěti neříkají, kam kliknout. */}
              {wiring.ok ? (
                <Button
                  size="lg"
                  fullWidth
                  className="animate-glow"
                  onClick={() => setStep(STEP.CODE)}
                >
                  Napsat program →
                </Button>
              ) : (
                /* Dokud zbývají kroky, není kontrola to hlavní — hlavní je
                   další krok návodu (amber kartička v paletě, blikající
                   piny). Amber dostane, až dítě projde všechny kroky
                   a obvod pořád nesedí. */
                <Button
                  size="lg"
                  fullWidth
                  variant={step2 ? "outline" : "primary"}
                  onClick={() => setWiringChecked(true)}
                >
                  Zkontrolovat zapojení
                </Button>
              )}

              {wiringChecked && !wiring.ok && wiring.issues[0] && (
                /* Jedna hláška, ne seznam. Pět chyb naráz je pro dítě totéž
                   jako „všechno je špatně". */
                <Alert tone="warning" title="Ještě něco chybí">
                  {wiring.issues[0].hint}
                </Alert>
              )}

              {hints.wiring > 0 && (
                <HintList hints={lesson.wiringHints.slice(0, hints.wiring)} />
              )}

              {hints.wiring < lesson.wiringHints.length && (
                <Button variant="outline" onClick={() => revealHint("wiring")}>
                  <Lightbulb className="h-4 w-4" aria-hidden="true" />
                  {hints.wiring === 0 ? "Nevím si rady" : "Poradit víc"}
                </Button>
              )}

              {/* Nápovědy došly. Bez tohohle končí lekce tady: tlačítko
                  „Napsat program" se objeví teprve, když zapojení sedí. */}
              {hints.wiring >= lesson.wiringHints.length && step2 && (
                <Button variant="outline" onClick={assistWiring}>
                  <Wand2 className="h-4 w-4" aria-hidden="true" />
                  Zapoj tenhle krok za mě
                </Button>
              )}

              <StepList steps={steps} current={step2} />

            </div>
          </div>

          <div>
            <Button variant="ghost" onClick={() => setStep(STEP.PARTS)}>
              ← Zpátky k součástkám
            </Button>
          </div>
        </section>
      )}

      {step === STEP.CODE && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 ref={stepHeading} tabIndex={-1} className="heading-3 outline-none">
              {mode === "blocks" ? "Poskládej program" : "Napiš program"}
            </h2>

            {/* Přepínač je vidět vždycky. Kdo bloky nepotřebuje, nemá je
                hledat v nastavení; kdo s kódem nezvládá, má kam utéct. */}
            <div
              role="group"
              aria-label="Jak chceš programovat"
              className="inline-flex rounded-md border border-ink bg-paper p-1"
            >
              <button
                type="button"
                aria-pressed={mode === "blocks"}
                onClick={() => mode !== "blocks" && switchToBlocks()}
                className={`inline-flex min-h-11 items-center gap-2 rounded px-4 font-semibold transition-colors ${
                  mode === "blocks" ? "bg-ink text-paper" : "text-ink-500 hover:text-ink"
                }`}
              >
                <Puzzle className="h-4 w-4" aria-hidden="true" />
                Bloky
              </button>
              <button
                type="button"
                aria-pressed={mode === "code"}
                onClick={() => mode !== "code" && switchToCode()}
                className={`inline-flex min-h-11 items-center gap-2 rounded px-4 font-semibold transition-colors ${
                  mode === "code" ? "bg-ink text-paper" : "text-ink-500 hover:text-ink"
                }`}
              >
                <Braces className="h-4 w-4" aria-hidden="true" />
                Kód
              </button>
            </div>
          </div>

          {confirmBlocks && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-cta-600 bg-cta-50 px-4 py-3"
            >
              <p className="max-w-prose leading-relaxed text-ink">
                Kód, který jsi napsal, bloky přečíst neumí. V blocích budeš pokračovat tam, kde
                jsi je nechal, a tvoje úpravy kódu se ztratí.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setConfirmBlocks(false)}>
                  Zůstat u kódu
                </Button>
                <Button size="sm" variant="secondary" onClick={() => switchToBlocks(true)}>
                  Přepnout na bloky
                </Button>
              </div>
            </div>
          )}

          <div
            className={`grid gap-4 ${
              mode === "blocks" ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : "lg:grid-cols-2"
            }`}
          >
            <div className="flex flex-col gap-3">
              {mode === "code" && vocabulary.length > 0 && (
                <div className="rounded-md border border-ink/15 bg-paper-soft p-4">
                  <p className="mb-3 font-display text-lg font-semibold">
                    Tahák — příkazy téhle lekce
                  </p>
                  <dl className="flex flex-col gap-3">
                    {vocabulary.map((entry) => (
                      <div key={entry.needle} className="leading-snug">
                        <dt className="inline rounded-sm bg-ink px-1.5 py-0.5 font-mono text-sm text-paper">
                          {entry.syntax}
                        </dt>{" "}
                        <dd className="mt-1 inline text-ink-500">{entry.what}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {/* Spustit nad editorem, ne pod ním: pod dlouhým programem
                 bylo tlačítko za okrajem obrazovky a dítě psalo, ale nevědělo,
                 čím to pustit. */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Po úspěchu přebírá amber „Mám hotovo" — spustit znovu jde
                    pořád, ale už to není to hlavní, co má dítě udělat. */}
                <Button
                  size="lg"
                  variant={run?.passed ? "outline" : "primary"}
                  onClick={handleRun}
                  loading={running}
                  disabled={running}
                >
                  {!running && <Play className="h-5 w-5" aria-hidden="true" />}
                  {running ? "Spouštím…" : run?.passed ? "Spustit znovu" : "Spustit"}
                </Button>

                {player.playing && (
                  <Button variant="ghost" onClick={player.stop}>
                    <Square className="h-3.5 w-3.5" aria-hidden="true" />
                    Zastavit
                  </Button>
                )}

                {hints.code < codeHints.length && (
                  <Button size="sm" variant="outline" onClick={() => revealHint("code")}>
                    <Lightbulb className="h-4 w-4" aria-hidden="true" />
                    {hints.code === 0 ? "Nevím si rady" : "Poradit víc"}
                  </Button>
                )}

                {/* Poslední východisko. Do téhle chvíle dítě prošlo všechny
                    nápovědy — teprve teď je to opravdu slepá ulička. */}
                {hints.code >= codeHints.length && !showSolution && (
                  <Button size="sm" variant="outline" onClick={revealSolution}>
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    Ukázat řešení
                  </Button>
                )}
              </div>

              {mode === "blocks" ? (
                <>
                  <BlockEditor
                    initial={blocks}
                    palette={blockPalette}
                    pushState={pushedBlocks}
                    onChange={(next) => {
                      setBlocks(next);
                      setRun(null);
                    }}
                    height={480}
                  />

                  {/* Bloky mimo program nic nedělají — a dítě, které je
                      nechalo ležet vedle, nechápe, proč se nic neděje. */}
                  {generated.loose > 0 && (
                    <p className="rounded-md border-l-4 border-cta-600 bg-cta-50 px-3 py-2 leading-relaxed text-ink-700">
                      {generated.loose === 1 ? "Jeden blok leží" : "Některé bloky leží"} mimo
                      program, takže nic {generated.loose === 1 ? "nedělá" : "nedělají"}. Připoj{" "}
                      {generated.loose === 1 ? "ho" : "je"} do „na začátku jednou“ nebo „pak
                      pořád dokola“.
                    </p>
                  )}

                  {/* Most ke kódu. Dítě vidí, co jeho bloky znamenají, a až
                      přepne na kód, nebude to skok do neznáma. */}
                  <details className="group rounded-md border border-ink/15 bg-paper">
                    <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold text-ink-700">
                      Takhle to vypadá v kódu
                    </summary>
                    <div className="border-t border-ink/10 p-3">
                      <CodeView code={generated.code} />
                    </div>
                  </details>
                </>
              ) : (
                <CodeEditor
                  value={code}
                  onChange={(next) => {
                    setCode(next);
                    setRun(null);
                  }}
                  /* Chyba překladu i příkaz schovaný v komentáři ukazují na
                     řádek. Bez toho musí dítě hledat „řádek 6" očima. */
                  markedLine={run?.error?.line ?? run?.silent?.line ?? null}
                />
              )}

              {hints.code > 0 && <HintList hints={codeHints.slice(0, hints.code)} />}

              {showSolution && mode === "blocks" && (
                <Card className="p-4">
                  <MonoLabel className="mb-3">Řešení</MonoLabel>
                  <p className="leading-relaxed text-ink-700">
                    Řešení ti poskládáme do bloků. Spustit ho musíš sám — a mrkni, čím se liší
                    od toho, co jsi měl.
                  </p>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        /* Nový objekt pokaždé — editor porovnává reference. */
                        const next = structuredClone(lesson.blocks.solution);
                        setBlocks(next);
                        setPushedBlocks(next);
                        setRun(null);
                      }}
                    >
                      Poskládat řešení do bloků
                    </Button>
                  </div>
                </Card>
              )}

              {showSolution && mode === "code" && (
                <Card className="p-4">
                  <MonoLabel className="mb-3">Řešení</MonoLabel>

                  <CodeView code={lesson.solution} />

                  <p className="mt-3 text-sm leading-relaxed text-ink-500">
                    Přepiš si to, nebo si to nech vložit. Spustit to musíš sám —
                    a mrkni, čím se to liší od toho, co jsi měl.
                  </p>

                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCode(lesson.solution);
                        setRun(null);
                      }}
                    >
                      Vložit do editoru
                    </Button>
                  </div>
                </Card>
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
                pressed={pressed}
                onPress={handlePress}
                readOnly
                /* Dost velký, aby byla vidět celá LED i celý obvod. Ve
                   třech stech pixelech se obvod ze sedmé lekce nevešel a
                   rozsvícení — to jediné, na co se dítě dívá — bylo
                   za okrajem. */
                height={380}
              />

              {/* Bez tohohle dítě netuší, že se dá sáhnout do obvodu — a
                  lekce, která na stisku stojí, mu přijde rozbitá. */}
              {interactive.length > 0 && (
                <p className="rounded-md border border-primary-600 bg-primary-50 px-3 py-2 text-sm leading-relaxed text-primary-800">
                  <Hand className="mr-1.5 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
                  {interactive.length > 1
                    ? "Tlačítka v obvodu si můžeš zmáčknout — podrž je a dívej se, co to udělá."
                    : "Tlačítko v obvodu si můžeš zmáčknout — podrž ho a dívej se, co to udělá."}
                </p>
              )}

              {run?.error && (
                <Alert
                  tone="danger"
                  title={
                    mode === "blocks"
                      ? "Program z bloků se nepodařilo spustit"
                      : `Chyba na řádku ${run.error.line}`
                  }
                >
                  {run.error.message}
                </Alert>
              )}

              {/* Program se přeložil a přitom neudělal vůbec nic. Doteď na to
                  nebyla hláška, takže dítě dostalo nápovědu „napiš
                  digitalWrite(led, HIGH)" ve chvíli, kdy tu větu mělo
                  zakomentovanou na obrazovce před sebou. */}
              {run?.silent && (
                <Alert tone="warning" title="Program zatím nic nedělá">
                  {mode === "blocks"
                    ? "Přetáhni bloky zleva do „na začátku jednou“ a „pak pořád dokola“ — co leží jinde, nic nedělá."
                    : run.silent.message}
                </Alert>
              )}

              {run && !run.error && (
                <Card className="p-4">
                  <MonoLabel className="mb-3">Kontrola</MonoLabel>

                  <ul className="flex flex-col gap-2">
                    {run.outcomes.map((outcome) => (
                      <li key={outcome.label} className="flex items-start gap-2.5 leading-snug">
                        {outcome.passed ? (
                          <Check
                            className="mt-0.5 h-5 w-5 shrink-0 text-trust-600"
                            aria-hidden="true"
                          />
                        ) : (
                          <Circle
                            className="mt-0.5 h-5 w-5 shrink-0 text-ink-300"
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

                  {firstUnmet && !run.silent && (
                    <p className="mt-3 border-t border-ink/10 pt-3 leading-relaxed text-ink-700">
                      {mode === "blocks" ? (firstUnmet.blockHint ?? firstUnmet.hint) : firstUnmet.hint}
                    </p>
                  )}
                </Card>
              )}

              {run?.passed && (
                <div ref={successRef} className="flex flex-col gap-3">
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
                </div>
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

/**
 * Vyžádané nápovědy.
 *
 * Dřív drobný šedý seznam pod tlačítky — přesně ve chvíli, kdy si dítě
 * řeklo o pomoc, dostalo nejhůř čitelný text na obrazovce. Nejnovější
 * nápověda je proto zvýrazněná a velká jako text lekce.
 */
function HintList({ hints }: { hints: string[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {hints.map((hint, i) => {
        const latest = i === hints.length - 1;
        return (
          <li
            key={hint}
            className={`lesson-body flex gap-3 rounded-md border px-4 py-3 ${
              latest
                ? "animate-slide-in border-primary-600 bg-primary-50 text-ink"
                : "border-ink/10 bg-paper text-ink-500"
            }`}
          >
            <Lightbulb
              className={`mt-1 h-5 w-5 shrink-0 ${latest ? "text-primary-600" : "text-ink-300"}`}
              aria-hidden="true"
            />
            <span>{hint}</span>
          </li>
        );
      })}
    </ol>
  );
}
