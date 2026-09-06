import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { haptic } from "@/lib/telegram";
import { useToast } from "@/components/ui/Toast";
import { useWallet } from "@/store/walletStore";

/**
 * The "today's bonus" banner. Deliberately minimal: a heading and a Claim
 * button, nothing else — no pot size, per-player amount, remaining-slot count
 * or countdown. It appears only while a slot still exists and the campaign is
 * running; once the player claims it becomes a small confirmation.
 *
 * Renders nothing when no campaign is running (most days) or when the bonus is
 * finished, so the spot is never occupied by a dead banner.
 */
export function BonusCampaign() {
  const { t } = useTranslation();
  const push = useToast((s) => s.push);
  const refreshWallet = useWallet((s) => s.refresh);
  const [busy, setBusy] = useState(false);

  const status = useQuery({
    queryKey: ["bonus-campaign"],
    queryFn: () => api.myBonusCampaign(),
    // Kept fresh so the banner disappears promptly once the bonus is finished.
    refetchInterval: 15000,
    retry: false,
  });

  const data = status.data;
  const campaign = data?.campaign;
  if (!campaign) return null;

  const claim = async () => {
    setBusy(true);
    try {
      const res = await api.claimBonus();
      haptic.notify("success");
      push(t("bonus.claimedToast", { amount: res.claim.amount }), "success");
      // Refresh the wallet so the bonus pill updates, and the campaign so the
      // banner flips to its claimed state.
      await Promise.all([refreshWallet(), status.refetch()]);
    } catch (e) {
      haptic.notify("error");
      const reason = e instanceof ApiError ? e.reason : undefined;
      // Never surface the server's English prose — map the code to a
      // translated string (e.g. "deposit once first"), else a generic failure.
      const key = reason ? `bonus.refused.${reason}` : "bonus.refused.failed";
      push(t(key, { defaultValue: t("bonus.refused.failed") }), "error");
      // A refusal usually means the world moved on (gone, already claimed), so
      // re-read rather than leaving a stale button on screen.
      status.refetch();
    } finally {
      setBusy(false);
    }
  };

  // Already claimed — show nothing. The claim confirmation is the toast at
  // claim time; a lingering banner afterwards is just clutter on the play page.
  if (data?.claimed) return null;

  // Only offer the button while a slot exists and the campaign is still active;
  // otherwise show nothing (no counts, no "finished" clutter).
  const finished = campaign.claimed_count >= campaign.slots || campaign.status !== "active";
  if (finished) return null;

  return (
    <Shell>
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-sm font-bold">🎁 {t("bonus.heading")}</span>
        <button
          onClick={claim}
          disabled={busy}
          className="shrink-0 rounded-full bg-bg/20 px-5 py-1.5 text-sm font-bold transition disabled:opacity-50"
        >
          {busy ? t("bonus.claiming") : t("bonus.claim")}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ scale: 0.97, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="mt-3 w-full rounded-2xl bg-grad-gold px-4 py-3 text-bg"
    >
      {children}
    </motion.div>
  );
}
