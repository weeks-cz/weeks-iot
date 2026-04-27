import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { GameStateProvider } from "@/components/providers/GameStateProvider";
import { AuthProvider } from "@/contexts/AuthContext";

const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Weeks IoT",
  description: "Výuková IoT platforma pro děti z Weeks táborů",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs" data-theme="classic" className={outfit.variable}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <GameStateProvider>{children}</GameStateProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
