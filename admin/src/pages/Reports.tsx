import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type SupportCategory, type SupportReport, type SupportStatus } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import {
  Card,
  Button,
  Tabs,
  Badge,
  StatusBadge,
  Skeleton,
  ErrorNote,
  EmptyState,
  PageHeader,
  Pagination,
  SearchInput,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { date, fullName, shortId, statusTone } from "@/lib/format";

type TabKey = "open" | "resolved" | "all";

const TABS: { key: TabKey; label: string; status?: SupportStatus }[] = [
  { key: "open", label: "Open", status: "open" },
  { key: "resolved", label: "Resolved", status: "resolved" },
  { key: "all", label: "All" },
];

const CATEGORY_META: Record<SupportCategory, { label: string; tone: string }> = {
  transaction: { label: "Transaction", tone: "purple" },
  gameplay: { label: "Gameplay", tone: "blue" },
  other: { label: "Other", tone: "neutral" },
};

export function Reports() {
  const [tab, setTab] = useState<TabKey>("open");
  const [resolving, setResolving] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const search = useDebouncedValue(q.trim(), 300);
  const push = useToast((s) => s.push);

  const active = TABS.find((t) => t.key === tab)!;
  const PAGE = 50;
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [tab, search]);
  const { data, loading, error, reload, updatedAt } = usePolling(
    () => api.reports(active.status, PAGE, page * PAGE, search),
    [tab, page, search],
    12000,
  );
  const total = data?.count ?? 0;

  async function resolve(r: SupportReport) {
    setResolving(r.id);
    try {
      await api.resolveReport(r.id);
      push("Report marked resolved", "success");
      reload();
    } catch (e) {
      push(e instanceof Error ? e.message : "Failed to resolve", "error");
    } finally {
      setResolving(null);
    }
  }

  const visible = data?.reports ?? [];
  const link = "text-txt-3 transition hover:text-brand";

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Player support"
        updatedAt={updatedAt}
        onReload={reload}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        <SearchInput value={q} onChange={setQ} placeholder="Search reports…" className="w-full sm:ml-auto sm:w-72" />
      </div>

      {loading && !data ? (
        <Card className="p-0">
          <Skeleton />
        </Card>
      ) : error && !data ? (
        <ErrorNote message={error} onRetry={reload} />
      ) : visible.length === 0 ? (
        <Card className="p-0">
          <EmptyState message={tab === "open" ? "No open reports — all clear." : "No reports here."} icon="reports" />
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const cat = CATEGORY_META[r.category] ?? CATEGORY_META.other;
            return (
              <Card key={r.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={cat.tone}>{cat.label}</Badge>
                  <StatusBadge value={r.status} tone={statusTone(r.status)} />
                  <span className="text-xs text-txt-3">{date(r.created_at)}</span>
                </div>

                <p className="whitespace-pre-wrap break-words text-sm text-txt">{r.message}</p>

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-txt-3">
                    <Link to={`/users/${r.user_id}`} className={link}>
                      {fullName(r.reporter_first_name, r.reporter_last_name) || shortId(r.user_id)}
                    </Link>
                    {r.reporter_phone && <span className="tabular-nums">{r.reporter_phone}</span>}
                    {r.reporter_telegram_id ? (
                      <a href={`tg://user?id=${r.reporter_telegram_id}`} className={link}>
                        Telegram
                      </a>
                    ) : null}
                    {r.game_id && (
                      <Link to={`/games/${r.game_id}`} className={link}>
                        Game {shortId(r.game_id)}
                      </Link>
                    )}
                  </div>
                  {r.status === "open" && (
                    <Button
                      variant="success"
                      icon="check"
                      loading={resolving === r.id}
                      onClick={() => resolve(r)}
                    >
                      Mark resolved
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
          {total > 0 && (
            <Card className="p-0">
              <Pagination page={page} pageSize={PAGE} total={total} onPage={setPage} shown={visible.length} />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
