import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Platba zrušena | Weeks IoT",
  robots: "noindex, nofollow",
};

export default function CancelledPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Cancel icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-amber-400/20 flex items-center justify-center text-4xl">
            ⊘
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Platba byla zrušena</h1>
          <p className="text-[color:var(--theme-muted)]">
            Nic jsme ti neúčtovali. Můžeš to zkusit znovu kdykoliv.
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
