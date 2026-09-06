import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";

type Category = "transaction" | "gameplay" | "other";

const CATEGORIES: Category[] = ["transaction", "gameplay", "other"];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-selected category for the context this was opened from. */
  defaultCategory?: Category;
  /** Current game, attached to the report when opened from the game room. */
  gameId?: string;
}

/** Bottom-sheet "report a problem" form. Submits to the admin dashboard. */
export function ReportProblem({ open, onClose, defaultCategory = "other", gameId }: Props) {
  const { t } = useTranslation();
  const push = useToast((s) => s.push);
  const [category, setCategory] = useState<Category>(defaultCategory);
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
      await api.submitReport(category, text, gameId);
      push(t("report.success"), "success");
      setMessage("");
      onClose();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : t("report.error");
      push(msg || t("report.error"), "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("report.title")}>
      <p className="mb-4 text-sm text-ink/60">{t("report.subtitle")}</p>

      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/50">
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
        rows={4}
        maxLength={2000}
        className="mb-4 w-full resize-none rounded-xl border border-white/15 bg-black/20 p-3 text-sm text-ink placeholder:text-ink/40 focus:border-accent focus:outline-none"
      />

      <Button fullWidth onClick={submit} loading={sending} disabled={sending}>
        {sending ? t("report.sending") : t("report.submit")}
      </Button>
    </Sheet>
  );
}
