import { useState } from "react";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import { useApi } from "@/lib/useApi";
import { Card, Spinner, ErrorNote, StatCard, PageHeader, EmptyState, Drawer } from "@/components/ui";
import { birr, date } from "@/lib/format";

export function Dashboard() {
  const { data, loading, error, reload, updatedAt } = usePolling(() => api.dashboard(), [], 10000);
  const [showHouseCut, setShowHouseCut] = useState(false);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Operational overview"
        updatedAt={updatedAt}
        onReload={reload}
      />

      {loading && !data && <Spinner />}
      {error && !data && <ErrorNote message={error} onRetry={reload} />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon="wallet"
              tone="green"
              label="Wallet balance (real)"
              value={birr(data.total_balance)}
              sub="Total held across players"
            />
            <StatCard
              icon="coins"
              tone="gold"
              label="House cut (revenue)"
              value={birr(data.total_house_cut)}
              sub="Tap for the breakdown →"
              onClick={() => setShowHouseCut(true)}
            />
            <StatCard
              icon="users"
              tone="blue"
              label="Registered players"
              value={data.total_users.toLocaleString()}
              sub={`${data.total_transactions.toLocaleString()} transactions`}
            />
            <StatCard
              icon={data.pending_deposits + data.pending_withdrawals > 0 ? "clock" : "check"}
              tone={data.pending_deposits + data.pending_withdrawals > 0 ? "red" : "green"}
              label="Pending approvals"
              value={data.pending_deposits + data.pending_withdrawals}
              sub={`${data.pending_deposits} deposits · ${data.pending_withdrawals} withdrawals`}
            />
          </div>

          {/* Real-player P&L — a wide highlight card */}
          <Card className="mt-4 flex flex-col gap-1 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-medium text-txt-3">Real-player game P&amp;L</div>
              <div
                className={`mt-1 text-3xl font-bold tabular-nums ${
                  data.real_player_game_pnl < 0 ? "text-danger" : "text-success"
                }`}
              >
                {data.real_player_game_pnl < 0 ? "−" : "+"}
                {birr(Math.abs(data.real_player_game_pnl))}
              </div>
            </div>
            <p className="max-w-md text-xs leading-relaxed text-txt-3">
              Net real-player result after stakes and winnings; bots excluded.
            </p>
          </Card>

          <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-txt-4">
            Games by type
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Object.entries(data.games_by_type ?? {}).length === 0 ? (
              <Card className="col-span-full p-0">
                <EmptyState message="No games yet." icon="games" />
              </Card>
            ) : (
              Object.entries(data.games_by_type).map(([type, count]) => (
                <Card key={type} className="p-4">
                  <div className="text-xs text-txt-3">{type}</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-txt">{count}</div>
                </Card>
              ))
            )}
          </div>
        </>
      )}

      {showHouseCut && <HouseCutDrawer onClose={() => setShowHouseCut(false)} />}
    </div>
  );
}

// HouseCutDrawer breaks the house-cut revenue down per tier and per day, plus the
// real-player P&L — so an admin can see exactly where revenue comes from and that
// each tier (Regular / VIP) is self-contained.
function HouseCutDrawer({ onClose }: { onClose: () => void }) {
  const { data, loading, error } = useApi(() => api.houseCutDetail(), []);
  const d = data?.detail;
  return (
    <Drawer open title="House cut — detail" subtitle="Where your revenue comes from" onClose={onClose}>
      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorNote message={error} />
      ) : d ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-edgeSoft bg-panel2 p-3 text-center">
              <div className="text-xs text-txt-4">Total house cut</div>
              <div className="text-xl font-bold tabular-nums text-brand">{birr(d.total_house_cut)}</div>
            </div>
            <div className="rounded-xl border border-edgeSoft bg-panel2 p-3 text-center">
              <div className="text-xs text-txt-4">Real-player P&amp;L</div>
              <div className={`text-xl font-bold tabular-nums ${d.real_player_pnl < 0 ? "text-danger" : "text-success"}`}>
                {d.real_player_pnl < 0 ? "−" : "+"}
                {birr(Math.abs(d.real_player_pnl))}
              </div>
            </div>
          </div>

          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-txt-4">By table (tier)</div>
          <div className="mb-4 space-y-1.5">
            {d.by_tier.length === 0 ? (
              <p className="text-sm text-txt-4">No finished games yet.</p>
            ) : (
              d.by_tier.map((t) => (
                <div key={t.tier} className="flex items-center justify-between rounded-lg border border-edgeSoft bg-panel2 px-3 py-2 text-sm">
                  <span className="font-medium text-txt">{t.tier}</span>
                  <span className="text-txt-3">{t.games} games</span>
                  <span className="font-semibold tabular-nums text-brand">{birr(t.house_cut)}</span>
                </div>
              ))
            )}
          </div>

          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-txt-4">Last 14 days</div>
          {d.by_day.length === 0 ? (
            <p className="text-sm text-txt-4">No games in the last 14 days.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {d.by_day.map((day) => (
                  <tr key={day.day} className="border-t border-edgeSoft">
                    <td className="py-1.5 text-txt-3">{date(day.day)}</td>
                    <td className="py-1.5 text-right text-txt-4">{day.games} games</td>
                    <td className="py-1.5 text-right font-medium tabular-nums text-txt">{birr(day.house_cut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}
    </Drawer>
  );
}
