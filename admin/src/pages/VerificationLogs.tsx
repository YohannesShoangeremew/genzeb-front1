import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type VerificationLog, type VerificationOutcome } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
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
  SearchInput,
  Pagination,
  Skeleton,
  ErrorNote,
  EmptyState,
  PageHeader,
  Drawer,
  DetailRow,
} from "@/components/ui";
import { birr, date, initials, shortId } from "@/lib/format";

const PAGE_SIZE = 50;

// Tone for each verdict: verified = good, rejected = hard fail, unavailable =
// couldn't be judged (went to manual review).
function outcomeTone(o: VerificationOutcome): "green" | "red" | "yellow" {
  return o === "verified" ? "green" : o === "rejected" ? "red" : "yellow";
}

function outcomeLabel(o: VerificationOutcome): string {
  return o === "verified" ? "Verified" : o === "rejected" ? "Rejected" : "Unverified";
}

// Pretty-print the raw provider JSON; fall back to the raw string if it isn't JSON.
function prettyRaw(raw: string): string {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function VerificationLogs() {
  const [query, setQuery] = useState("");
  const reference = useDebouncedValue(query.trim(), 350);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<VerificationLog | null>(null);

  useEffect(() => setPage(0), [reference]);

  const { data, loading, error, reload, updatedAt } = usePolling(
    () => api.verificationLogs({ reference, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    [reference, page],
    10000,
  );

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Verification logs"
        subtitle="Payment verification history"
        updatedAt={updatedAt}
        onReload={reload}
      />

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-edgeSoft p-4">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search receipt reference…"
            className="w-full sm:w-80"
          />
          {query && (
            <Button variant="subtle" icon="x" onClick={() => setQuery("")}>
              Clear
            </Button>
          )}
        </div>

        {loading && !data ? (
          <Skeleton />
        ) : error && !data ? (
          <div className="p-4">
            <ErrorNote message={error} onRetry={reload} />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            message={reference ? `No verifier lookups for "${reference}".` : "No verification lookups yet."}
            icon="shield"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={thClass}>When</th>
                <th className={thClass}>Player</th>
                <th className={thClass}>Method</th>
                <th className={thClass}>Reference</th>
                <th className={thClass}>Verdict</th>
                <th className={`${thClass} text-right`}>Amount</th>
                <th className={thClass}>Reason</th>
                <th className={`${thClass} text-right`}>Raw</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const name = l.player_name ?? "";
                return (
                  <tr key={l.id} className={trClass}>
                    <td className={`${tdClass} whitespace-nowrap text-txt-3`}>{date(l.created_at)}</td>
                    <td className={tdClass}>
                      {l.user_id ? (
                        <Link to={`/users/${l.user_id}`} className="flex items-center gap-2.5">
                          <Avatar initials={name ? initials(name) : "?"} size={22} />
                          <span className="min-w-0 truncate font-medium text-txt">
                            {name || l.player_phone || shortId(l.user_id)}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-txt-4">—</span>
                      )}
                    </td>
                    <td className={tdClass}>
                      <Badge tone="neutral">{l.method}</Badge>
                    </td>
                    <td className={`${tdClass} font-mono text-xs text-txt-2`}>{l.reference}</td>
                    <td className={tdClass}>
                      <StatusBadge value={outcomeLabel(l.outcome)} tone={outcomeTone(l.outcome)} />
                    </td>
                    <td className={`${tdClass} text-right tabular-nums text-txt`}>
                      {l.amount != null ? birr(l.amount) : <span className="text-txt-4">—</span>}
                    </td>
                    <td className={`${tdClass} max-w-[22rem] truncate text-txt-3`} title={l.reason}>
                      {l.reason || <span className="text-txt-4">—</span>}
                    </td>
                    <td className={tdClass}>
                      <div className="flex justify-end">
                        <IconButton icon="eye" title="View raw response" onClick={() => setDetail(l)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        {total > 0 && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} shown={logs.length} onPage={setPage} />
        )}
      </Card>

      <VerificationDrawer log={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function VerificationDrawer({
  log,
  onClose,
}: {
  log: VerificationLog | null;
  onClose: () => void;
}) {
  if (!log) return null;
  const name = log.player_name ?? "";

  return (
    <Drawer open title="Verifier lookup" subtitle={date(log.created_at)} onClose={onClose}>
      <div className="mb-4 flex items-center justify-center">
        <StatusBadge value={outcomeLabel(log.outcome)} tone={outcomeTone(log.outcome)} />
      </div>

      {log.outcome === "rejected" && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          The verifier rejected this receipt. Do not credit it unless you have confirmed the payment yourself.
        </div>
      )}
      {log.outcome === "unavailable" && (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          The verifier could not judge this receipt (it went to manual review). Confirm the payment before approving.
        </div>
      )}

      <DetailRow label="Method">{log.method}</DetailRow>
      <DetailRow label="Reference" mono>{log.reference}</DetailRow>
      <DetailRow label="Verified amount">{log.amount != null ? birr(log.amount) : "—"}</DetailRow>
      <DetailRow label="Player">
        {log.user_id ? (
          <Link to={`/users/${log.user_id}`} className="inline-flex items-center gap-2 hover:text-brand" onClick={onClose}>
            <Avatar initials={name ? initials(name) : "?"} size={22} />
            {name || log.player_phone || shortId(log.user_id)}
          </Link>
        ) : (
          "—"
        )}
      </DetailRow>
      <DetailRow label="Reason">{log.reason || "—"}</DetailRow>
      <DetailRow label="When">{date(log.created_at)}</DetailRow>

      <div className="mt-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-txt-4">Raw provider response</div>
        <pre className="max-h-96 overflow-auto rounded-lg border border-edgeSoft bg-panel2 p-3 font-mono text-[12px] leading-relaxed text-txt-2">
          {prettyRaw(log.raw_response) || <span className="text-txt-4">No body captured.</span>}
        </pre>
      </div>
    </Drawer>
  );
}
