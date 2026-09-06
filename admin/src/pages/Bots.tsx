import { useEffect, useState } from "react";
import { api, type AdminEventLog, type BiasedDrawMode, type BotConfig } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Button, Card, Input, Toggle, Spinner, ErrorNote, Badge, PageHeader, EmptyState } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm";
import { date, shortId } from "@/lib/format";

const ALL_TIERS = ["REGULAR", "VIP"] as const;
const COLLECT_WINNERS_SOURCE = "game.collectWinners";

const DRAW_MODE_OPTIONS: Array<{ value: BiasedDrawMode; label: string; detail: string }> = [
  {
    value: "disabled",
    label: "Disabled",
    detail: "Fair random draw at every population. Low-population filler bots receive no winning advantage.",
  },
  {
    value: "legacy",
    label: "Legacy",
    detail: "Below the minimum, use the previous full-hopper behavior protecting bonus-funded cards only.",
  },
  {
    value: "protected",
    label: "Protected",
    detail: "Below the minimum, use bot-card-first draws while protecting every active human card.",
  },
];

function metadataNumber(log: AdminEventLog, key: string): number | null {
  const value = log.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function warningDetail(log: AdminEventLog): string {
  const humanWinners = metadataNumber(log, "human_winners");
  if (humanWinners === null) return "No extra details";
  return `${humanWinners} human winner${humanWinners === 1 ? "" : "s"} suppressed`;
}

export function Bots() {
  const { data, loading, error, reload } = useApi(() => api.botConfig(), []);
  const {
    data: warningData,
    loading: warningsLoading,
    error: warningsError,
    reload: reloadWarnings,
  } = useApi(() => api.adminLogs({ level: "warning", source: COLLECT_WINNERS_SOURCE, limit: 25 }), []);
  const push = useToast((s) => s.push);
  const confirm = useConfirm();

  const [form, setForm] = useState<BotConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedCount, setSeedCount] = useState("");

  useEffect(() => {
    if (data) {
      const mode = data.biased_draw_mode ?? (data.bot_always_win ? "protected" : "disabled");
      setForm({
        ...data,
        win_rate: data.win_rate ?? 0.8,
        minimum_room_players: data.minimum_room_players ?? 20,
        biased_draw_mode: mode,
        bot_always_win: mode !== "disabled",
      });
    }
  }, [data]);

  const tiers = form ? form.tiers.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const biasedDrawMode: BiasedDrawMode = form?.biased_draw_mode ?? "disabled";
  const warnings = warningData?.logs ?? [];

  const toggleTier = (tier: string) => {
    if (!form) return;
    const next = tiers.includes(tier) ? tiers.filter((t) => t !== tier) : [...tiers, tier];
    setForm({ ...form, tiers: next.join(",") });
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const updated = await api.updateBotConfig({
        enabled: form.enabled,
        minimum_room_players: form.minimum_room_players,
        tiers: form.tiers,
        win_rate: form.win_rate,
        biased_draw_mode: biasedDrawMode,
        bot_always_win: biasedDrawMode !== "disabled",
      });
      setForm(updated);
      push("Bot policy saved", "success");
      reload();
    } catch (e) {
      push(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const seed = async () => {
    if (
      !(await confirm({
        title: "Seed bot pool?",
        message: "Funds bot wallets from house float (recorded as bot_funding). Safe to re-run.",
        confirmLabel: "Seed & fund",
      }))
    )
      return;
    const n = seedCount ? Number(seedCount) : undefined;
    setSeeding(true);
    try {
      const res = await api.seedBots(n);
      push(res.message ?? "Bot pool seeded", "success");
    } catch (e) {
      push(e instanceof Error ? e.message : "Seed failed", "error");
    } finally {
      setSeeding(false);
    }
  };

  const label = "mb-1.5 block text-sm font-medium text-txt";
  const hint = "mt-1.5 text-xs text-txt-3";

  return (
    <div>
      <PageHeader
        title="Filler bots"
        subtitle="Game capacity"
        actions={
          form && (
            <Badge tone={form.enabled ? "green" : "neutral"}>
              {form.enabled ? "Auto-fill on" : "Auto-fill off"}
            </Badge>
          )
        }
      />

      {loading && <Spinner />}
      {error && <ErrorNote message={error} onRetry={reload} />}

      {form && (
        <>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {/* Auto-fill policy */}
            <Card className="p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-txt-4">
                Auto-fill policy
              </h2>

              <div className="mb-5">
                <Toggle
                  checked={form.enabled}
                  onChange={(v) => setForm({ ...form, enabled: v })}
                  label={<span className="font-medium text-txt">Enable auto-fill</span>}
                />
              </div>

              <div className="mb-5">
                <label className={label}>Minimum total players</label>
                <Input
                  type="number"
                  min={2}
                  max={200}
                  value={form.minimum_room_players}
                  onChange={(e) =>
                    setForm({ ...form, minimum_room_players: Number(e.target.value) })
                  }
                />
                <p className={hint}>
                  Bots dynamically fill the difference. With a minimum of 20, zero real players
                  gets 20 bots and three real players gets 17 bots. Real arrivals automatically
                  replace bots.
                </p>
                <p className="mt-2 rounded-lg border border-edgeSoft bg-panel2 px-3 py-2 text-xs leading-relaxed text-txt-3">
                  At or above this minimum, general bot-winning bias is suspended. When the saved
                  mode is enabled and bonus-funded entrants are present, two guard bots remain;
                  wallet-funded players and those bots compete fairly.
                </p>
              </div>

              <div className="mb-5">
                <label className={label}>Tiers</label>
                <div className="flex gap-2">
                  {ALL_TIERS.map((tier) => {
                    const on = tiers.includes(tier);
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => toggleTier(tier)}
                        className={`rounded-xl border px-3.5 py-1.5 text-sm font-semibold transition ${
                          on
                            ? "border-brand bg-brand text-ink"
                            : "border-edge bg-panel2 text-txt-2 hover:bg-edge"
                        }`}
                      >
                        {tier}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 border-t border-edgeSoft pt-4">
                <Button icon="check" loading={saving} onClick={save}>
                  Save policy
                </Button>
                <span className="text-xs text-txt-4">Updated {date(form.updated_at)}</span>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-txt-4">Win policy</h2>

              <div className="mb-5">
                <label className={label}>Biased draw mode</label>
                <div className="space-y-2">
                  {DRAW_MODE_OPTIONS.map((option) => {
                    const selected = biasedDrawMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            biased_draw_mode: option.value,
                            bot_always_win: option.value !== "disabled",
                          })
                        }
                        className={`w-full rounded-lg border px-3.5 py-3 text-left transition ${
                          selected
                            ? "border-brand bg-brand/10"
                            : "border-edge bg-panel2 hover:border-txt-4 hover:bg-edgeSoft"
                        }`}
                      >
                        <span
                          className={`block text-sm font-semibold ${
                            selected ? "text-brand" : "text-txt"
                          }`}
                        >
                          {option.label}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-txt-3">
                          {option.detail}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="border-t border-edgeSoft pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-txt-4">
                  Winner handling
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-txt-3">
                  {biasedDrawMode === "disabled"
                    ? "Every eligible card completing on the same draw shares the pot."
                    : "Below the minimum, the saved mode controls bot advantage. At or above the minimum, general bias turns off; only bonus-funded cards are ineligible, while wallet cards and the two guard bots compete and share ties fairly."}
                </p>
              </div>
            </Card>

            {/* Bot pool */}
            <Card className="p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-txt-4">Bot pool</h2>
              <label className={label}>Count</label>
              <Input
                type="number"
                min={1}
                placeholder="server default"
                value={seedCount}
                onChange={(e) => setSeedCount(e.target.value)}
              />
              <p className={hint}>Creates or tops up bot wallets from house float.</p>
              <div className="mt-4 border-t border-edgeSoft pt-4">
                <Button variant="ghost" icon="bots" loading={seeding} onClick={seed}>
                  Seed / fund pool
                </Button>
              </div>
            </Card>
          </div>

          <Card className="mt-4 overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edgeSoft px-5 py-4">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-txt-4">Warning logs</h2>
                <p className="mt-1 text-sm text-txt-3">Human-only winner suppressions from collectWinners.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="yellow">{warningData?.total ?? 0} total</Badge>
                <Button variant="ghost" loading={warningsLoading} onClick={reloadWarnings}>
                  Refresh
                </Button>
              </div>
            </div>

            {warningsLoading ? (
              <div className="px-5">
                <Spinner label="Loading warning logs..." />
              </div>
            ) : warningsError ? (
              <div className="p-5">
                <ErrorNote message={warningsError} onRetry={reloadWarnings} />
              </div>
            ) : warnings.length === 0 ? (
              <EmptyState message="No collectWinners warnings recorded yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-panel2 text-left text-xs uppercase tracking-wider text-txt-4">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Time</th>
                      <th className="px-5 py-3 font-semibold">Game</th>
                      <th className="px-5 py-3 font-semibold">Message</th>
                      <th className="px-5 py-3 font-semibold">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warnings.map((log) => (
                      <tr key={log.id} className="border-t border-edgeSoft align-top">
                        <td className="whitespace-nowrap px-5 py-3 text-txt-3">{date(log.created_at)}</td>
                        <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-txt-2">
                          {shortId(log.game_id ?? undefined)}
                        </td>
                        <td className="min-w-[280px] px-5 py-3 text-txt">{log.message}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-txt-3">{warningDetail(log)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
