import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

/**
 * Full-screen "we'll be right back" screen shown while the operator has
 * maintenance mode on (admin → Settings). It replaces the entire app, so a
 * player cannot reach the lobby, wallet, or a game. `message` is the optional
 * operator note from settings; a sensible default is used when it's blank.
 */
export function Maintenance({ message }: { message?: string }) {
  const { t } = useTranslation();
  const body = message?.trim() || t("maintenance.body");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-8 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-6xl"
      >
        🛠️
      </motion.div>
      <div className="max-w-xs">
        <h1 className="font-display text-2xl font-extrabold">{t("maintenance.title")}</h1>
        <p className="mt-3 text-ink-muted">{body}</p>
      </div>
    </div>
  );
}
