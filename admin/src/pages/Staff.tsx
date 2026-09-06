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
  IconButton,
  Skeleton,
  ErrorNote,
  EmptyState,
  PageHeader,
  SearchInput,
  Pagination,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm";
import { birr, date, fullName, initials } from "@/lib/format";

export function Staff() {
  const pageSize = 25;
  const [q, setQ] = useState("");
  const search = useDebouncedValue(q.trim(), 300);
  const [page, setPage] = useState(0);
  const { data, loading, error, reload, updatedAt } = usePolling(
    () => api.users({ limit: pageSize, offset: page * pageSize, search, role: "admin" }),
    [page, search],
    15000,
  );
  const push = useToast((s) => s.push);
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const visible = data?.users ?? [];
  const total = data?.count ?? 0;

  useEffect(() => setPage(0), [search]);

  const demote = async (id: string) => {
    if (
      !(await confirm({
        title: "Demote to player?",
        message: "This admin will lose dashboard access.",
        confirmLabel: "Demote",
        danger: true,
      }))
    )
      return;
    setBusyId(id);
    try {
      await api.setRole(id, "user");
      push("Demoted to user", "success");
      reload();
    } catch (e) {
      push(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Dashboard access"
        updatedAt={updatedAt}
        onReload={reload}
      />

      <Card className="p-0">
        <div className="border-b border-edgeSoft p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Search staff…" className="w-full sm:w-80" />
        </div>
        {loading && !data ? (
          <Skeleton />
        ) : error && !data ? (
          <div className="p-4">
            <ErrorNote message={error} onRetry={reload} />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState message="No admins found." icon="staff" />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={thClass}>Admin</th>
                <th className={thClass}>Telegram ID</th>
                <th className={thClass}>Phone</th>
                <th className={`${thClass} text-right`}>Balance</th>
                <th className={thClass}>Joined</th>
                <th className={`${thClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id} className={trClass}>
                  <td className={tdClass}>
                    <div className="flex items-center gap-3">
                      <Avatar initials={initials(u.first_name, u.last_name)} />
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-txt">{fullName(u.first_name, u.last_name)}</span>
                        {u.banned && <Badge tone="red">banned</Badge>}
                      </div>
                    </div>
                  </td>
                  <td className={`${tdClass} tabular-nums text-txt-2`}>{u.telegram_id}</td>
                  <td className={`${tdClass} tabular-nums text-txt-2`}>
                    {u.phone_number || <span className="text-txt-4">—</span>}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums font-semibold text-txt`}>
                    {birr(u.wallet?.balance)}
                  </td>
                  <td className={`${tdClass} text-txt-2`}>{date(u.created_at)}</td>
                  <td className={`${tdClass} text-right`}>
                    <div className="flex justify-end gap-2">
                      <IconButton
                        icon="eye"
                        title="View"
                        onClick={() => navigate(`/users/${u.id}`)}
                      />
                      <IconButton
                        icon="ban"
                        tone="red"
                        title="Demote to player"
                        loading={busyId === u.id}
                        onClick={() => demote(u.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {total > 0 && (
          <Pagination page={page} pageSize={pageSize} total={total} shown={visible.length} onPage={setPage} />
        )}
      </Card>

    </div>
  );
}
