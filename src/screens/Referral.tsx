import { useTranslation } from "react-i18next";
import { ScreenShell } from "@/components/layout/ScreenShell";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { shareToTelegram, haptic } from "@/lib/telegram";
import { useAuth } from "@/store/authStore";

export function Referral() {
  const { t } = useTranslation();
  const code = useAuth((s) => s.user?.referal_code ?? "");
  const push = useToast((s) => s.push);
  const bot = import.meta.env.VITE_BOT_USERNAME ?? "EDL_Bingobot";
  const link = `https://t.me/${bot}?start=ref_${code}`;

  const copy = async () => {
    haptic.notify("success");
    try {
      // Copy the full invite link — that's what carries the referral code, and
      // what a friend needs to tap for the reward to attribute.
      await navigator.clipboard.writeText(link);
      push(t("common.copied"), "success");
    } catch {
      push(link, "info");
    }
  };

  return (
    <ScreenShell>
      <Header back title={t("referral.title")} />
      <div className="flex flex-col items-center gap-6 py-6 text-center">
        <div className="text-6xl">🎁</div>
        <p className="max-w-xs text-ink-muted">{t("referral.body")}</p>

        <Card className="w-full">
          <div className="text-xs text-ink-faint">{t("referral.yourCode")}</div>
          <button onClick={copy} className="mt-1 w-full">
            <div className="font-display text-3xl font-extrabold tracking-widest text-neon-gold">
              {code || "—"}
            </div>
            <div className="mt-1 text-xs text-neon-cyan">📋 {t("common.copied")}?</div>
          </button>
        </Card>

        <Button
          variant="cyan"
          fullWidth
          onClick={() => shareToTelegram(link, t("referral.shareText", { code }))}
        >
          📨 {t("referral.shareBtn")}
        </Button>
      </div>
    </ScreenShell>
  );
}
