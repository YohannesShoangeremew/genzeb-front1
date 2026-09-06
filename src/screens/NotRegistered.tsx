import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { openTelegramLink } from "@/lib/telegram";

export function NotRegistered() {
  const { t } = useTranslation();
  const bot = import.meta.env.VITE_BOT_USERNAME ?? "Habtam_bingobot";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-8 text-center">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-6xl"
      >
        👋
      </motion.div>
      <div className="max-w-xs">
        <h1 className="font-display text-2xl font-extrabold">
          {t("auth.notRegisteredTitle")}
        </h1>
        <p className="mt-2 text-ink-muted">{t("auth.notRegisteredBody")}</p>
      </div>
      <Button
        variant="cyan"
        onClick={() => openTelegramLink(`https://t.me/${bot}?start=play`)}
      >
        {t("auth.openBot")}
      </Button>
    </div>
  );
}
