"use client";

import { useEffect, useRef, useState } from "react";
import type { BlockState, WorkspaceState } from "../program";

interface Props {
  /** Počáteční bloky. Jen počáteční — editor si stav drží sám. */
  initial: WorkspaceState;
  /** Bloky, které se nabízejí vlevo. */
  palette: BlockState[];
  onChange: (state: WorkspaceState) => void;
  /**
   * Bloky vnucené zvenku (řešení, reset). Použijí se, jakmile dorazí
   * JINÝ objekt — stejné pravidlo jako `pushCircuit` u builderu.
   */
  pushState?: WorkspaceState | null;
  height?: number;
}

type BlocklyModule = typeof import("blockly/core");

let defined = false;

/**
 * Editor bloků.
 *
 * Blockly se načítá až tady, v prohlížeči, a jen když dítě bloky opravdu
 * otevře. Má stovky kilobajtů a na kódovém režimu, v zapojování ani na
 * úvodní stránce nemá co dělat. Z téhož důvodu (CodeEditor.tsx) se
 * nepoužívá CodeMirror.
 *
 * Renderer „zelos" je ten, který vypadá jako Scratch: velké kulaté bloky,
 * do kterých se dobře trefuje prstem. Děti ho znají ze školy — nová věc
 * je jen to, co bloky dělají, ne jak se s nimi zachází.
 */
export function BlockEditor({ initial, palette, onChange, pushState, height = 460 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const workspace = useRef<import("blockly/core").WorkspaceSvg | null>(null);
  const blockly = useRef<BlocklyModule | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  /* Callback v refu: editor se kvůli nové funkci od rodiče nemá znovu
     vytvářet — přišlo by dítě o rozdělané bloky. */
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  /* Počáteční stav a paleta se čtou jen při vytvoření. */
  const initialRef = useRef(initial);
  const paletteRef = useRef(palette);

  useEffect(() => {
    let disposed = false;

    (async () => {
      try {
        const [Blockly, cs, { BLOCK_DEFINITIONS }] = await Promise.all([
          import("blockly/core"),
          import("blockly/msg/cs"),
          import("../definitions"),
        ]);
        if (disposed || !host.current) return;

        blockly.current = Blockly;
        Blockly.setLocale(cs as unknown as Record<string, string>);
        if (!defined) {
          Blockly.common.defineBlocksWithJsonArray(
            BLOCK_DEFINITIONS as unknown as object[],
          );
          defined = true;
        }

        const theme = Blockly.Theme.defineTheme("weeks", {
          name: "weeks",
          base: Blockly.Themes.Classic,
          fontStyle: {
            family: "var(--font-instrument), ui-sans-serif, sans-serif",
            weight: "600",
            size: 14,
          },
          componentStyles: {
            workspaceBackgroundColour: "#f4f4ee",
            flyoutBackgroundColour: "#ffffff",
            flyoutOpacity: 1,
            scrollbarColour: "#9da2bc",
          },
        });

        const ws = Blockly.inject(host.current, {
          toolbox: {
            kind: "flyoutToolbox",
            contents: paletteRef.current.map((b) => ({ kind: "block", ...b })),
          },
          /* Ikony (zoom, koš, šipky) ze svého serveru. Výchozí adresa je
             blockly-demo.appspot.com a tu CSP učebny nepustí — ikony pak
             byly rozbité čtverečky. */
          media: "/blockly/",
          renderer: "zelos",
          theme,
          trashcan: true,
          sounds: false,
          /* Bloky se srovnávají do mřížky — plocha pak nevypadá jako nepořádek. */
          grid: { spacing: 24, length: 2, colour: "#d9dbe6", snap: true },
          zoom: { controls: true, wheel: false, startScale: 0.8, maxScale: 1.6, minScale: 0.5 },
          move: { scrollbars: true, drag: true, wheel: true },
        });
        workspace.current = ws;

        Blockly.serialization.workspaces.load(
          initialRef.current as unknown as object,
          ws,
        );

        ws.addChangeListener((event) => {
          if (event.isUiEvent) return;
          onChangeRef.current(
            Blockly.serialization.workspaces.save(ws) as unknown as WorkspaceState,
          );
        });

        setReady(true);
      } catch {
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      workspace.current?.dispose();
      workspace.current = null;
    };
  }, []);

  /* Vnucený stav zvenku. */
  const lastPushed = useRef(pushState);
  useEffect(() => {
    if (!ready || !pushState || pushState === lastPushed.current) return;
    lastPushed.current = pushState;
    const ws = workspace.current;
    const Blockly = blockly.current;
    if (!ws || !Blockly) return;
    Blockly.serialization.workspaces.load(pushState as unknown as object, ws);
  }, [pushState, ready]);

  /* Blockly si velikost neměří samo — po změně rozložení (lg sloupce,
     rozbalený panel s kódem) by plocha zůstala useknutá. */
  useEffect(() => {
    if (!ready || !host.current) return;
    const Blockly = blockly.current;
    const observer = new ResizeObserver(() => {
      if (workspace.current && Blockly) Blockly.svgResize(workspace.current);
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [ready]);

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-ink/15 bg-paper-soft"
      style={{ height }}
    >
      <div ref={host} className="absolute inset-0" />
      {!ready && !failed && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="text-ink-500">Načítám bloky…</p>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <p className="text-ink-700">
            Bloky se nepodařilo načíst. Obnov stránku, nebo přepni na psaní kódu.
          </p>
        </div>
      )}
    </div>
  );
}
