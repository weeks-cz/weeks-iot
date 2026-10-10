"use client";

/**
 * Poslední záchrana: spadne i kořenový layout. Nemá vlastní CSS ani písma
 * z layoutu, proto je tu vše inline a bez komponent z `components/ui`.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  console.error(error);
  return (
    <html lang="cs">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "system-ui, sans-serif",
          background: "#fafaf7",
          color: "#0c0e1a",
        }}
      >
        <main style={{ maxWidth: 480 }}>
          <p style={{ fontFamily: "monospace", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#4a4f6a" }}>
            Weeks Učebna
          </p>
          <h1 style={{ fontSize: 28, margin: "12px 0" }}>Učebna se teď nenačetla</h1>
          <p style={{ color: "#4a4f6a", lineHeight: 1.5 }}>
            Rozdělaná lekce je uložená ve vašem prohlížeči. Zkuste stránku načíst znovu.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: 16,
              minHeight: 44,
              padding: "10px 20px",
              background: "#fbbf24",
              color: "#0c0e1a",
              border: "2px solid #0c0e1a",
              borderRadius: 6,
              boxShadow: "2px 2px 0 0 #0c0e1a",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Zkusit znovu
          </button>
        </main>
      </body>
    </html>
  );
}
