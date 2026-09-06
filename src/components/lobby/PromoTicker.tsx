import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Rotating promotional / tip banner. Intentionally NOT fake "player X won Y"
 * messages — the backend has no public win feed, so we show genuine tips and
 * promos instead of fabricating activity.
 */
export function PromoTicker() {
  const { t } = useTranslation();
  const messages = [
    `🎁 ${t("lobby.higherBigger")}`,
    `⚡ ${t("app.tagline")}`,
  ];
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % messages.length), 3500);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div className="relative h-9 overflow-hidden rounded-2xl bg-grad-cyan/15 px-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="flex h-9 items-center text-sm font-semibold text-neon-cyan"
        >
          {messages[i]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
