import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import {
  Card,
  Table,
  thClass,
  tdClass,
  trClass,
  Avatar,
  Badge,
  StatusBadge,
  IconButton,
  SearchInput,
  Pagination,
  Skeleton,
  ErrorNote,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { birr, date, fullName, initials } from "@/lib/format";

const PAGE = 50;

export function Users() {
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const search = useDebouncedValue(q.trim(), 300);
  const navigate = useNavigate();
  const { data, loading, error, reload, updatedAt } = usePolling(
    () => api.users({ limit: PAGE, offset, search }),
    [offset, search],
    10000,
  );

  useEffect(() => setOffset(0), [search]);

  const visible = data?.users ?? [];
  const total = data?.count ?? 0;

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Player accounts"
        updatedAt={updatedAt}
        onReload={reload}
      />

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-edgeSoft p-4">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Search name, phone, Telegram ID…"
            className="w-full sm:w-80"
          />
          {total > 0 && (
            <span className="ml-auto text-sm text-txt-3">
              {total.toLocaleString()} player{total === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {loading && !data ? (
          <Skeleton />
        ) : error && !data ? (
          <div className="p-4">
            <ErrorNote message={error} onRetry={reload} />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState message="No users found." icon="users" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={thClass}>Player</th>
                <th className={thClass}>Telegram ID</th>
                <th className={thClass}>Phone</th>
                <th className={`${thClass} text-right`}>Balance</th>
                <th className={thClass}>Role</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Joined</th>
                <th className={`${thClass} text-right`}>View</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => navigate(`/users/${u.id}`)}
                  className={`cursor-pointer ${trClass}`}
                >
                  <td className={tdClass}>
                    <div className="flex items-center gap-3">
                      <Avatar initials={initials(u.first_name, u.last_name)} />
                      <span className="font-medium text-txt">
                        {fullName(u.first_name, u.last_name) || "—"}
                      </span>
                    </div>
                  </td>
                  <td className={`${tdClass} tabular-nums text-txt-3`}>{u.telegram_id}</td>
                  <td className={`${tdClass} tabular-nums text-txt-2`}>
                    {u.phone_number || <span className="text-txt-4">—</span>}
                  </td>
                  <td className={`${tdClass} text-right font-semibold tabular-nums text-txt`}>
                    {birr(u.wallet?.balance)}
                  </td>
                  <td className={tdClass}>
                    <Badge tone={u.role === "admin" ? "gold" : "neutral"}>{u.role}</Badge>
                  </td>
                  <td className={tdClass}>
                    <StatusBadge value={u.banned ? "Banned" : "Active"} tone={u.banned ? "red" : "green"} />
                  </td>
                  <td className={`${tdClass} text-txt-3`}>{date(u.created_at)}</td>
                  <td className={`${tdClass} text-right`} onClick={(e) => e.stopPropagation()}>
                    <IconButton icon="eye" title="View player" onClick={() => navigate(`/users/${u.id}`)} />
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
            shown={visible.length}
            onPage={(p) => setOffset(p * PAGE)}
          />
        )}
      </Card>
    </div>
  );
}
