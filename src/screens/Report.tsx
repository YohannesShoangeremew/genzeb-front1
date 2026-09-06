import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScreenShell } from "@/components/layout/ScreenShell";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";

type Category = "transaction" | "gameplay" | "other";
const CATEGORIES: Category[] = ["transaction", "gameplay", "other"];

/** Full-screen "report a problem" form, reached from the bottom nav. */
export function Report() {
  const { t } = useTranslation();
  const push = useToast((s) => s.push);
  const [category, setCategory] = useState<Category>("other");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    const text = message.trim();
    if (!text) {
      push(t("report.empty"), "info");
      return;
    }
    setSending(true);
    try {
      await api.submitReport(category, text);
      push(t("report.success"), "success");
      setMessage("");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t("report.error");
      push(msg || t("report.error"), "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <ScreenShell>
      <Header title={t("report.title")} />
      <p className="mb-4 text-sm text-ink-muted">{t("report.subtitle")}</p>

      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
        {t("report.category")}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              category === c
                ? "border-accent bg-accent/15 text-ink"
                : "border-white/15 text-ink/70 hover:bg-white/5"
            }`}
          >
            {t(`report.cat.${c}`)}
          </button>
        ))}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t("report.placeholder")}
        rows={5}
        maxLength={2000}
        className="mb-4 w-full resize-none rounded-xl border border-white/15 bg-black/20 p-3 text-sm text-ink placeholder:text-ink/40 focus:border-accent focus:outline-none"
      />

      <Button fullWidth onClick={submit} loading={sending} disabled={sending}>
        {sending ? t("report.sending") : t("report.submit")}
      </Button>
    </ScreenShell>
  );
}
