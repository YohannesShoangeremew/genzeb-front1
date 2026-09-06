import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/store/authStore";
import type { ReactNode } from "react";

export function Splash({ status }: { status: string }) {
  const { t } = useTranslation();
  const authenticate = useAuth((s) => s.authenticate);
  const error = useAuth((s) => s.error);

  let body: ReactNode;
  if (status === "error" && error === "no_telegram") {
    body = (
      <Info title={t("auth.noTelegramTitle")} text={t("auth.noTelegramBody")} />
    );
  } else if (status === "error") {
    body = (
      <div className="text-center">
        <Info title={t("auth.errorTitle")} text={t("auth.errorBody")} />
        <Button className="mt-5" onClick={() => authenticate()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col items-center gap-3">
        <Spinner size={32} />
        <p className="text-ink-muted">{t("auth.connecting")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-8">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 14 }}
        className="text-center"
      >
        <div className="animate-float text-7xl">🎱</div>
        <h1 className="mt-3 font-display text-4xl font-extrabold neon-text">
          {t("app.name")}
        </h1>
        <p className="mt-1 text-neon-cyan">{t("app.tagline")}</p>
      </motion.div>
      {body}
    </div>
  );
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="max-w-xs text-center">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted">{text}</p>
    </div>
  );
}
