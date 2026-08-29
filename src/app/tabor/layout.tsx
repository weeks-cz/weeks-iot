import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { GameStateProvider } from "@legacy/components/providers/GameStateProvider";
import { AuthProvider } from "@legacy/contexts/AuthContext";

/**
 * Táborový kiosek — zamrazený legacy režim.
 *
 * Do 29. 8. 2026 běžel na kořenové adrese a byl jedinou cestou dovnitř
 * (nález N2). Teď je to samostatný oddělený vstup, jak předepisuje Brána 0,
 * bod 7: neindexuje se a nemíchá se s veřejnou částí.
 *
 * Vlastní písmo i barevná témata si nese sám. Témata jsou v globals.css
 * scopnutá pod `.legacy-shell`, protože původně seděla na `body` a přebila
 * by celou novou učebnu.
 *
 * Chování obrazovek se nemění. Kdo sem sáhne, mění táborový režim.
 */

const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Weeks — táborový režim",
  robots: { index: false, follow: false },
};

export default function TaborLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`legacy-shell ${outfit.variable}`}
      data-theme="classic"
      style={{ fontFamily: "var(--font-outfit), system-ui, sans-serif" }}
    >
      <AuthProvider>
        <GameStateProvider>{children}</GameStateProvider>
      </AuthProvider>
    </div>
  );
}
