"use client";

import { useEffect, useRef } from "react";

/** Víc řádků se nevykresluje — `Serial.println` ve smyčce bez delaye jich nasype tisíce. */
const MAX_LINES = 200;

/**
 * Sériový monitor — to, co by dítě vidělo v Arduino IDE.
 *
 * Simulace výpis počítala odjakživa, jen se nikde neukazoval. Lekce
 * o nočním světle přitom stojí na tom, že si dítě přečte, jaká čísla
 * senzor posílá, a podle nich si nastaví hranici.
 */
export function SerialMonitor({ lines, ran }: { lines: string[]; ran: boolean }) {
  const box = useRef<HTMLPreElement>(null);
  /* Záznamy jsou kusy výpisu, ne řádky: `print` zalomení nepřidá,
     `println` ho má na konci. Proto se lepí bez oddělovače. */
  const shown = lines.join("").replace(/\n$/, "").split("\n").slice(-MAX_LINES);
  if (shown.length === 1 && shown[0] === "") shown.pop();

  /* Nové řádky jsou dole, jako v IDE. Roluje se jen uvnitř okénka —
     scrollIntoView by s sebou vzal celou stránku. Závisí na `lines`, ne
     na `shown`: to je nové pole při každém renderu a přehrávač renderuje
     šedesátkrát za vteřinu, takže by dítě nahoru odrolovat nemohlo. */
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div className="overflow-hidden rounded-md border border-ink bg-ink">
      <p className="border-b border-white/10 px-3 py-1.5 font-mono text-xs text-white/60">
        Sériový monitor
      </p>
      <pre
        ref={box}
        className="h-32 overflow-y-auto px-3 py-2 font-mono text-sm leading-relaxed text-accent-300"
        aria-live="off"
        tabIndex={0}
        aria-label="Výpis ze sériového monitoru"
      >
        {shown.length > 0 ? (
          shown.join("\n")
        ) : (
          <span className="text-white/50">
            {ran
              ? "Program zatím nic nevypsal."
              : "Spusť program a uvidíš, co ti Arduino posílá."}
          </span>
        )}
      </pre>
    </div>
  );
}
