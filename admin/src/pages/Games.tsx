import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Game, type GameDetail as GameDetailData, type GameState } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import {
  Card,
  Table,
  thClass,
  tdClass,
  trClass,
  Tabs,
  SearchInput,
  StatusBadge,
  IconButton,
  Button,
  Input,
  Avatar,
  Spinner,
  Skeleton,
  ErrorNote,
  EmptyState,
  PageHeader,
  Pagination,
  Drawer,
  DetailRow,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm";
import { birr, date, fullName, initials, shortId, statusTone } from "@/lib/format";

type TabKey = "all" | "active" | GameState;

const TABS: { key: TabKey; label: string }[] = [
  { key: "active", label: "Active / Live" },
  { key: "all", label: "All" },
  { key: "WAITING", label: "Waiting" },
  { key: "COUNTDOWN", label: "Countdown" },
  { key: "DRAWING", label: "Drawing" },
  { key: "FINISHED", label: "Finished" },
  { key: "CANCELLED", label: "Cancelled" },
];

const ACTIVE_STATES: GameState[] = ["WAITING", "COUNTDOWN", "DRAWING"];

export function isCancellable(state: GameState): boolean {
  return ACTIVE_STATES.includes(state);
}

export function Games() {
  const [tab, setTab] = useState<TabKey>("active");
  const [detailGame, setDetailGame] = useState<Game | null>(null);
  const push = useToast((s) => s.push);
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const search = useDebouncedValue(q.trim(), 300);

  const stateFilter: GameState | undefined = tab === "all" || tab === "active" ? undefined : tab;

  const PAGE = 50;
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [tab, search]); // reset to first page when the tab changes

  const { data, loading, error, reload, updatedAt } = usePolling(
    () =>
      api.games({
        state: stateFilter,
        active: tab === "active",
        search,
        limit: PAGE,
        offset: page * PAGE,
      }),
    [tab, page, search],
    6000,
  );

  const visible: Game[] = data?.games ?? [];
  const total = data?.total ?? 0;

  const cancel = async (g: Game) => {
    if (
      !(await confirm({
        title: `Cancel ${g.game_type} game?`,
        message: `Refunds ${g.player_count} player(s) their ${birr(g.bet_amount)} stake. This cannot be undone.`,
        confirmLabel: "Cancel & refund",
        danger: true,
      }))
    )
      return;
    setBusyId(g.id);
    try {
      const res = await api.cancelGame(g.id);
      push(
        `Cancelled — refunded ${res.refunded_count} player(s), ${birr(res.refunded_amount)} total`,
        "success",
      );
      reload();
    } catch (e) {
      push(e instanceof Error ? e.message : "Cancel failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Games"
        subtitle="Round monitoring"
        updatedAt={updatedAt}
        onReload={reload}
      />

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-edgeSoft p-4">
          <Tabs tabs={TABS} active={tab} onChange={setTab} />
          <SearchInput value={q} onChange={setQ} placeholder="Search games…" className="w-full sm:ml-auto sm:w-72" />
        </div>

        {loading && !data ? (
          <Skeleton />
        ) : error && !data ? (
          <div className="p-4">
            <ErrorNote message={error} onRetry={reload} />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState message="No games here." icon="games" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={thClass}>Game</th>
                <th className={thClass}>State</th>
                <th className={`${thClass} text-right`}>Players</th>
                <th className={`${thClass} text-right`}>Stake</th>
                <th className={`${thClass} text-right`}>Prize pool</th>
                <th className={thClass}>Created</th>
                <th className={`${thClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((g) => (
                <tr key={g.id} className={trClass}>
                  <td className={tdClass}>
                    <button
                      onClick={() => setDetailGame(g)}
                      className="text-left font-medium text-txt hover:text-brand"
                    >
                      {g.game_type}
                    </button>
                    <div className="font-mono text-xs text-txt-4">{shortId(g.id)}</div>
                  </td>
                  <td className={tdClass}>
                    <StatusBadge value={g.state} tone={statusTone(g.state)} />
                  </td>
                  <td className={`${tdClass} text-right tabular-nums text-txt-2`}>{g.player_count}</td>
                  <td className={`${tdClass} text-right tabular-nums text-txt-2`}>{birr(g.bet_amount)}</td>
                  <td className={`${tdClass} text-right font-semibold tabular-nums text-txt`}>
                    {birr(g.prize_pool)}
                  </td>
                  <td className={`${tdClass} text-txt-3`}>{date(g.created_at)}</td>
                  <td className={`${tdClass} text-right`}>
                    <div className="flex justify-end gap-2">
                      <IconButton icon="eye" title="View details" onClick={() => setDetailGame(g)} />
                      {isCancellable(g.state) ? (
                        <IconButton
                          icon="stop"
                          tone="red"
                          title="Cancel & refund"
                          loading={busyId === g.id}
                          onClick={() => cancel(g)}
                        />
                      ) : (
                        <span className="grid h-8 w-8 place-items-center text-txt-4">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {total > 0 && (
          <Pagination page={page} pageSize={PAGE} total={total} onPage={setPage} shown={visible.length} />
        )}
      </Card>

      <GameDrawer game={detailGame} onClose={() => setDetailGame(null)} onChanged={reload} />
    </div>
  );
}

function GameDrawer({
  game,
  onClose,
  onChanged,
}: {
  game: Game | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const push = useToast((s) => s.push);
  const confirm = useConfirm();
  const [detail, setDetail] = useState<GameDetailData | null>(null);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [count, setCount] = useState("");
  const [busy, setBusy] = useState(false);

  const gameId = game?.id;
  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    setDetail(null);
    setCount("");
    setLoadingPlayers(true);
    api
      .gameDetail(gameId)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => {})
      .finally(() => !cancelled && setLoadingPlayers(false));
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (!game) return null;
  const players = detail?.players ?? [];

  const refetch = async () => {
    try {
      setDetail(await api.gameDetail(game.id));
    } catch {
      /* keep prior */
    }
  };

  const addBots = async () => {
    const n = Number(count);
    if (!Number.isInteger(n) || n <= 0) return push("Enter a whole number of bots", "error");
    setBusy(true);
    try {
      const r = await api.addBots(game.id, n);
      push(`Added ${r.added} bot(s) — ${r.bot_players} bots, ${r.real_players} real`, "success");
      setCount("");
      onChanged();
      await refetch();
    } catch (e) {
      push(e instanceof Error ? e.message : "Could not add bots", "error");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (
      !(await confirm({
        title: `Cancel ${game.game_type} game?`,
        message: `Refunds ${game.player_count} player(s) their ${birr(game.bet_amount)} stake.`,
        confirmLabel: "Cancel & refund",
        danger: true,
      }))
    )
      return;
    setBusy(true);
    try {
      const res = await api.cancelGame(game.id);
      push(`Cancelled — refunded ${res.refunded_count} player(s), ${birr(res.refunded_amount)} total`, "success");
      onChanged();
      onClose();
    } catch (e) {
      push(e instanceof Error ? e.message : "Cancel failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const stat = (label: string, value: React.ReactNode) => (
    <div className="rounded-xl border border-edgeSoft bg-panel2 p-3">
      <div className="text-[11px] text-txt-3">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums text-txt">{value}</div>
    </div>
  );

  const footer = isCancellable(game.state) ? (
    <Button variant="danger" icon="stop" loading={busy} className="w-full" onClick={cancel}>
      Cancel & refund
    </Button>
  ) : undefined;

  return (
    <Drawer
      open
      title={`${game.game_type} game`}
      subtitle={<span className="font-mono">{shortId(game.id)}</span>}
      onClose={onClose}
      footer={footer}
    >
      <div className="mb-4 flex justify-center">
        <StatusBadge value={game.state} tone={statusTone(game.state)} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {stat("Players", game.player_count)}
        {stat("Prize pool", birr(game.prize_pool))}
        {stat("Stake", birr(game.bet_amount))}
        {stat("House cut", `${Math.round(game.house_cut * 100)}%`)}
      </div>

      <div className="mt-4">
        <DetailRow label="Minimum players">{game.min_players}</DetailRow>
        <DetailRow label="Created">{date(game.created_at)}</DetailRow>
        <DetailRow label="Started">{game.started_at ? date(game.started_at) : "—"}</DetailRow>
        <DetailRow label="Finished">{game.finished_at ? date(game.finished_at) : "—"}</DetailRow>
      </div>

      {isCancellable(game.state) && (
        <div className="mt-4 rounded-xl border border-edgeSoft bg-panel2 p-3">
          <div className="mb-2 text-xs font-medium text-txt-2">Add filler bots</div>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="Count"
              className="flex-1"
            />
            <Button icon="bots" loading={busy} onClick={addBots}>
              Add
            </Button>
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-txt-4">
          Players {players.length > 0 && `(${players.length})`}
        </div>
        {loadingPlayers ? (
          <Spinner />
        ) : players.length === 0 ? (
          <EmptyState message="No players in this game." icon="users" />
        ) : (
          <div className="space-y-1.5">
            {players.map((p) => (
              <div
                key={p.user_id + p.card_id}
                className="flex items-center gap-2.5 rounded-xl border border-edgeSoft bg-panel2 px-3 py-2"
              >
                <Avatar initials={initials(p.first_name, p.last_name)} size={26} />
                <div className="min-w-0 flex-1">
                  <Link to={`/users/${p.user_id}`} className="block truncate text-sm text-txt hover:text-brand" onClick={onClose}>
                    {fullName(p.first_name, p.last_name) || shortId(p.user_id)}
                  </Link>
                  <div className="truncate text-xs text-txt-3">{p.phone_number || "—"}</div>
                </div>
                <span className="font-mono text-xs text-txt-3">#{p.card_id}</span>
                {p.is_eliminated && <StatusBadge value="Out" tone="red" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
