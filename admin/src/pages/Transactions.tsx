import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  ApiError,
  type Transaction,
  type UserGameStats,
  type VerificationLog,
  type VerificationOutcome,
} from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useConfirm } from "@/components/confirm";
import {
  Card,
  Table,
  thClass,
  tdClass,
  trClass,
  StatusBadge,
  Badge,
  IconButton,
  Button,
  Avatar,
  Tabs,
  SearchInput,
  Pagination,
  Skeleton,
  Spinner,
  ErrorNote,
  EmptyState,
  PageHeader,
  Drawer,
  DetailRow,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { birr, date, initials, readable, shortId, statusTone } from "@/lib/format";

type TabKey =
  | "pendingDeposits"
  | "pendingWithdrawals"
  | "winners"
  | "all"
  | "completedDeposits"
  | "completedWithdrawals"
  | "transfers"
  | "failed";

const PAGE_SIZE = 50;

// Paginated tabs fetch (limit, offset) and return a grand `total` so we can page
// through large data; the others return a single fixed list.
const TABS: {
  key: TabKey;
  label: string;
  paginated?: boolean;
  fetch: (limit: number, offset: number, search: string) => Promise<{ transactions: Transaction[]; total?: number }>;
}[] = [
  { key: "pendingDeposits", label: "Pending deposits", paginated: true, fetch: (l, o, q) => api.pendingDeposits(l, o, q) },
  { key: "pendingWithdrawals", label: "Pending withdrawals", paginated: true, fetch: (l, o, q) => api.pendingWithdrawals(l, o, q) },
  { key: "winners", label: "Winners", paginated: true, fetch: (l, o, q) => api.winners(l, o, q) },
  { key: "all", label: "All", paginated: true, fetch: (l, o, q) => api.transactions(l, o, q) },
  { key: "completedDeposits", label: "Completed deposits", paginated: true, fetch: (l, o, q) => api.completedDeposits(l, o, q) },
  { key: "completedWithdrawals", label: "Completed withdrawals", paginated: true, fetch: (l, o, q) => api.completedWithdrawals(l, o, q) },
  { key: "transfers", label: "Transfers", paginated: true, fetch: (l, o, q) => api.transfers(l, o, q) },
  { key: "failed", label: "Failed", paginated: true, fetch: (l, o, q) => api.failed(l, o, q) },
];

export function Transactions() {
  const [tab, setTab] = useState<TabKey>("pendingDeposits");
  const [q, setQ] = useState("");
  const search = useDebouncedValue(q.trim(), 300);
  const [page, setPage] = useState(0);
  const active = TABS.find((t) => t.key === tab)!;
  // Reset to the first page whenever the tab changes.
  useEffect(() => setPage(0), [tab, search]);
  const { data, loading, error, reload, updatedAt } = usePolling(
    () => active.fetch(PAGE_SIZE, page * PAGE_SIZE, search),
    [tab, page, search],
    8000,
  );
  const total = data?.total;
  const push = useToast((s) => s.push);
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Transaction | null>(null);

  const act = async (id: string, fn: (id: string) => Promise<unknown>, label: string) => {
    setBusyId(id);
    try {
      await fn(id);
      push(`${label} done`, "success");
      reload();
    } catch (e) {
      push(e instanceof Error ? e.message : `${label} failed`, "error");
    } finally {
      setBusyId(null);
    }
  };

  // Approve a deposit. The backend refuses (HTTP 409) a receipt the verifier
  // definitively REJECTED; we surface the reason and let the admin force it only
  // after an explicit confirmation, so a bogus receipt is never credited blindly.
  const approveDeposit = async (id: string) => {
    setBusyId(id);
    try {
      await api.approveDeposit(id);
      push("Deposit approved", "success");
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const ok = await confirm({
          title: "Verifier rejected this receipt",
          message: `${e.message}. Only force-approve if you have confirmed the payment reached the house account yourself.`,
          confirmLabel: "Force approve",
          danger: true,
        });
        if (ok) {
          try {
            await api.approveDeposit(id, true);
            push("Deposit force-approved", "success");
            reload();
          } catch (e2) {
            push(e2 instanceof Error ? e2.message : "Approve failed", "error");
          }
        }
      } else {
        push(e instanceof Error ? e.message : "Approve failed", "error");
      }
    } finally {
      setBusyId(null);
    }
  };

  // Roll back a withdrawal: refund the genuine part to cash, the rest to bonus.
  const rollback = async (id: string) => {
    setBusyId(id);
    try {
      const res = await api.rejectWithdrawalToBonus(id);
      const r = res.result;
      push(`Rolled back — ${birr(r.real_refunded)} to balance, ${birr(r.bonus_granted)} to bonus`, "success");
      reload();
      setDetail(null);
    } catch (e) {
      push(e instanceof Error ? e.message : "Rollback failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  const rows = data?.transactions ?? [];

  const visible = rows;
  const resultTotal = total;

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="Money movement"
        updatedAt={updatedAt}
        onReload={reload}
      />

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-edgeSoft p-4">
          <Tabs tabs={TABS} active={tab} onChange={setTab} />
          <div className="ml-auto">
            <SearchInput value={q} onChange={setQ} placeholder="Search player, phone or reference…" />
          </div>
        </div>

        {loading && !data ? (
          <Skeleton />
        ) : error && !data ? (
          <div className="p-4">
            <ErrorNote message={error} onRetry={reload} />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState message={q ? "No transactions match your search." : "No transactions here."} icon="transactions" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={thClass}>Player</th>
                <th className={thClass}>Type</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={thClass}>Payment</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>When</th>
                <th className={`${thClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => {
                // Identity is joined server-side, so this page never needs to load the user directory.
                const name = readable(t.player_name);
                const phone = t.player_phone;
                const typeValue = t.category ?? t.type;
                const payId = t.transaction_id ?? t.reference;
                return (
                  <tr key={t.id} className={trClass}>
                    <td className={tdClass}>
                      <Link to={`/users/${t.user_id}`} className="flex items-center gap-2.5">
                        <Avatar initials={name ? initials(name) : "?"} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-txt">
                            {name || phone || shortId(t.user_id)}
                          </span>
                          <span className="block truncate text-xs text-txt-3">
                            {phone || <span className="text-txt-4">Unknown</span>}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className={tdClass}>
                      <StatusBadge value={typeValue} tone={statusTone(typeValue)} />
                    </td>
                    <td className={`${tdClass} text-right font-semibold tabular-nums text-txt`}>
                      {birr(t.amount)}
                    </td>
                    <td className={tdClass}>
                      {t.transaction_type ? (
                        <span className="text-txt-2">
                          {t.transaction_type}
                          {payId && (
                            <>
                              {" · "}
                              <span className="font-mono text-xs text-txt-3">{payId}</span>
                            </>
                          )}
                        </span>
                      ) : t.reference ? (
                        <span className="font-mono text-xs text-txt-3">{t.reference}</span>
                      ) : (
                        <span className="text-txt-4">—</span>
                      )}
                    </td>
                    <td className={tdClass}>
                      <StatusBadge value={t.status} tone={statusTone(t.status)} />
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-txt-3`}>{date(t.created_at)}</td>
                    <td className={tdClass}>
                      <div className="flex justify-end gap-2">
                        <IconButton icon="eye" title="View details" onClick={() => setDetail(t)} />
                        {t.status === "pending" && t.type === "deposit" && (
                          <>
                            <IconButton
                              icon="check"
                              tone="green"
                              title="Approve"
                              loading={busyId === t.id}
                              onClick={() => approveDeposit(t.id)}
                            />
                            <IconButton
                              icon="x"
                              tone="red"
                              title="Reject"
                              loading={busyId === t.id}
                              onClick={() => act(t.id, api.rejectDeposit, "Reject")}
                            />
                          </>
                        )}
                        {t.status === "pending" && t.type === "withdraw" && (
                          <>
                            <IconButton
                              icon="check"
                              tone="green"
                              title="Approve & pay"
                              loading={busyId === t.id}
                              onClick={() => act(t.id, api.approveWithdrawal, "Approve")}
                            />
                            <IconButton
                              icon="x"
                              tone="red"
                              title="Reject → genuine returns to cash, referral/bonus returns to bonus"
                              loading={busyId === t.id}
                              onClick={() => rollback(t.id)}
                            />
                          </>
                        )}
                        {t.status === "pending" &&
                          t.type !== "deposit" &&
                          t.type !== "withdraw" && (
                            <IconButton
                              icon="stop"
                              tone="red"
                              title="Cancel"
                              loading={busyId === t.id}
                              onClick={() => act(t.id, api.cancelTransaction, "Cancel")}
                            />
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        {active.paginated && ((resultTotal !== undefined && resultTotal > 0) || page > 0 || visible.length === PAGE_SIZE) && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={resultTotal}
            shown={visible.length}
            onPage={setPage}
          />
        )}
      </Card>

      <TransactionDrawer
        tx={detail}
        busy={detail ? busyId === detail.id : false}
        onClose={() => setDetail(null)}
        onAct={(id, fn, label) => {
          act(id, fn, label);
          setDetail(null);
        }}
        onApproveDeposit={(id) => {
          approveDeposit(id);
          setDetail(null);
        }}
        onRollback={rollback}
      />
    </div>
  );
}

function TransactionDrawer({
  tx,
  busy,
  onClose,
  onAct,
  onApproveDeposit,
  onRollback,
}: {
  tx: Transaction | null;
  busy: boolean;
  onClose: () => void;
  onAct: (id: string, fn: (id: string) => Promise<unknown>, label: string) => void;
  onApproveDeposit: (id: string) => void;
  onRollback: (id: string) => void;
}) {
  if (!tx) return null;
  const isIn = tx.type === "deposit" || tx.type === "transfer_in";
  const name = readable(tx.player_name);
  const phone = tx.player_phone;

  const footer =
    tx.status === "pending" ? (
      <div className="flex flex-col gap-2">
        {tx.type === "deposit" && (
          <div className="flex gap-2">
            <Button variant="success" icon="check" loading={busy} className="flex-1" onClick={() => onApproveDeposit(tx.id)}>
              Approve
            </Button>
            <Button variant="danger" icon="x" loading={busy} className="flex-1" onClick={() => onAct(tx.id, api.rejectDeposit, "Reject")}>
              Reject
            </Button>
          </div>
        )}
        {tx.type === "withdraw" && (
          <div className="flex gap-2">
            <Button variant="success" icon="check" loading={busy} className="flex-1" onClick={() => onAct(tx.id, api.approveWithdrawal, "Approve")}>
              Approve & pay
            </Button>
            <Button variant="danger" icon="x" loading={busy} className="flex-1" onClick={() => onRollback(tx.id)}>
              Reject &amp; refund
            </Button>
          </div>
        )}
        {tx.type !== "deposit" && tx.type !== "withdraw" && (
          <Button variant="danger" icon="stop" loading={busy} className="w-full" onClick={() => onAct(tx.id, api.cancelTransaction, "Cancel")}>
            Cancel transaction
          </Button>
        )}
      </div>
    ) : undefined;

  return (
    <Drawer open title="Transaction" subtitle={date(tx.created_at)} onClose={onClose} footer={footer}>
      {/* Amount hero */}
      <div className="mb-4 rounded-lg border border-edgeSoft bg-panel2 p-4 text-center">
        <div className={`text-3xl font-bold tabular-nums ${isIn ? "text-success" : "text-txt"}`}>
          {isIn ? "+" : "−"}
          {birr(tx.amount)}
        </div>
        <div className="mt-2 flex items-center justify-center gap-2">
          <StatusBadge value={tx.category ?? tx.type} tone={statusTone(tx.category ?? tx.type)} />
          <StatusBadge value={tx.status} tone={statusTone(tx.status)} />
        </div>
      </div>

      {/* For a deposit, show the verifier's stored verdict so approval is informed. */}
      {tx.type === "deposit" && tx.transaction_id && <DepositVerdict reference={tx.transaction_id} />}

      {/* For a withdrawal, show whether this player is a genuine winner before paying. */}
      {tx.type === "withdraw" && <PlayerWinBackground userId={tx.user_id} />}

      <DetailRow label="Player">
        <Link to={`/users/${tx.user_id}`} className="inline-flex items-center gap-2 hover:text-brand" onClick={onClose}>
          <Avatar initials={name ? initials(name) : "?"} size={22} />
          {name || phone || shortId(tx.user_id)}
        </Link>
      </DetailRow>
      {phone && <DetailRow label="Phone" mono>{phone}</DetailRow>}
      <DetailRow label="Direction">
        <Badge tone={isIn ? "green" : "neutral"}>{isIn ? "Money in" : "Money out"}</Badge>
      </DetailRow>
      <DetailRow label="Category">{tx.category ?? "—"}</DetailRow>
      <DetailRow label="Ledger type">{tx.type}</DetailRow>
      <DetailRow label="Payment method">{tx.transaction_type ?? "—"}</DetailRow>
      <DetailRow label="Receipt / reference" mono>{tx.transaction_id ?? "—"}</DetailRow>
      <DetailRow label="Internal reference" mono>{tx.reference ?? "—"}</DetailRow>
      <DetailRow label="Created">{date(tx.created_at)}</DetailRow>
      <DetailRow label="Transaction ID" mono>{tx.id}</DetailRow>
    </Drawer>
  );
}

function verdictTone(o: VerificationOutcome): "green" | "red" | "gold" {
  return o === "verified" ? "green" : o === "rejected" ? "red" : "gold";
}

// DepositVerdict shows the verifier's stored verdict for a deposit's receipt
// inside the drawer, so an admin approving a pending deposit sees whether the
// verifier verified it, rejected it, or couldn't judge it — before crediting.
function DepositVerdict({ reference }: { reference: string }) {
  const [log, setLog] = useState<VerificationLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    api
      .verificationLogs({ reference, limit: 1 })
      .then((r) => alive && setLog(r.logs[0] ?? null))
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reference]);

  return (
    <div className="mb-4 rounded-lg border border-edgeSoft bg-panel2 p-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-txt-4">
        Verifier verdict for this receipt
      </div>
      {loading ? (
        <Spinner />
      ) : failed ? (
        <div className="text-sm text-txt-3">Couldn't load the verifier verdict.</div>
      ) : !log ? (
        <div className="text-sm text-txt-3">
          No verifier lookup on record for this receipt. Confirm the payment manually before approving.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <Badge tone={verdictTone(log.outcome)}>
              {log.outcome === "verified" ? "Verified" : log.outcome === "rejected" ? "Rejected" : "Unverified"}
            </Badge>
            {log.amount != null && <span className="tabular-nums text-sm text-txt-2">{birr(log.amount)}</span>}
          </div>
          {log.reason && log.reason !== "ok" && (
            <div className="mt-2 text-sm text-txt-3">{log.reason}</div>
          )}
          {log.outcome === "rejected" && (
            <div className="mt-2 text-xs text-danger">
              The verifier rejected this receipt — approving needs an explicit force-confirm.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// PlayerWinBackground shows a player's lifetime play record inside the withdrawal
// drawer, so an admin can tell at a glance whether the money being withdrawn was
// actually won — or belongs to a farmed / bonus-only account that never played.
function PlayerWinBackground({ userId }: { userId: string }) {
  const [stats, setStats] = useState<UserGameStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    api
      .userGameStats(userId)
      .then((r) => alive && setStats(r.stats))
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userId]);

  return (
    <div className="mb-4 rounded-lg border border-edgeSoft bg-panel2 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-txt-4">
        Player background — did they really win?
      </div>
      {loading ? (
        <Spinner />
      ) : failed ? (
        <div className="text-sm text-txt-3">Couldn't load play history.</div>
      ) : stats ? (
        <>
          {/* Play record */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Games played" value={String(stats.games_played)} />
            <MiniStat label="Games won" value={String(stats.games_won)} highlight={stats.games_won > 0} />
            <MiniStat label="Won by playing" value={birr(stats.total_won)} highlight={stats.total_won > 0} />
          </div>

          {/* Where the money came from — so you can tell a real winner from a
              bonus/referral-funded account. */}
          <div className="mt-3 border-t border-edgeSoft pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-txt-4">
              Where the money came from
            </div>
            <div className="space-y-1.5 text-sm">
              <MoneyRow label="Deposited (real cash in)" value={stats.total_deposited} tone={stats.total_deposited > 0 ? "green" : "muted"} />
              <MoneyRow label="Bonus / referral (play-only)" value={stats.total_bonus} tone={stats.total_bonus > 0 ? "gold" : "muted"} />
              <MoneyRow label="Won by playing" value={stats.total_won} />
              <MoneyRow label="Already withdrawn" value={stats.total_withdrawn} />
              <div className="mt-2 flex items-center justify-between border-t border-edgeSoft pt-2">
                <span className="text-txt-2">Balance now</span>
                <span className="tabular-nums">
                  <span className="font-semibold text-txt">{birr(stats.real_balance)}</span>
                  <span className="text-txt-4"> cash</span>
                  {stats.bonus_balance > 0 && (
                    <span className="text-warning"> · {birr(stats.bonus_balance)} bonus</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Verdict line */}
          <div className="mt-3 text-center">
            {stats.total_deposited === 0 && stats.total_won === 0 ? (
              <Badge tone="red">⚠ No deposits and no wins — balance is bonus/referral only. Verify before paying.</Badge>
            ) : stats.games_won === 0 ? (
              <Badge tone="red">⚠ Never won a game — check the source above before paying.</Badge>
            ) : (
              <Badge tone="green">✓ Real player — has genuine deposits/wins.</Badge>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MoneyRow({ label, value, tone }: { label: string; value: number; tone?: "green" | "gold" | "muted" }) {
  const color =
    tone === "green" ? "text-success" : tone === "gold" ? "text-warning" : tone === "muted" ? "text-txt-4" : "text-txt";
  return (
    <div className="flex items-center justify-between">
      <span className="text-txt-3">{label}</span>
      <span className={`tabular-nums font-medium ${color}`}>{birr(value)}</span>
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-edgeSoft bg-panel p-2.5">
      <div className={`text-lg font-bold tabular-nums ${highlight ? "text-success" : "text-txt"}`}>{value}</div>
      <div className="text-[11px] text-txt-4">{label}</div>
    </div>
  );
}
