import { useEffect, useState } from "react";
import { api, type PromoCode } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import {
  Card,
  Button,
  Input,
  Table,
  thClass,
  tdClass,
  trClass,
  StatusBadge,
  Badge,
  IconButton,
  Skeleton,
  ErrorNote,
  EmptyState,
  PageHeader,
  SearchInput,
  Pagination,
} from "@/components/ui";
import { birr, date } from "@/lib/format";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm";

export function PromoCodes() {
  const { data, loading, error, reload, updatedAt } = usePolling(() => api.promoCodes(), [], 15000);
  const push = useToast((s) => s.push);
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const codes = data?.promos ?? [];
  const term = q.trim().toLowerCase();
  const filtered = term
    ? codes.filter((promo) =>
        [promo.code, promo.active ? "active" : "inactive"].join(" ").toLowerCase().includes(term),
      )
    : codes;
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => setPage(0), [q]);

  const toggle = async (p: PromoCode) => {
    const turningOff = p.active;
    if (
      turningOff &&
      !(await confirm({
        title: `Deactivate ${p.code}?`,
        message: "Players will no longer be able to redeem this code.",
        confirmLabel: "Deactivate",
        danger: true,
      }))
    )
      return;
    setBusy(p.code);
    try {
      if (turningOff) await api.deactivatePromoCode(p.code);
      else await api.activatePromoCode(p.code);
      push(`${p.code} ${turningOff ? "deactivated" : "activated"}`, "success");
      reload();
    } catch (e) {
      push(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Promo codes"
        subtitle="Redemption codes"
        updatedAt={updatedAt}
        onReload={reload}
        actions={
          <Button icon={showForm ? "x" : "plus"} onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Close" : "New code"}
          </Button>
        }
      />

      {showForm && <CreateForm onDone={() => { setShowForm(false); reload(); }} />}

      <Card className="p-0">
        <div className="border-b border-edgeSoft p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Search promo codes…" className="w-full sm:w-80" />
        </div>
        {loading && !data ? (
          <Skeleton />
        ) : error && !data ? (
          <div className="p-4">
            <ErrorNote message={error} onRetry={reload} />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState message="No promo codes yet. Create one to get started." icon="promo" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={thClass}>Code</th>
                <th className={thClass}>Bonus</th>
                <th className={thClass}>Redeemed</th>
                <th className={thClass}>Expires</th>
                <th className={thClass}>Status</th>
                <th className={`${thClass} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.code} className={trClass}>
                  <td className={tdClass}>
                    <span className="font-mono text-sm font-semibold tracking-wide text-txt">{p.code}</span>
                  </td>
                  <td className={tdClass}>
                    <span className="font-semibold text-brand">{birr(p.bonus_amount)}</span>
                  </td>
                  <td className={`${tdClass} tabular-nums text-txt-2`}>
                    {p.redeemed_count}
                    <span className="text-txt-4"> / {p.max_redemptions ?? "∞"}</span>
                  </td>
                  <td className={`${tdClass} text-txt-2`}>
                    {p.expires_at ? date(p.expires_at) : <Badge>never</Badge>}
                  </td>
                  <td className={tdClass}>
                    <StatusBadge
                      value={p.active ? "Active" : "Inactive"}
                      tone={p.active ? "green" : "neutral"}
                    />
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <IconButton
                      icon={p.active ? "stop" : "check"}
                      tone={p.active ? "red" : "green"}
                      title={p.active ? "Deactivate" : "Activate"}
                      loading={busy === p.code}
                      onClick={() => toggle(p)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {filtered.length > 0 && (
          <Pagination page={page} pageSize={pageSize} total={filtered.length} shown={visible.length} onPage={setPage} />
        )}
      </Card>
    </div>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const push = useToast((s) => s.push);
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [maxR, setMaxR] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const amt = Number(amount);
    if (code.trim().length < 3) return push("Code must be at least 3 characters", "error");
    if (!Number.isFinite(amt) || amt <= 0) return push("Enter a bonus amount greater than 0", "error");
    const max = maxR.trim() ? Number(maxR) : null;
    if (max !== null && (!Number.isInteger(max) || max <= 0)) return push("Max redemptions must be a whole number", "error");
    setBusy(true);
    try {
      await api.createPromoCode({
        code: code.trim().toUpperCase(),
        bonus_amount: amt,
        max_redemptions: max,
        expires_at: expiry ? new Date(expiry).toISOString() : null,
      });
      push(`Created ${code.trim().toUpperCase()}`, "success");
      onDone();
    } catch (e) {
      push(e instanceof Error ? e.message : "Could not create code", "error");
    } finally {
      setBusy(false);
    }
  };

  const label = "mb-1.5 block text-xs font-medium text-txt-3";
  return (
    <Card className="mb-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={label}>Code</label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="WELCOME50" className="font-mono uppercase" />
        </div>
        <div>
          <label className={label}>Bonus (birr)</label>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50" />
        </div>
        <div>
          <label className={label}>Max redemptions</label>
          <Input type="number" min={1} value={maxR} onChange={(e) => setMaxR(e.target.value)} placeholder="unlimited" />
        </div>
        <div>
          <label className={label}>Expires</label>
          <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button icon="plus" loading={busy} onClick={submit}>
          Create code
        </Button>
      </div>
    </Card>
  );
}
