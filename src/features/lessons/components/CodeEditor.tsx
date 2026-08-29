"use client";

import { useEffect, useMemo, useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Řádek, na kterém se program zasekl. Číslováno od jedné. */
  errorLine?: number | null;
  disabled?: boolean;
  rows?: number;
}

/**
 * Editor kódu.
 *
 * Textové pole s číslovanými řádky, nic víc. Zvažoval jsem plnohodnotný
 * editor (CodeMirror), ale pro třicet řádků Arduino kódu to znamená stovky
 * kilobajtů navíc a spoustu chování, které dítě nečeká — automatické
 * doplňování, které mu do kódu přidá věci, co tam nenapsalo.
 *
 * ── Proč Tab nezachytáváme ─────────────────────────────────────────────────
 * Odsazování tabulátorem je lákavé, ale Tab je jediná cesta, jak se z pole
 * dostat klávesnicí ven. Kdo edituje kód jen klávesnicí, byl by v něm
 * uvězněný. Odsazení se místo toho doplní samo po Enteru.
 */
export function CodeEditor({ value, onChange, errorLine, disabled, rows = 14 }: Props) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => value.split("\n").length, [value]);

  /* Čísla řádků se posouvají spolu s textem. */
  useEffect(() => {
    const area = areaRef.current;
    const gutter = gutterRef.current;
    if (!area || !gutter) return;

    const sync = () => {
      gutter.scrollTop = area.scrollTop;
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
          className="max-h-full shrink-0 overflow-hidden bg-black/25 px-2 py-3 text-right font-mono text-xs leading-6 text-paper/35 select-none"
        >
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} className={errorLine === i + 1 ? "font-bold text-danger-300" : undefined}>
              {i + 1}
            </div>
          ))}
        </div>

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
          aria-label="Kód programu"
          className="w-full resize-y bg-transparent px-3 py-3 font-mono text-sm leading-6 text-paper outline-none placeholder:text-paper/30 disabled:opacity-60"
        />
      </div>
    </div>
  );
}
