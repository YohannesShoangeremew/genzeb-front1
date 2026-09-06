import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { haptic } from "@/lib/telegram";
import { useToast } from "@/components/ui/Toast";

const KEY = "habesha_streak";

interface StreakData {
  count: number;
  lastClaim: string; // YYYY-MM-DD
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function load(): StreakData {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "") as StreakData;
  } catch {
    return { count: 0, lastClaim: "" };
  }
}

/**
 * Client-side daily login streak. This is a retention nudge only — it does NOT
 * credit the wallet (the backend has no bonus endpoint). It tracks consecutive
 * days the player opened the app.
 */
export function DailyStreak() {
  const { t } = useTranslation();
  const push = useToast((s) => s.push);
  const [data, setData] = useState<StreakData>(load);

  const claimedToday = data.lastClaim === today();
  if (claimedToday) return null;

  const claim = () => {
    haptic.notify("success");
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const count = data.lastClaim === yesterday ? data.count + 1 : 1;
    const next = { count, lastClaim: today() };
    localStorage.setItem(KEY, JSON.stringify(next));
    setData(next);
    push(`🔥 ${count}`, "success");
  };

  return (
    <motion.button
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      onClick={claim}
      className="mt-3 flex w-full items-center justify-between rounded-2xl bg-grad-gold px-4 py-2.5 text-bg"
    >
      <span className="font-display font-bold">🔥 {t("lobby.dailyBonus")}</span>
      <span className="rounded-full bg-bg/20 px-3 py-1 text-sm font-bold">
        {t("lobby.claim")}
      </span>
    </motion.button>
  );
}
