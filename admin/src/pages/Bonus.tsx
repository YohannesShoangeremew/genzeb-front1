import { useEffect, useState } from "react";
import {
  api,
  type BonusCampaign,
  type BonusCampaignClaim,
  type BonusConfig,
  type Broadcast,
  type UserWithWallet,
} from "@/lib/api";
import { openCampaignSocket } from "@/lib/campaignSocket";
import { useApi } from "@/lib/useApi";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { Button, Card, Spinner, ErrorNote, Badge, EmptyState, SearchInput, Pagination } from "@/components/ui";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/components/toast";
import { birr, date, fullName, readable } from "@/lib/format";

const PLAYER_PAGE_SIZE = 50;
type Tab = "campaign" | "grant" | "policy" | "broadcast";

/**
 * Bonus is PLAY-ONLY money: it buys game cards but can never be withdrawn.
 * Winnings from a bonus-funded card are ordinary cash. "Outstanding" is
 * therefore a house liability — bonus players could still stake — not money
 * anyone can take out.
 */
export function Bonus() {
  const { data: cfgData, loading, error, reload } = useApi(() => api.bonusConfig(), []);
  const [tab, setTab] = useState<Tab>("campaign");

  const [form, setForm] = useState<BonusConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [outstanding, setOutstanding] = useState<number | null>(null);
  const [audience, setAudience] = useState<number | null>(null);

  useEffect(() => {
    if (cfgData) setForm(cfgData);
  }, [cfgData]);

  const refreshStats = () => {
    api.bonusOutstanding().then((r) => setOutstanding(r.outstanding_bonus)).catch(() => {});
    api.broadcastAudience().then((r) => setAudience(r.recipients)).catch(() => {});
  };
  useEffect(refreshStats, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!form) return null;

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Bonus</h1>
          <Badge tone={form.enabled ? "green" : "neutral"}>
            {form.enabled ? "Granting on" : "Granting off"}
          </Badge>
        </div>
        <div className="flex gap-2 text-sm">
          <Stat label="Outstanding" value={outstanding === null ? "—" : birr(outstanding)} />
          <Stat label="Players reachable" value={audience === null ? "—" : String(audience)} />
          <Stat label="Expires after" value={`${form.expiry_days}d`} />
        </div>
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-edge bg-panel p-1 text-sm">
        {(
          [
            ["campaign", "Today's bonus"],
            ["grant", "Grant bonus"],
            ["policy", "Policy"],
            ["broadcast", "Broadcast"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              tab === key ? "bg-brand text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "campaign" && <CampaignPanel enabled={form.enabled} onChanged={refreshStats} />}
      {tab === "grant" && (
        <GrantPanel enabled={form.enabled} onGranted={refreshStats} />
      )}
      {tab === "policy" && (
        <PolicyPanel form={form} setForm={setForm} saving={saving} setSaving={setSaving} reload={reload} />
      )}
      {tab === "broadcast" && <BroadcastPanel audience={audience} announcement={form.announcement} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-edge bg-panel px-3 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-semibold text-slate-200">{value}</div>
    </div>
  );
}

/**
 * Picking recipients from a checkbox list rather than typing user IDs.
 * A UUID is not something an operator has to hand, and a mistyped one either
 * fails or — worse — silently pays the wrong player.
 */
function GrantPanel({
  enabled,
  onGranted,
}: {
  enabled: boolean;
  onGranted: () => void;
}) {
  const push = useToast((s) => s.push);
  const [q, setQ] = useState("");
  const search = useDebouncedValue(q.trim(), 300);
  const [page, setPage] = useState(0);
  const { data, loading, error, reload } = useApi(
    () => api.users({ limit: PLAYER_PAGE_SIZE, offset: page * PLAYER_PAGE_SIZE, search }),
    [page, search],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const visible = data?.users ?? [];
  const total = data?.count ?? 0;
  useEffect(() => setPage(0), [search]);

  // "Select all" applies to what is CURRENTLY VISIBLE, not the whole database.
  // Selecting rows a search has hidden is how an operator accidentally pays
  // everyone while believing they targeted a few.
  const allVisibleSelected = visible.length > 0 && visible.every((u) => selected.has(u.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allVisibleSelected) visible.forEach((u) => next.delete(u.id));
    else visible.forEach((u) => next.add(u.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const grant = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      push("Enter an amount greater than 0", "error");
      return;
    }
    if (selected.size === 0) {
      push("Select at least one player", "error");
      return;
    }
    setBusy(true);
    try {
      const r = await api.grantBonusBulk([...selected], amt, reason.trim());
      const failedCount = Object.keys(r.failed ?? {}).length;
      if (failedCount > 0) {
        // Reported rather than swallowed: a partial campaign the admin thinks
        // succeeded is worse than one they know to retry.
        push(`Granted to ${r.granted} of ${r.attempted} — ${failedCount} failed`, "error");
      } else {
        push(`Granted ${birr(amt)} to ${r.granted} player${r.granted === 1 ? "" : "s"}`, "success");
      }
      setSelected(new Set());
      setAmount("");
      setReason("");
      onGranted();
    } catch (e) {
      push(e instanceof Error ? e.message : "Grant failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "rounded-lg border border-edge bg-panel2 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-brand";

  return (
    <div className="space-y-4">
      {!enabled && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          Granting is switched off in Policy — grants will be rejected until you turn it back on.
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
              Amount (birr)
            </label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50"
              className={`${inputCls} w-32`}
            />
          </div>
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
              Reason (optional)
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Weekend promo"
              className={`${inputCls} w-full`}
            />
          </div>
          <Button onClick={grant} disabled={busy || selected.size === 0}>
            {busy
              ? "Granting…"
              : `Grant to ${selected.size} selected`}
          </Button>
        </div>
      </Card>

      <Card className="p-0">
        <div className="flex flex-col gap-3 border-b border-edge p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} />
              {allVisibleSelected ? "Unselect all" : "Select all"}
              <span className="text-slate-500">
                ({visible.length} shown{q.trim() ? ", filtered" : ""})
              </span>
            </label>
            {selected.size > 0 && (
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs text-slate-400 underline hover:text-slate-200"
              >
                clear {selected.size}
              </button>
            )}
          </div>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search name, phone, Telegram ID…"
            className="w-full sm:w-72"
          />
        </div>


        {loading && <Spinner />}
        {error && (
          <div className="p-4">
            <ErrorNote message={error} onRetry={reload} />
          </div>
        )}
        {!loading && !error && visible.length === 0 && <EmptyState message="No players found." />}
        {!loading && !error && visible.length > 0 && (
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-panel">
                <tr className="border-b border-edge text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Balance</th>
                  <th className="px-3 py-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u: UserWithWallet) => {
                  const on = selected.has(u.id);
                  return (
                    <tr
                      key={u.id}
                      onClick={() => toggleOne(u.id)}
                      className={`cursor-pointer border-b border-edge/50 last:border-0 ${
                        on ? "bg-brand/10" : "hover:bg-white/5"
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={on} readOnly />
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-200">
                          {fullName(u.first_name, u.last_name) || u.phone_number}
                        </span>
                        {u.banned && (
                          <span className="ml-2">
                            <Badge tone="red">banned</Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-400">{u.phone_number}</td>
                      <td className="px-3 py-2 text-slate-400">{birr(u.wallet?.balance ?? 0)}</td>
                      <td className="px-3 py-2 text-slate-500">{date(u.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 && (
          <Pagination
            page={page}
            pageSize={PLAYER_PAGE_SIZE}
            total={total}
            shown={visible.length}
            onPage={setPage}
          />
        )}
      </Card>
    </div>
  );
}

function PolicyPanel({
  form,
  setForm,
  saving,
  setSaving,
  reload,
}: {
  form: BonusConfig;
  setForm: (c: BonusConfig) => void;
  saving: boolean;
  setSaving: (b: boolean) => void;
  reload: () => void;
}) {
  const push = useToast((s) => s.push);
  const inputCls =
    "rounded-lg border border-edge bg-panel2 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-brand";

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateBonusConfig({
        enabled: form.enabled,
        expiry_days: form.expiry_days,
        announcement: form.announcement,
      });
      setForm(updated);
      push("Policy saved", "success");
      reload();
    } catch (e) {
      push(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <label className="mb-4 flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={form.enabled}
          onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
        />
        <span>
          <span className="block font-medium text-slate-200">Allow new bonus grants</span>
          <span className="block text-xs text-slate-500">
            Switching this off never takes back bonus already given — existing grants stay
            spendable until they expire.
          </span>
        </span>
      </label>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-slate-200">Expires after (days)</label>
        <input
          type="number"
          min={1}
          max={365}
          value={form.expiry_days}
          onChange={(e) => setForm({ ...form, expiry_days: Number(e.target.value) })}
          className={`${inputCls} w-32`}
        />
        <p className="mt-1 text-xs text-slate-500">
          Applies to new grants only. A deadline already promised to a player is never moved.
        </p>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-slate-200">Announcement</label>
        <textarea
          rows={3}
          maxLength={500}
          value={form.announcement}
          onChange={(e) => setForm({ ...form, announcement: e.target.value })}
          placeholder="Shown to players in the app beside their bonus balance."
          className={`${inputCls} w-full`}
        />
        <p className="mt-1 text-xs text-slate-500">
          {form.announcement.length}/500 · shown in the app. To push it to Telegram, use the
          Broadcast tab.
        </p>
      </div>

      <div className="flex items-center gap-3 border-t border-edge pt-4">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save policy"}
        </Button>
        <span className="text-xs text-slate-500">Last updated {date(form.updated_at)}</span>
      </div>
    </Card>
  );
}

function BroadcastPanel({
  audience,
  announcement,
}: {
  audience: number | null;
  announcement: string;
}) {
  const push = useToast((s) => s.push);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [run, setRun] = useState<Broadcast | null>(null);
  const [history, setHistory] = useState<Broadcast[]>([]);

  const loadHistory = () =>
    api.broadcasts(10).then((r) => setHistory(r.broadcasts ?? [])).catch(() => {});
  useEffect(() => {
    loadHistory();
  }, []);

  // Delivery is paced at ~20 messages/sec in the background, so the response
  // only means "started". Poll until it settles.
  useEffect(() => {
    if (!run || run.status !== "sending") return;
    const t = setInterval(async () => {
      try {
        const r = await api.broadcast(run.id);
        setRun(r.broadcast);
        if (r.broadcast.status !== "sending") {
          clearInterval(t);
          loadHistory();
        }
      } catch {
        clearInterval(t);
      }
    }, 1500);
    return () => clearInterval(t);
  }, [run]);

  const send = async (text: string) => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const r = await api.sendBroadcast(body);
      setRun(r.broadcast);
      push(`Sending to ${r.broadcast.recipients} players…`, "success");
    } catch (e) {
      push(e instanceof Error ? e.message : "Broadcast failed", "error");
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-edge bg-panel2 px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand";

  return (
    <div className="space-y-4">
      <Card>
        <p className="mb-3 text-sm text-slate-400">
          Sends a Telegram message to every registered player
          {audience !== null ? ` (${audience} right now)` : ""}. Paced to stay inside Telegram&apos;s
          limits, so a large audience takes a few minutes.
        </p>
        <textarea
          rows={4}
          maxLength={4000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message…"
          className={`${inputCls} mb-2`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => send(message)} disabled={sending || !message.trim()}>
            {sending ? "Starting…" : "Send to all players"}
          </Button>
          {announcement.trim() && (
            <Button onClick={() => setMessage(announcement)} disabled={sending}>
              Use announcement text
            </Button>
          )}
          <span className="text-xs text-slate-500">{message.length}/4000</span>
        </div>

        {run && (
          <div className="mt-4 rounded-lg border border-edge bg-panel2 p-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge tone={run.status === "completed" ? "green" : run.status === "failed" ? "red" : "yellow"}>
                {run.status}
              </Badge>
              <span className="text-slate-300">
                {run.sent} sent{run.failed > 0 ? `, ${run.failed} failed` : ""} of {run.recipients}
              </span>
            </div>
            {run.failed > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Failures are usually players who have blocked the bot.
              </p>
            )}
          </div>
        )}
      </Card>

      {history.length > 0 && (
        <Card className="p-0">
          <div className="border-b border-edge px-4 py-3 text-xs uppercase tracking-wide text-slate-400">
            Recent broadcasts
          </div>
          <div className="divide-y divide-edge/50">
            {history.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <Badge tone={b.status === "completed" ? "green" : b.status === "failed" ? "red" : "yellow"}>
                  {b.status}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-slate-300">{b.message}</span>
                <span className="shrink-0 text-slate-400">
                  {b.sent}/{b.recipients}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{date(b.created_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * "Today's bonus": a pot split among the first N players who claim it.
 *
 * The amount and the number of slots are set here per campaign — nothing is
 * fixed in code. Only ONE campaign runs at a time, so this panel is either a
 * create form or a live scoreboard, never both.
 */
function CampaignPanel({ enabled, onChanged }: { enabled: boolean; onChanged: () => void }) {
  const push = useToast((s) => s.push);
  const confirm = useConfirm();
  const { data, loading, error, reload } = useApi(() => api.campaigns(25), []);
  const [amount, setAmount] = useState("");
  const [slots, setSlots] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [broadcast, setBroadcast] = useState(true);
  // Bonus lifetime as a value + unit. Blank value → send nothing, so the
  // campaign falls back to the Policy expiry, exactly as before this existed.
  const [expiryValue, setExpiryValue] = useState("");
  const [expiryUnit, setExpiryUnit] = useState<"minutes" | "hours" | "days">("hours");
  const [busy, setBusy] = useState(false);

  const campaigns = data?.campaigns ?? [];
  const active = campaigns.find((c) => c.status === "active") ?? null;

  // Live claim feed for the active campaign. `liveCount` overrides the loaded
  // claimed_count as claims arrive; `liveClaims` is the scoreboard rows,
  // seeded from REST and then prepended to over the socket.
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [liveClaims, setLiveClaims] = useState<BonusCampaignClaim[] | null>(null);
  const [claimsError, setClaimsError] = useState<string | null>(null);

  // Seed the scoreboard from REST whenever the active campaign changes, then
  // the socket keeps it current. Without this seed a dashboard opened
  // mid-campaign would show an empty board until the next claim.
  const activeId = active?.id ?? null;
  useEffect(() => {
    if (!activeId) {
      setLiveClaims(null);
      setLiveCount(null);
      return;
    }
    let cancelled = false;
    setClaimsError(null);
    api
      .campaignClaims(activeId)
      .then((r) => {
        if (cancelled) return;
        setLiveClaims(r.claims);
        setLiveCount(r.claims.length);
      })
      .catch((e) => !cancelled && setClaimsError(e instanceof Error ? e.message : "Failed to load claims"));
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // The real-time connection. Pushes claims the instant they land — no polling.
  // A "claim" updates the count and prepends the row; created/ended change
  // which campaign is active, so those trigger a full reload.
  useEffect(() => {
    const close = openCampaignSocket({
      onEvent: (e) => {
        if (e.event === "claim") {
          setLiveCount(e.data.claimed_count);
          setLiveClaims((prev) => {
            const rows = prev ?? [];
            // Guard against a duplicate if the seed and a frame race.
            if (rows.some((c) => c.user_id === e.data.claim.user_id)) return rows;
            return [e.data.claim, ...rows];
          });
        } else {
          // created / ended: the set of campaigns changed.
          reload();
        }
      },
      // After a dropped-and-restored connection, reconcile from REST.
      onReconnect: reload,
    });
    return close;
  }, [reload]);

  const displayCount = liveCount ?? active?.claimed_count ?? 0;

  const amt = Number(amount);
  const n = Number(slots);
  const validNumbers = Number.isFinite(amt) && amt > 0 && Number.isInteger(n) && n > 0;
  // Mirrors the backend: the pot is split into equal slots, rounded DOWN to
  // the cent so slots * per-player can never exceed what was authorised.
  const perSlot = validNumbers ? Math.floor((amt / n) * 100) / 100 : 0;

  // Blank expiry → undefined (use default). A non-empty, invalid value (0,
  // negative, non-numeric) is caught on submit rather than silently dropped.
  const expiryMinutes = campaignExpiryMinutes(expiryValue, expiryUnit);
  const expiryBlank = expiryValue.trim() === "";

  const create = async () => {
    if (!validNumbers) {
      push("Enter an amount and a whole number of players", "error");
      return;
    }
    if (perSlot < 1) {
      push(`${birr(amt)} across ${n} players is only ${birr(perSlot)} each`, "error");
      return;
    }
    if (!expiryBlank && (expiryMinutes === null || expiryMinutes < 1)) {
      push("Expiry must be a whole number greater than 0, or left blank", "error");
      return;
    }
    const expiryText = expiryBlank
      ? "the default bonus lifetime"
      : `${expiryValue} ${expiryUnit}`;
    if (
      !(await confirm({
        title: "Start today's bonus?",
        message:
          `${birr(amt)} for the first ${n} players — ${birr(perSlot)} each. Bonus expires after ${expiryText}.` +
          (broadcast ? " This WILL Telegram every registered player." : ""),
        confirmLabel: "Start campaign",
        danger: broadcast,
      }))
    )
      return;

    setBusy(true);
    try {
      await api.createCampaign({
        total_amount: amt,
        slots: n,
        announcement: announcement.trim(),
        broadcast,
        expiry_minutes: expiryBlank ? undefined : (expiryMinutes as number),
      });
      push(broadcast ? "Campaign started and announced" : "Campaign started", "success");
      setAmount("");
      setSlots("");
      setAnnouncement("");
      setExpiryValue("");
      reload();
      onChanged();
    } catch (e) {
      push(e instanceof Error ? e.message : "Could not start the campaign", "error");
    } finally {
      setBusy(false);
    }
  };

  const end = async (id: string) => {
    if (
      !(await confirm({
        title: "Stop this campaign?",
        message: "Players who already claimed keep their bonus.",
        confirmLabel: "Stop campaign",
        danger: true,
      }))
    )
      return;
    setBusy(true);
    try {
      await api.endCampaign(id);
      push("Campaign stopped", "success");
      reload();
    } catch (e) {
      push(e instanceof Error ? e.message : "Could not stop the campaign", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorNote message={error} onRetry={reload} />;

  // ---- Live scoreboard: a campaign is running ---------------------------
  if (active) {
    return <ActiveCampaign campaign={active} claimedCount={displayCount} claims={liveClaims} claimsError={claimsError} onEnd={() => end(active.id)} busy={busy} />;
  }

  // ---- Create form: no campaign running --------------------------------
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <div className="space-y-6">
        {!enabled && (
          <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Bonus granting is off in the Policy tab — turn it on first.
          </div>
        )}

        {/* Pot + players — the two numbers that define the campaign */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Total pot</div>
            <div className="relative">
              <input
                className={`${campaignInputCls} pr-10 text-lg font-semibold`}
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">birr</span>
            </div>
          </label>
          <label className="block">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Players</div>
            <input
              className={`${campaignInputCls} text-lg font-semibold`}
              type="number"
              min={1}
              value={slots}
              onChange={(e) => setSlots(e.target.value)}
              placeholder="10"
            />
          </label>
        </div>

        {/* Live split, one quiet line */}
        <div className="text-sm text-slate-400">
          {validNumbers ? (
            <>
              Each gets <span className="font-semibold text-brand">{birr(perSlot)}</span>
            </>
          ) : (
            <span className="text-slate-600">Enter a pot and player count</span>
          )}
        </div>

        {/* Expiry — presets, with a compact custom input inline */}
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Expires after</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {EXPIRY_PRESETS.map((p) => {
              const selected = p.value === "" ? expiryBlank : !expiryBlank && expiryMinutes === p.minutes;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setExpiryValue(p.value);
                    if (p.unit) setExpiryUnit(p.unit);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    selected ? "bg-brand text-ink" : "bg-panel2 text-slate-300 hover:bg-edge"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
            <input
              className={`${campaignInputCls} w-16`}
              type="number"
              min={1}
              value={expiryValue}
              onChange={(e) => setExpiryValue(e.target.value)}
              placeholder="#"
            />
            <select
              className={`${campaignInputCls} w-24`}
              value={expiryUnit}
              onChange={(e) => setExpiryUnit(e.target.value as "minutes" | "hours" | "days")}
            >
              <option value="minutes">min</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </div>
        </div>

        {/* Announcement */}
        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Message (optional)</div>
          <textarea
            className={`${campaignInputCls} h-20 resize-none`}
            maxLength={1000}
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="Leave blank for the default bilingual message"
          />
        </div>

        {/* Broadcast toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={broadcast}
          onClick={() => setBroadcast(!broadcast)}
          className="flex w-full items-center justify-between text-sm text-slate-300"
        >
          <span>Notify all players on Telegram</span>
          <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${broadcast ? "bg-brand" : "bg-edge"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${broadcast ? "left-[22px]" : "left-0.5"}`} />
          </span>
        </button>

        <Button className="w-full" onClick={create} disabled={busy || !validNumbers}>
          {busy ? "Starting…" : "Start bonus"}
        </Button>
      </div>

      {/* Past campaigns — a plain table, no card */}
      <div>
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">History</div>
        {campaigns.length === 0 ? (
          <EmptyState message="No campaigns yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-edge">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Pot</th>
                  <th className="py-2 pr-3 font-medium">Each</th>
                  <th className="py-2 pr-3 font-medium">Expiry</th>
                  <th className="py-2 font-medium">Claimed</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-edge/40">
                    <td className="py-2 pr-3 text-slate-400">{date(c.created_at)}</td>
                    <td className="py-2 pr-3">{birr(c.total_amount)}</td>
                    <td className="py-2 pr-3">{birr(c.amount_per_slot)}</td>
                    <td className="py-2 pr-3 text-slate-400">{humanizeExpiry(c.expiry_minutes)}</td>
                    <td className="py-2 tabular-nums">
                      {c.claimed_count}/{c.slots}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveCampaign({
  campaign,
  claimedCount,
  claims,
  claimsError,
  onEnd,
  busy,
}: {
  campaign: BonusCampaign;
  // Live count from the socket; falls back to the campaign's own value.
  claimedCount: number;
  claims: BonusCampaignClaim[] | null;
  claimsError: string | null;
  onEnd: () => void;
  busy: boolean;
}) {
  const left = Math.max(0, campaign.slots - claimedCount);
  const pct = Math.min(100, Math.round((claimedCount / campaign.slots) * 100));
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
      {/* Scoreboard + controls */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            {left === 0 ? "Full" : "Live"}
          </span>
          <span className="text-slate-500">· started {date(campaign.created_at)}</span>
        </div>

        {/* Hero count */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold tabular-nums text-slate-100">{claimedCount}</span>
            <span className="text-2xl text-slate-500">/ {campaign.slots}</span>
            <span className="ml-auto text-sm text-slate-400">
              {left === 0 ? "all claimed" : `${left} left`}
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-panel2">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Compact facts */}
        <div className="grid grid-cols-3 gap-3 border-t border-edge pt-5">
          <Metric label="Pot" value={birr(campaign.total_amount)} />
          <Metric label="Each" value={birr(campaign.amount_per_slot)} />
          <Metric label="Expires" value={humanizeExpiry(campaign.expiry_minutes)} />
        </div>

        <Button variant="danger" className="w-full" onClick={onEnd} disabled={busy}>
          {busy ? "Stopping…" : "Stop bonus"}
        </Button>
      </div>

      {/* Live claims */}
      <div>
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          Claims
        </div>
        <ClaimsTable claims={claims} error={claimsError} />
      </div>
    </div>
  );
}

/** A compact label + value used across the scoreboard. */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 font-semibold text-slate-100">{value}</div>
    </div>
  );
}

/**
 * Who got in, in the order they got in. Presentational: the parent seeds it
 * from REST and then prepends rows as claims arrive over the socket, so the
 * board updates live without this component fetching anything.
 */
function ClaimsTable({
  claims,
  error,
}: {
  claims: BonusCampaignClaim[] | null;
  error: string | null;
}) {
  if (error)
    return (
      <div className="p-4">
        <ErrorNote message={error} />
      </div>
    );
  if (claims === null) return <Spinner />;
  if (claims.length === 0) return <EmptyState message="Waiting for the first claim…" />;

  return (
    <div className="max-h-[30rem] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-ink text-left text-xs uppercase tracking-wide text-slate-500">
          <tr className="border-b border-edge">
            <th className="w-8 py-2 font-medium">#</th>
            <th className="py-2 font-medium">Player</th>
            <th className="py-2 pr-3 text-right font-medium">Got</th>
            <th className="py-2 text-right font-medium">When</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((c) => (
            <tr key={c.user_id} className="border-b border-edge/40">
              <td className="py-2.5 tabular-nums text-slate-500">{c.position}</td>
              <td className="py-2.5">
                <div className="text-slate-200">{readable(c.name) || "—"}</div>
                <div className="text-xs text-slate-500">{c.phone}</div>
              </td>
              <td className="py-2.5 pr-3 text-right font-medium text-brand">{birr(c.amount)}</td>
              <td className="py-2.5 text-right text-slate-500">{date(c.claimed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const campaignInputCls =
  "w-full rounded-lg border border-edge bg-panel2 px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-brand";

// One-tap expiry choices. `value: ""` is the "use the Policy default" chip;
// the rest preset the custom number + unit. `minutes` is precomputed so the
// selected-state check is a plain number comparison.
const EXPIRY_PRESETS: {
  label: string;
  value: string;
  unit?: "minutes" | "hours" | "days";
  minutes?: number;
}[] = [
  { label: "1 hour", value: "1", unit: "hours", minutes: 60 },
  { label: "3 hours", value: "3", unit: "hours", minutes: 180 },
  { label: "12 hours", value: "12", unit: "hours", minutes: 720 },
  { label: "1 day", value: "1", unit: "days", minutes: 1440 },
  { label: "Default", value: "" },
];

/** Value + unit → minutes for the API. null when the value is not a positive integer. */
function campaignExpiryMinutes(
  value: string,
  unit: "minutes" | "hours" | "days",
): number | null {
  const v = Number(value);
  if (!Number.isInteger(v) || v <= 0) return null;
  return unit === "days" ? v * 1440 : unit === "hours" ? v * 60 : v;
}

/** Minutes → a short label for a scoreboard or history row. "Default" when unset. */
function humanizeExpiry(minutes?: number): string {
  if (!minutes || minutes <= 0) return "Default";
  if (minutes % 1440 === 0) return `${minutes / 1440}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

