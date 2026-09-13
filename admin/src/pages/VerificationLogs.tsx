import { useEffect, useState } from "react";
import { api, type VerificationLog } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import {
  Card,
  Table,
  thClass,
  tdClass,
  trClass,
  StatusBadge,
  SearchInput,
  Pagination,
  Skeleton,
  ErrorNote,
  EmptyState,
  PageHeader,
  Badge,
} from "@/components/ui";
import { birr, date, statusTone } from "@/lib/format";

const PAGE = 50;

export function VerificationLogs() {
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const reference = useDebouncedValue(q.trim(), 300);

  const { data, loading, error, reload, updatedAt } = usePolling(
    () => api.verificationLogs({ reference, limit: PAGE, offset }),
    [offset, reference],
    10000
  );

  useEffect(() => setOffset(0), [reference]);

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Verification Logs"
        subtitle="Payment verification history"
        updatedAt={updatedAt}
        onReload={reload}
      />

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-edgeSoft p-4">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search reference number…"
            className="w-full sm:w-80"
          />
          {total > 0 && (
            <span className="ml-auto text-sm text-txt-3">
              {total.toLocaleString()} record{total === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {loading && !data ? (
          <Skeleton />
        ) : error && !data ? (
          <div className="p-4">
            <ErrorNote message={error} onRetry={reload} />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState message="No verification logs found." icon="transactions" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={thClass}>Reference</th>
                <th className={thClass}>Player</th>
                <th className={thClass}>Method</th>
                <th className={thClass}>Outcome</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={thClass}>Reason / Note</th>
                <th className={thClass}>When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: VerificationLog) => (
                <tr key={log.id} className={trClass}>
                  <td className={`${tdClass} font-mono text-xs font-semibold text-txt`}>
                    {log.reference || "—"}
                  </td>
                  <td className={tdClass}>
                    <div className="text-sm font-medium text-txt">
                      {log.player_name || "—"}
                    </div>
                    {log.player_phone && (
                      <div className="text-xs text-txt-3 tabular-nums">{log.player_phone}</div>
                    )}
                  </td>
                  <td className={tdClass}>
                    <Badge tone="neutral">{log.method}</Badge>
                  </td>
                  <td className={tdClass}>
                    <StatusBadge
                      value={log.outcome}
                      tone={statusTone(log.outcome)}
                    />
                  </td>
                  <td className={`${tdClass} text-right font-semibold tabular-nums text-txt`}>
                    {log.amount != null ? birr(log.amount) : "—"}
                  </td>
                  <td className={`${tdClass} max-w-xs truncate text-xs text-txt-3`}>
                    {log.reason || log.raw_response || "—"}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-txt-3`}>
                    {date(log.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {total > 0 && (
          <Pagination
            page={Math.floor(offset / PAGE)}
            pageSize={PAGE}
            total={total}
            shown={logs.length}
            onPage={(p) => setOffset(p * PAGE)}
          />
        )}
      </Card>
    </div>
  );
}