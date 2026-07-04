import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Děkujeme | Weeks IoT",
  robots: "noindex, nofollow",
};

export default function ThankYouPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Checkmark animation */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[color:var(--theme-success)]/20 flex items-center justify-center text-4xl">
            ✓
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Děkujeme!</h1>
          <p className="text-[color:var(--theme-muted)]">
            Platba se zpracovává. Premium se aktivuje během chvilky — stačí se vrátit do aplikace.
          </p>
        </div>

        {/* Back button */}
        <Link
          href="/"
          className="inline-block rounded-xl bg-[color:var(--theme-accent)] hover:bg-[color:var(--theme-accent)]/90 text-[#0d1427] px-6 py-3 font-semibold transition-colors"
        >
          Zpět do aplikace
        </Link>
      </div>
    </div>
  );
}
