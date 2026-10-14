import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { listAuditLogs } from '@club-management/shared';
import { Can } from '../components/Can';
import { usePermission } from '../hooks/usePermission';
import { supabase } from '../lib/supabase';
import {
  auditActionLabel,
  formatAuditDate,
  formatAuditDetails,
  knownAuditActions,
  type AuditLogRow,
} from '../features/audit/types';
import { errorMessage, inputClass } from '../features/clubs/types';

const PAGE_SIZE = 20;

type ActorOption = { id: string; full_name: string; email: string };

export function AuditLogPage() {
  const { allowed, loading: permissionLoading } = usePermission('audit.read');
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [actors, setActors] = useState<ActorOption[]>([]);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const entityTypes = useMemo(
    () => [...new Set(rows.map((row) => row.entity_type))].sort(),
    [rows],
  );

  const loadActors = useCallback(async () => {
    const result = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name');
    if (!result.error) setActors((result.data ?? []) as ActorOption[]);
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listAuditLogs(supabase, {
        action: action || null,
        entityType: entityType || null,
        actor: actor || null,
        from: from ? new Date(from).toISOString() : null,
        to: to ? new Date(to).toISOString() : null,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setRows(data);
      setTotal(data[0]?.total_count ?? 0);
      setExpanded(new Set());
    } catch (loadError) {
      setRows([]);
      setTotal(0);
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [action, actor, entityType, from, page, to]);

  useEffect(() => {
    if (!allowed) return;
    void loadActors();
  }, [allowed, loadActors]);

  useEffect(() => {
    if (allowed) void loadLogs();
  }, [allowed, loadLogs]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(0);
    if (page === 0) void loadLogs();
  }

  function clearFilters() {
    setAction('');
    setEntityType('');
    setActor('');
    setFrom('');
    setTo('');
    setPage(0);
  }

  function toggleDetails(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (permissionLoading) {
    return <div className="rounded-3xl bg-white p-8">Checking permissions…</div>;
  }

  return (
    <Can
      permission="audit.read"
      fallback={
        <section className="rounded-3xl border border-rose-200 bg-pink p-8" role="alert">
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="mt-2">Only admins can view the audit log.</p>
        </section>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold text-slateDark/70">Administration</p>
          <h1 className="mt-1 text-3xl font-bold">Audit Log</h1>
          <p className="mt-2 max-w-3xl text-sm text-slateDark/75">
            Review append-only changes made through the shared Member 1 RPCs.
          </p>
        </div>

        <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={applyFilters}>
            <label className="text-sm font-semibold">
              Action
              <select
                aria-label="Filter by action"
                className={`${inputClass} mt-1`}
                value={action}
                onChange={(event) => setAction(event.target.value)}
              >
                <option value="">All actions</option>
                {knownAuditActions.map((item) => (
                  <option key={item} value={item}>
                    {auditActionLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Entity type
              <select
                aria-label="Filter by entity type"
                className={`${inputClass} mt-1`}
                value={entityType}
                onChange={(event) => setEntityType(event.target.value)}
              >
                <option value="">All entity types</option>
                {entityTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Actor
              <select
                aria-label="Filter by actor"
                className={`${inputClass} mt-1`}
                value={actor}
                onChange={(event) => setActor(event.target.value)}
              >
                <option value="">All actors</option>
                {actors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name || item.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              From
              <input
                aria-label="Filter from date"
                className={`${inputClass} mt-1`}
                type="datetime-local"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold">
              To
              <input
                aria-label="Filter to date"
                className={`${inputClass} mt-1`}
                type="datetime-local"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                className="rounded-xl bg-aqua px-4 py-2.5 text-sm font-bold hover:bg-aqua/80 focus:outline-none focus:ring-4 focus:ring-aqua/45"
                type="submit"
              >
                Apply filters
              </button>
              <button
                className="rounded-xl border border-mutedSlate/40 px-4 py-2.5 text-sm font-bold hover:bg-pink focus:outline-none focus:ring-4 focus:ring-aqua/40"
                onClick={clearFilters}
                type="button"
              >
                Clear
              </button>
            </div>
          </form>
        </section>

        {error && (
          <p
            className="rounded-xl border border-rose-200 bg-pink px-4 py-3 text-sm text-rose-900"
            role="alert"
          >
            {error}
          </p>
        )}

        <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
          {loading ? (
            <p className="text-sm text-slateDark/70">Loading audit entries…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slateDark/70">No audit entries match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-mutedSlate/25 text-xs uppercase tracking-wide text-slateDark/65">
                  <tr>
                    <th className="px-3 py-3">When</th>
                    <th className="px-3 py-3">Actor</th>
                    <th className="px-3 py-3">Action</th>
                    <th className="px-3 py-3">Entity</th>
                    <th className="px-3 py-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const key = `${row.created_at}-${row.entity_id ?? 'none'}-${index}`;
                    const isExpanded = expanded.has(key);
                    return (
                      <tr className="border-b border-mutedSlate/15 last:border-0" key={key}>
                        <td className="whitespace-nowrap px-3 py-4 text-slateDark/75">
                          {formatAuditDate(row.created_at)}
                        </td>
                        <td className="px-3 py-4 font-semibold">{row.actor_name || 'System'}</td>
                        <td className="px-3 py-4">
                          <span className="font-semibold">{auditActionLabel(row.action)}</span>
                          <span className="mt-1 block text-xs text-slateDark/60">{row.action}</span>
                        </td>
                        <td className="px-3 py-4">
                          <span className="font-semibold">{row.entity_type}</span>
                          {row.entity_id && (
                            <span
                              className="mt-1 block max-w-44 truncate text-xs text-slateDark/60"
                              title={row.entity_id}
                            >
                              {row.entity_id}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-4">
                          <button
                            aria-expanded={isExpanded}
                            className="rounded-lg border border-mutedSlate/40 px-3 py-1.5 text-xs font-bold hover:bg-pink focus:outline-none focus:ring-4 focus:ring-aqua/40"
                            onClick={() => toggleDetails(key)}
                            type="button"
                          >
                            {isExpanded ? 'Hide details' : 'View details'}
                          </button>
                          {isExpanded && (
                            <pre className="mt-3 max-w-[28rem] overflow-x-auto rounded-xl bg-lavender p-3 text-xs text-slateDark">
                              {formatAuditDetails(row.details)}
                            </pre>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-mutedSlate/20 pt-4">
            <p className="text-sm text-slateDark/70">
              {total === 0
                ? 'No entries'
                : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-xl border border-mutedSlate/40 px-3 py-2 text-sm font-bold hover:bg-pink focus:outline-none focus:ring-4 focus:ring-aqua/40 disabled:opacity-50"
                disabled={page === 0 || loading}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                type="button"
              >
                Previous
              </button>
              <button
                className="rounded-xl border border-mutedSlate/40 px-3 py-2 text-sm font-bold hover:bg-pink focus:outline-none focus:ring-4 focus:ring-aqua/40 disabled:opacity-50"
                disabled={loading || (page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </Can>
  );
}
