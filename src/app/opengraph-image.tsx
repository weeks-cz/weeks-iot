import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

/**
 * Náhled pro sdílení (Open Graph / Twitter), generovaný kódem.
 *
 * Texty jsou převzaté z toho, co učebna doopravdy slibuje (titulek úvodní
 * stránky, popis kurzu, „zdarma · bez registrace"). Nic nad to — žádná čísla,
 * žádné počty dětí ani hodnocení.
 *
 * Font Bricolage Grotesque (SIL OFL) je vendorovaný v `public/fonts` — satori
 * neumí variabilní soubor z Google Fonts, viz `public/fonts/README.md`.
 */

export const alt = `${SITE.name} — Arduino pro děti zdarma`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#0C0E1A";
const INK_60 = "rgba(12, 14, 26, 0.6)";
const INK_06 = "rgba(12, 14, 26, 0.06)";
const PAPER = "#FAFAF7";
const PRIMARY = "#4F46E5";

async function nacistFont(soubor: string): Promise<ArrayBuffer | null> {
  try {
    const buffer = await readFile(join(process.cwd(), "public", "fonts", soubor));
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  } catch {
    // Bez vlastního písma se náhled vykreslí systémovým fontem — lepší než spadlý build.
    return null;
  }
}

export default async function OpengraphImage() {
  const [tucne, bezne] = await Promise.all([
    nacistFont("bricolage-grotesque-700.ttf"),
    nacistFont("bricolage-grotesque-500.ttf"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 88px",
          backgroundColor: PAPER,
          backgroundImage:
            "linear-gradient(to right, rgba(79,70,229,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(79,70,229,0.07) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          fontFamily: "Bricolage Grotesque",
          position: "relative",
        }}
      >
        {/* Vodoznak W, stejný motiv jako na webu. */}
        <div
          style={{
            position: "absolute",
            right: "10px",
            bottom: "-100px",
            fontSize: 460,
            fontWeight: 700,
            color: INK_06,
            lineHeight: 1,
            display: "flex",
          }}
        >
          W
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: INK_60,
          }}
        >
          Weeks Učebna
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 80, fontWeight: 700, color: INK, lineHeight: 1.06 }}>
            Učebna Weeks
          </div>
          <div style={{ display: "flex", fontSize: 80, fontWeight: 700, color: PRIMARY, lineHeight: 1.06 }}>
            Arduino pro děti zdarma
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color: INK_60, marginTop: 28 }}>
            Zapojíš obvod a naprogramuješ ho. První lekci si zkusíš hned, bez registrace.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 26 }}>
          <div style={{ display: "flex", width: 14, height: 14, backgroundColor: PRIMARY }} />
          <div style={{ display: "flex", fontWeight: 700, color: INK }}>ucebna.weeks.cz</div>
        </div>
      </div>
    ),
    {
      ...size,
      ...(tucne && bezne
        ? {
            fonts: [
              { name: "Bricolage Grotesque", data: tucne, weight: 700 as const, style: "normal" as const },
              { name: "Bricolage Grotesque", data: bezne, weight: 500 as const, style: "normal" as const },
            ],
          }
        : {}),
    },
  );
}
