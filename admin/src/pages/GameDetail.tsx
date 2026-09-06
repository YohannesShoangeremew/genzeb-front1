import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import {
  Card,
  StatCard,
  Button,
  Input,
  Avatar,
  Table,
  thClass,
  tdClass,
  trClass,
  StatusBadge,
  Skeleton,
  ErrorNote,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm";
import { birr, date, shortId, initials, fullName, readable, statusTone } from "@/lib/format";
import { isCancellable } from "@/pages/Games";

export function GameDetail() {
  const { id = "" } = useParams();
  const { data, loading, error, reload } = useApi(() => api.gameDetail(id), [id]);
  const push = useToast((s) => s.push);
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [addCount, setAddCount] = useState("5");
  const [adding, setAdding] = useState(false);

  const g = data?.game;
  const players = data?.players ?? [];
  const funding = data?.funding ?? { total_players: 0, wallet_players: 0, bonus_players: 0, mixed_players: 0 };
  const canFill = g?.state === "WAITING" || g?.state === "COUNTDOWN";

  const addBots = async () => {
    const n = Number(addCount);
    if (!n || n < 1) {
      push("Enter a bot count of 1 or more", "error");
      return;
    }
    setAdding(true);
    try {
      const res = await api.addBots(id, n);
      if (res.added === 0) {
        push(
          res.real_players < 1
            ? "No bots added — a game needs at least 1 real player."
            : "No bots added — game full or not joinable.",
          "info",
        );
      } else {
        push(`Added ${res.added} bot(s) — now ${res.bot_players} bots, ${res.real_players} real`, "success");
      }
      reload();
    } catch (e) {
      push(e instanceof Error ? e.message : "Add bots failed", "error");
    } finally {
      setAdding(false);
    }
  };

  const cancel = async () => {
    if (!g) return;
    if (
      !(await confirm({
        title: `Cancel ${g.game_type} game?`,
        message: `Refunds all ${g.player_count} player(s) ${birr(g.bet_amount)} each and marks the game cancelled. This cannot be undone.`,
        confirmLabel: "Cancel game",
        danger: true,
      }))
    )
      return;
    setBusy(true);
    try {
      const res = await api.cancelGame(id);
      push(
        `Cancelled — refunded ${res.refunded_count} player(s) ${birr(res.refunded_amount)} total`,
        "success",
      );
      reload();
    } catch (e) {
      push(e instanceof Error ? e.message : "Cancel failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link to="/games" className="mb-4 inline-block">
        <Button variant="subtle" icon="chevronLeft">
          Back to games
        </Button>
      </Link>

      <PageHeader
        title={g ? `${g.game_type} · ${shortId(g.id)}` : "Game"}
        subtitle="Round overview"
      />

      {loading && !data ? (
        <Card>
          <Skeleton />
        </Card>
      ) : error && !data ? (
        <ErrorNote message={error} onRetry={reload} />
      ) : g ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              icon="games"
              tone="blue"
              label="State"
              value={<StatusBadge value={g.state} tone={statusTone(g.state)} />}
            />
            <StatCard icon="users" tone="gold" label="Players" value={g.player_count} />
            <StatCard icon="coins" tone="green" label="Stake" value={birr(g.bet_amount)} />
            <StatCard icon="wallet" tone="gold" label="Prize pool" value={birr(g.prize_pool)} />
            <StatCard
              icon="reports"
              tone="green"
              label="House cut"
              value={`${Math.round(g.house_cut * 100)}%`}
            />
          </div>

          <Card>
            <dl className="grid gap-4 sm:grid-cols-3">
              <DateItem label="Created" value={g.created_at} />
              <DateItem label="Started" value={g.started_at} />
              <DateItem label="Finished" value={g.finished_at} />
            </dl>
          </Card>

          <Card>
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-txt">Player funding source</h2>
              <p className="mt-1 text-xs text-txt-3">Distinct real players with paid cards in this game. Bots and unpaid reservations are excluded.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <FundingItem label="Paid players" value={funding.total_players} tone="text-txt" />
              <FundingItem label="Withdrawable wallet" value={funding.wallet_players} tone="text-success" />
              <FundingItem label="Bonus account" value={funding.bonus_players} tone="text-warning" />
              <FundingItem label="Used both" value={funding.mixed_players} tone="text-brand" />
            </div>
            <p className="mt-3 text-xs text-txt-4">Wallet and bonus counts overlap when the same player bought cards from both sources.</p>
          </Card>

          {(data?.winners?.length ?? 0) > 0 && (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-txt">
                🏆 Winner{data!.winners.length > 1 ? "s" : ""} ({data!.winners.length})
              </h2>
              <div className="space-y-2">
                {data!.winners.map((w) => (
                  <Link
                    key={`${w.user_id}-${w.card_id}`}
                    to={`/users/${w.user_id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 transition hover:border-success"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar initials={initials(readable(w.winner_name))} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-txt">
                          {readable(w.winner_name) || shortId(w.user_id)}
                        </span>
                        <span className="block text-xs text-txt-3">Card #{w.card_id}</span>
                      </span>
                    </span>
                    <span className="font-bold tabular-nums text-success">{birr(w.prize)}</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-0">
            <div className="border-b border-edgeSoft p-4">
              <h2 className="text-sm font-semibold text-txt">Players ({players.length})</h2>
            </div>
            {players.length === 0 ? (
              <EmptyState message="No active players." icon="users" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th className={thClass}>Player</th>
                    <th className={thClass}>Phone</th>
                    <th className={`${thClass} text-right`}>Card</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => (
                    <tr key={p.user_id} className={trClass}>
                      <td className={tdClass}>
                        <Link
                          to={`/users/${p.user_id}`}
                          className="flex items-center gap-2.5 font-medium text-txt hover:text-brand"
                        >
                          <Avatar initials={initials(p.first_name, p.last_name)} />
                          <span>{fullName(p.first_name, p.last_name) || p.phone_number}</span>
                        </Link>
                      </td>
                      <td className={`${tdClass} text-txt-2`}>
                        {p.phone_number || <span className="text-txt-4">—</span>}
                      </td>
                      <td className={`${tdClass} text-right tabular-nums text-txt-2`}>{p.card_id}</td>
                      <td className={tdClass}>
                        {p.is_eliminated ? (
                          <StatusBadge value="Eliminated" tone="red" />
                        ) : (
                          <StatusBadge value="Active" tone="green" />
                        )}
                      </td>
                      <td className={`${tdClass} text-txt-2`}>{date(p.joined_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          {(canFill || isCancellable(g.state)) && (
            <Card>
              <h2 className="mb-4 text-sm font-semibold text-txt">Actions</h2>
              <div className="flex flex-wrap items-end gap-6">
                {canFill && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-txt-3">Add filler bots</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={addCount}
                        onChange={(e) => setAddCount(e.target.value)}
                        className="w-24"
                      />
                      <Button variant="ghost" icon="bots" loading={adding} onClick={addBots}>
                        Add bots
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-txt-4">
                      House-funded bots that stake {birr(g.bet_amount)} each. Requires ≥1 real player.
                    </p>
                  </div>
                )}

                {isCancellable(g.state) && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-txt-3">Cancel game</label>
                    <Button variant="danger" icon="stop" loading={busy} onClick={cancel}>
                      Cancel game & refund all stakes
                    </Button>
                    <p className="mt-2 text-xs text-txt-4">
                      Refunds {birr(g.bet_amount)} to each active player.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DateItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-txt-3">{label}</dt>
      <dd className="mt-1 text-sm text-txt-2">
        {value ? date(value) : <span className="text-txt-4">—</span>}
      </dd>
    </div>
  );
}

function FundingItem({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-edgeSoft bg-panel2 p-3 text-center">
      <div className="text-xs text-txt-4">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
