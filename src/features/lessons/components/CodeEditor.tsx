"use client";

import { useEffect, useMemo, useRef } from "react";
import { highlight, type HighlightKind } from "@/features/arduino/highlight";

interface Props {
  value: string;
  onChange: (value: string) => void;
  /**
   * Řádek, na který se má dítě podívat — chyba překladu nebo příkaz
   * schovaný v komentáři. Číslováno od jedné.
   */
  markedLine?: number | null;
  disabled?: boolean;
  rows?: number;
}

/**
 * Editor kódu.
 *
 * Textové pole s číslovanými řádky a obarvenou syntaxí, nic víc. Zvažoval
 * jsem plnohodnotný editor (CodeMirror), ale pro třicet řádků Arduino kódu
 * to znamená stovky kilobajtů navíc a spoustu chování, které dítě nečeká —
 * automatické doplňování, které mu do kódu přidá věci, co tam nenapsalo.
 *
 * ── Proč se barví ──────────────────────────────────────────────────────────
 * Jednobarevný text stál dítě celou lekci. Napsalo `pinMode(led, OUTPUT);`
 * do řádku, který už `//` měl — a protože komentář vypadal úplně stejně
 * jako kód, nemělo jak poznat, že jeho program je prázdný. Kontrola pak
 * hlásila „LED nesvítí" a nápověda radila napsat přesně to, co dítě mělo
 * na obrazovce před sebou. Šedý komentář tuhle past ukazuje bez jediného
 * slova navíc.
 *
 * ── Jak překrytí funguje ───────────────────────────────────────────────────
 * Obarvený `<pre>` leží pod průhledným `<textarea>`. Obě vrstvy musí mít
 * ÚPLNĚ stejné písmo, velikost, prokládání i odsazení — jeden pixel rozdílu
 * a text se rozejde s kurzorem. Proto jsou ty třídy schválně opsané dvakrát
 * a ne vytažené do proměnné: kdo je změní na jednom místě, uvidí to rozbité
 * hned, ne až u dítěte.
 *
 * ── Proč Tab nezachytáváme ─────────────────────────────────────────────────
 * Odsazování tabulátorem je lákavé, ale Tab je jediná cesta, jak se z pole
 * dostat klávesnicí ven. Kdo edituje kód jen klávesnicí, byl by v něm
 * uvězněný. Odsazení se místo toho doplní samo po Enteru.
 */

/* Barvy na tmavém podkladu. Komentář je nejtlumenější schválně: má být
   čitelný, ale na první pohled odlišný od živého kódu.

   Amber tu není. Je vyhrazená hlavní akci a tlačítko „Spustit" stojí
   pár pixelů pod editorem — dvě amber plochy vedle sebe by si braly
   pozornost navzájem. */
const COLOR: Record<HighlightKind, string> = {
  comment: "text-ink-300",
  keyword: "text-primary-300",
  call: "text-accent-300",
  number: "text-trust-300",
  string: "text-trust-200",
  text: "",
};

export function CodeEditor({ value, onChange, markedLine, disabled, rows = 14 }: Props) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLPreElement>(null);

  const lines = useMemo(() => value.split("\n").length, [value]);
  const tokens = useMemo(() => highlight(value), [value]);

  /* Čísla řádků i barevná vrstva se posouvají spolu s textem. Vodorovně
     taky: dlouhý řádek se odroluje do strany a barvy musí jet s ním. */
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;

    const sync = () => {
      if (gutterRef.current) gutterRef.current.scrollTop = area.scrollTop;
      if (layerRef.current) {
        layerRef.current.scrollTop = area.scrollTop;
        layerRef.current.scrollLeft = area.scrollLeft;
      }
    };
    area.addEventListener("scroll", sync);
    return () => area.removeEventListener("scroll", sync);
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;

    const area = e.currentTarget;
    const upToCaret = area.value.slice(0, area.selectionStart);
    const currentLine = upToCaret.slice(upToCaret.lastIndexOf("\n") + 1);
    const indent = /^[ \t]*/.exec(currentLine)?.[0] ?? "";

    /* Za otevírající složenou závorkou se odsazuje o dvě mezery víc.
       Bez toho si dítě po chvíli píše všechno u levého okraje a v kódu se
       přestane vyznat — což je přesně ta chvíle, kdy to vzdá. */
    const extra = currentLine.trimEnd().endsWith("{") ? "  " : "";
    if (!indent && !extra) return;

    e.preventDefault();
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const inserted = `\n${indent}${extra}`;
    const next = area.value.slice(0, start) + inserted + area.value.slice(end);

    onChange(next);

    requestAnimationFrame(() => {
      area.selectionStart = area.selectionEnd = start + inserted.length;
    });
  }

  return (
    <div className="overflow-hidden rounded-md border border-ink/20 bg-ink text-paper">
      <div className="flex">
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="max-h-full shrink-0 overflow-hidden bg-black/25 px-2 py-3 text-right font-mono text-[0.8rem] leading-7 text-paper/35 select-none"
        >
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className={markedLine === i + 1 ? "font-bold text-danger-300" : undefined}>
              {i + 1}
            </div>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Barevná vrstva. Text v ní se nedá označit ani do ní kliknout —
              všechno obsluhuje pole nad ní. */}
          <pre
            ref={layerRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden px-3 py-3 font-mono text-[0.9375rem] leading-7 whitespace-pre text-paper select-none"
          >
            {tokens.map((token, i) => (
              <span key={i} className={COLOR[token.kind]}>
                {token.value}
              </span>
            ))}
            {/* Bez zakončení chybí poslední prázdný řádek a vrstva se při
                psaní na konci souboru odroluje jinam než textové pole. */}
            {"\n"}
          </pre>

          <textarea
            ref={areaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled}
            rows={rows}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            aria-label="Kód programu"
            /* Bez zalamování schválně: jeden řádek kódu = jeden řádek na
               obrazovce, jinak by čísla vlevo ukazovala na něco jiného než
               text vedle nich. Dlouhý řádek se odroluje do strany. */
            /* O stupeň větší než jinde: kód se čte znak po znaku a rozdíl
               mezi `;` a `:` musí být vidět bez mhouření. */
            /* Text je průhledný — vidět je vrstva pod ním. Kurzor a výběr
               průhledné nejsou, jinak by dítě nevědělo, kde píše. */
            className="relative block w-full resize-y overflow-x-auto bg-transparent px-3 py-3 font-mono text-[0.9375rem] leading-7 whitespace-pre text-transparent caret-paper outline-none selection:bg-primary-500/40 disabled:opacity-60"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Kód jen k přečtení — vzorové řešení.
 *
 * Barvy jsou stejné jako v editoru schválně: dítě má poznat, že se dívá
 * na totéž, jen se do toho nedá psát.
 */
export function CodeView({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-ink/20 bg-ink px-3 py-3 font-mono text-[0.875rem] leading-7 whitespace-pre text-paper">
      {highlight(code).map((token, i) => (
        <span key={i} className={COLOR[token.kind]}>
          {token.value}
        </span>
      ))}
    </pre>
  );
}
