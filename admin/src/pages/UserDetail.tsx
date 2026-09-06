import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type UserGameStats } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  StatCard,
  StatusBadge,
  Skeleton,
  Spinner,
  ErrorNote,
  PageHeader,
  Table,
  thClass,
  tdClass,
  trClass,
  Pagination,
  EmptyState,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm";
import { birr, date, fullName, initials, shortId, statusTone } from "@/lib/format";

export function UserDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { data, loading, error, reload } = useApi(() => api.userDetail(id), [id]);
  const { data: statsData } = useApi(() => api.userGameStats(id), [id]);
  const stats = statsData?.stats;
  const push = useToast((s) => s.push);
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [showAdminForm, setShowAdminForm] = useState(false);

  const u = data?.user;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      push(ok, "success");
      reload();
    } catch (e) {
      push(e instanceof Error ? e.message : "Action failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const adjust = async (sign: 1 | -1) => {
    const n = Number(amount);
    if (!n || Number.isNaN(n) || n <= 0) {
      push("Enter a positive amount.", "error");
      return;
    }
    await run(() => api.adjustBalance(id, sign * n, reason), `Balance ${sign > 0 ? "credited" : "debited"}`);
    setAmount("");
    setReason("");
  };

  const makeAdmin = async () => {
    if (adminPw.trim().length < 8) {
      push("Password must be at least 8 characters.", "error");
      return;
    }
    await run(() => api.makeAdmin(id, adminPw), "User is now an admin with a password");
    setAdminPw("");
    setShowAdminForm(false);
  };

  const removeUser = async () => {
    const name = fullName(u?.first_name, u?.last_name) || u?.phone_number || "this user";
    if (
      !(await confirm({
        title: `Delete ${name}?`,
        message:
          "This permanently removes their wallet, transactions, and game history. This cannot be undone.",
        confirmLabel: "Delete user",
        danger: true,
      }))
    ) {
      return;
    }
    setBusy(true);
    try {
      await api.deleteUser(id);
      push("User deleted", "success");
      nav("/users");
    } catch (e) {
      push(e instanceof Error ? e.message : "Delete failed", "error");
      setBusy(false);
    }
  };

  const name = fullName(u?.first_name, u?.last_name) || "User";

  return (
    <div>
      <PageHeader
        title={name}
        subtitle="Player account"
        actions={
          <Button variant="subtle" icon="chevronLeft" onClick={() => nav("/users")}>
            Back
          </Button>
        }
      />

      {loading && !u ? (
        <Card>
          <Skeleton rows={5} />
        </Card>
      ) : error && !u ? (
        <ErrorNote message={error} onRetry={reload} />
      ) : u ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* -------------------------------------------------- left column -- */}
          <div className="space-y-4 lg:col-span-2">
            {/* Profile header */}
            <Card>
              <div className="flex items-start gap-4">
                <Avatar initials={initials(u.first_name, u.last_name)} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-txt">{name}</h2>
                    <Badge tone={u.role === "admin" ? "purple" : "neutral"}>{u.role}</Badge>
                    <StatusBadge
                      value={u.banned ? "banned" : "active"}
                      tone={statusTone(u.banned ? "banned" : "active")}
                    />
                  </div>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <Row label="Phone" value={u.phone_number} />
                    <Row label="Telegram ID" value={String(u.telegram_id)} />
                    <Row label="Referral code" value={u.referal_code} />
                    <Row label="Demo balance" value={birr(u.wallet?.demo_balance)} />
                    <Row label="Joined" value={date(u.created_at)} />
                  </dl>
                </div>
              </div>
            </Card>

            {/* Role */}
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-txt">Role</h3>
              <div className="flex flex-wrap items-center gap-2">
                {u.role === "admin" ? (
                  <Button
                    variant="ghost"
                    icon="shield"
                    disabled={busy}
                    onClick={() => run(() => api.setRole(id, "user"), "Demoted to user")}
                  >
                    Demote to user
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    icon="shield"
                    disabled={busy}
                    onClick={() => run(() => api.setRole(id, "admin"), "Promoted to admin")}
                  >
                    Promote to admin
                  </Button>
                )}
                <Button
                  variant="subtle"
                  icon="key"
                  disabled={busy}
                  onClick={() => setShowAdminForm((s) => !s)}
                >
                  {u.role === "admin" ? "Reset admin password" : "Make admin"}
                </Button>
              </div>

              {showAdminForm && (
                <div className="mt-4 border-t border-edgeSoft pt-4">
                  <label className="mb-1.5 block text-xs font-medium text-txt-3">
                    {u.role === "admin" ? "New admin password" : "Login password (min 8 chars)"}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      type="password"
                      value={adminPw}
                      onChange={(e) => setAdminPw(e.target.value)}
                      placeholder="New password (min 8 chars)"
                      className="flex-1"
                    />
                    <Button variant="primary" icon="key" loading={busy} onClick={makeAdmin}>
                      {u.role === "admin" ? "Update password" : "Make admin"}
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-txt-4">
                    They sign in with their phone ({u.phone_number}) and this password.
                  </p>
                </div>
              )}
            </Card>

            {/* Balance */}
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-txt">Balance</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-txt-3">Amount (Br)</label>
                  <Input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-txt-3">Reason (optional)</label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason"
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="success" icon="plus" disabled={busy} onClick={() => adjust(1)} className="flex-1">
                  Credit
                </Button>
                <Button variant="danger" icon="coins" disabled={busy} onClick={() => adjust(-1)} className="flex-1">
                  Debit
                </Button>
              </div>
            </Card>

            {/* Danger zone */}
            <Card className="border-danger/30 p-4">
              <h3 className="mb-3 text-sm font-semibold text-danger">Danger zone</h3>
              <div className="flex flex-wrap items-center gap-2">
                {u.banned ? (
                  <Button
                    variant="success"
                    icon="check"
                    disabled={busy}
                    onClick={() => run(() => api.unbanUser(id), "User unbanned")}
                  >
                    Unban user
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    icon="ban"
                    disabled={busy}
                    onClick={() => run(() => api.banUser(id), "User banned")}
                  >
                    Ban user
                  </Button>
                )}
                {u.role === "admin" ? (
                  <p className="text-xs text-txt-4">
                    Admin accounts can't be deleted. Demote to a regular user first.
                  </p>
                ) : (
                  <Button variant="danger" icon="trash" disabled={busy} onClick={removeUser}>
                    Delete user
                  </Button>
                )}
              </div>
            </Card>
          </div>

          {/* ------------------------------------------------- right column -- */}
          <div className="space-y-4">
            <StatCard
              icon="wallet"
              tone="green"
              label="Withdrawable balance"
              value={birr(u.wallet?.balance)}
            />
            <StatCard
              icon="coins"
              tone="gold"
              label="Bonus balance (play-only)"
              value={birr(stats?.bonus_balance ?? 0)}
            />
            {stats && <PlayerMoneyCard stats={stats} />}
          </div>

          {/* -------------------- full-width data cards — each scrolls inside -- */}
          <div className="grid gap-4 lg:col-span-3 lg:grid-cols-2">
            <TransactionHistory userId={id} />
            <GamesPlayed userId={id} />
            <div className="lg:col-span-2">
              <InvitedPlayers userId={id} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// InvitedPlayers lists everyone this player referred, each linking to their own
// profile — so you can trace a referral chain.
function InvitedPlayers({ userId }: { userId: string }) {
  const { data, loading } = useApi(() => api.userReferrals(userId), [userId]);
  const users = data?.users ?? [];
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-txt">Invited players ({users.length})</h3>
      {loading && !data ? (
        <Spinner />
      ) : users.length === 0 ? (
        <p className="text-sm text-txt-4">Hasn't invited anyone.</p>
      ) : (
        // Bounded height with internal scroll, so a big referral list scrolls
        // inside the card instead of stretching the whole page down.
        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {users.map((u) => (
            <li key={u.id}>
              <Link
                to={`/users/${u.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-edgeSoft bg-panel2 px-3 py-1.5 transition hover:border-brand"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-txt">
                    {fullName(u.first_name, u.last_name) || u.phone_number}
                  </span>
                  <span className="block truncate text-xs text-txt-3">{u.phone_number}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// GamesPlayed is paginated by distinct game (not by card).
function GamesPlayed({ userId }: { userId: string }) {
  const PAGE = 20;
  const [page, setPage] = useState(0);
  const { data, loading } = useApi(() => api.userGames(userId, PAGE, page * PAGE), [userId, page]);
  const games = data?.games ?? [];
  const total = data?.total ?? 0;

  return (
    <Card className="p-0">
      <div className="border-b border-edgeSoft p-4">
        <h3 className="text-sm font-semibold text-txt">Games played</h3>
        <p className="mt-0.5 text-xs text-txt-3">Click a game to open its full detail.</p>
      </div>
      {loading && !data ? (
        <div className="p-4"><Spinner /></div>
      ) : games.length === 0 ? (
        <EmptyState message="No games played." icon="games" />
      ) : (
        <>
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <thead>
                <tr>
                  <th className={thClass}>Game</th>
                  <th className={thClass}>Type</th>
                  <th className={`${thClass} text-right`}>Staked</th>
                  <th className={thClass}>Result</th>
                  <th className={`${thClass} text-right`}>Won</th>
                  <th className={thClass}>When</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.game.id} className={trClass}>
                    <td className={tdClass}>
                      <Link to={`/games/${g.game.id}`} className="font-mono text-xs text-brand hover:underline">
                        {shortId(g.game.id)}
                      </Link>
                    </td>
                    <td className={tdClass}>{g.game.game_type}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{birr(g.total_stake)}</td>
                    <td className={tdClass}>
                      {g.is_winner ? <Badge tone="green">Won</Badge> : <span className="text-txt-4">—</span>}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums ${g.is_winner ? "text-success" : "text-txt-4"}`}>
                      {g.win_amount > 0 ? birr(g.win_amount) : "—"}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-txt-3`}>{date(g.joined_at)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <Pagination page={page} pageSize={PAGE} total={total} onPage={setPage} shown={games.length} />
        </>
      )}
    </Card>
  );
}

// PlayerMoneyCard shows a player's play record + where their balance came from,
// so an admin reviewing them can tell a real winner from a farmed/bonus account.
function PlayerMoneyCard({ stats }: { stats: UserGameStats }) {
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-txt">Play &amp; money record</h3>
      <div className="grid grid-cols-2 gap-2 text-center">
        <Mini label="Games played" value={String(stats.games_played)} />
        <Mini label="Games won" value={String(stats.games_won)} good={stats.games_won > 0} />
      </div>
      <div className="mt-3 space-y-1.5 border-t border-edgeSoft pt-3 text-sm">
        <Line label="Deposited (real cash)" value={stats.total_deposited} tone={stats.total_deposited > 0 ? "green" : "muted"} />
        <Line label="Bonus / referral (play-only)" value={stats.total_bonus} tone={stats.total_bonus > 0 ? "warning" : "muted"} />
        <Line label="Won by playing" value={stats.total_won} />
        <Line label="Staked" value={stats.total_staked} />
        <Line label="Already withdrawn" value={stats.total_withdrawn} />
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-edgeSoft pt-2 text-sm">
        <span className="text-txt-2">Balance now</span>
        <span className="tabular-nums">
          <span className="font-semibold text-txt">{birr(stats.real_balance)}</span>
          <span className="text-txt-4"> cash</span>
          {stats.bonus_balance > 0 && <span className="text-warning"> · {birr(stats.bonus_balance)} bonus</span>}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-txt-3">Players invited</span>
        <span className="font-medium text-txt-2">{stats.referred_count}</span>
      </div>
      <div className="mt-3 text-center">
        {stats.total_deposited === 0 && stats.total_won === 0 ? (
          <Badge tone="red">⚠ Balance is bonus/referral only — no deposits or wins</Badge>
        ) : stats.games_won === 0 ? (
          <Badge tone="red">⚠ Never won a game</Badge>
        ) : (
          <Badge tone="green">✓ Real player — genuine deposits/wins</Badge>
        )}
      </div>
    </Card>
  );
}

// TransactionHistory is the player's full ledger — deposits, withdrawals, bets,
// winnings, bonuses and referral rewards — paginated.
function TransactionHistory({ userId }: { userId: string }) {
  const PAGE = 20;
  const [page, setPage] = useState(0);
  const { data, loading } = useApi(() => api.userTransactions(userId, PAGE, page * PAGE), [userId, page]);
  const rows = data?.transactions ?? [];
  const total = data?.total ?? 0;

  return (
    <Card className="p-0">
      <div className="border-b border-edgeSoft p-4">
        <h3 className="text-sm font-semibold text-txt">Transaction history</h3>
        <p className="mt-0.5 text-xs text-txt-3">Every money movement — deposits, withdrawals, winnings, bonuses & referral rewards.</p>
      </div>
      {loading && !data ? (
        <div className="p-4">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState message="No transactions yet." icon="transactions" />
      ) : (
        <>
          <div className="max-h-80 overflow-y-auto">
          <Table>
            <thead>
              <tr>
                <th className={thClass}>Type</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Reference</th>
                <th className={thClass}>When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const isIn = t.type === "deposit" || t.type === "transfer_in";
                return (
                  <tr key={t.id} className={trClass}>
                    <td className={tdClass}>
                      <StatusBadge value={t.category ?? t.type} tone={statusTone(t.category ?? t.type)} />
                    </td>
                    <td className={`${tdClass} text-right font-semibold tabular-nums ${isIn ? "text-success" : "text-txt"}`}>
                      {isIn ? "+" : "−"}
                      {birr(t.amount)}
                    </td>
                    <td className={tdClass}>
                      <StatusBadge value={t.status} tone={statusTone(t.status)} />
                    </td>
                    <td className={`${tdClass} font-mono text-xs text-txt-3`}>
                      {t.transaction_id || t.reference || "—"}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-txt-3`}>{date(t.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          </div>
          <Pagination page={page} pageSize={PAGE} total={total} onPage={setPage} shown={rows.length} />
        </>
      )}
    </Card>
  );
}

function Mini({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-xl border border-edgeSoft bg-panel2 p-2.5">
      <div className={`text-lg font-bold tabular-nums ${good ? "text-success" : "text-txt"}`}>{value}</div>
      <div className="text-[11px] text-txt-4">{label}</div>
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: number; tone?: "green" | "warning" | "muted" }) {
  const color =
    tone === "green" ? "text-success" : tone === "warning" ? "text-warning" : tone === "muted" ? "text-txt-4" : "text-txt";
  return (
    <div className="flex items-center justify-between">
      <span className="text-txt-3">{label}</span>
      <span className={`tabular-nums font-medium ${color}`}>{birr(value)}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 sm:block">
      <dt className="text-txt-3 sm:text-xs">{label}</dt>
      <dd className="text-right font-medium text-txt-2 sm:mt-0.5 sm:text-left">
        {value || <span className="text-txt-4">—</span>}
      </dd>
    </div>
  );
}
