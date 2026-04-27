"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { REWARD_CONFIG } from "@/lib/rewards";

interface Props {
  open: boolean;
  studentNumber: string;
  onClose: () => void;
}

export function WelcomeModal({ open, studentNumber, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="panel-glass w-full max-w-md p-6 space-y-4"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--theme-accent)]">
              Vítej!
            </p>
            <h2 className="text-2xl font-bold">
              Jsi <span className="text-[color:var(--theme-accent)]">Student {studentNumber}</span>
            </h2>
            <div className="space-y-2 text-sm text-[color:var(--theme-muted)]">
              <p>
                Tady najdeš úkoly rozdělené do tří úrovní. Začni od{" "}
                <strong className="text-[color:var(--theme-text)]">Začátečník</strong> a postupně
                odemykej těžší.
              </p>
              <p>
                Za každý splněný úkol dostaneš ⭐{" "}
                <strong className="text-[color:var(--theme-text)]">hvězdičky</strong>. Bez nápovědy
                a na první pokus získáš{" "}
                <strong className="text-[color:var(--theme-text)]">
                  +{REWARD_CONFIG.noHelpBonusStars + REWARD_CONFIG.firstTryBonusStars} bonusových ⭐
                </strong>
                .
              </p>
              <p>
                Vyzkoušej hned{" "}
                <strong className="text-[color:var(--theme-text)]">denní výzvu</strong> nahoře — má
                navíc bonus +{REWARD_CONFIG.dailyChallengeStars} ⭐.
              </p>
            </div>
            <Button onClick={onClose} className="w-full">
              Pojďme na to →
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
