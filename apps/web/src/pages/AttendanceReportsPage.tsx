import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Database } from '@club-management/shared';
import { errorMessage } from '../features/clubs/types';
import { formatEventDate, panelClass, secondaryButtonClass } from '../features/events/eventUtils';
import { useManagedClubs } from '../features/events/useManagedClubs';
import { supabase } from '../lib/supabase';

type AttendanceReport =
  Database['public']['Functions']['list_attendance_dashboard']['Returns'][number];

const columns: { key: keyof AttendanceReport; label: string }[] = [
  { key: 'event_title', label: 'Event' },
  { key: 'club_name', label: 'Club' },
  { key: 'starts_at', label: 'Starts' },
  { key: 'event_status', label: 'Event status' },
  { key: 'registered_count', label: 'Registered' },
  { key: 'present_count', label: 'Present' },
  { key: 'absent_count', label: 'Absent' },
  { key: 'excused_count', label: 'Excused' },
  { key: 'unmarked_count', label: 'Unmarked' },
  { key: 'attendance_finalized', label: 'Attendance finalized' },
];

export function AttendanceReportsPage() {
  const { clubs, loading: clubsLoading } = useManagedClubs();
  const [clubId, setClubId] = useState('');
  const [reports, setReports] = useState<AttendanceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const allReports: AttendanceReport[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error: reportError } = await supabase.rpc('list_attendance_dashboard', {
          p_club_id: clubId || null,
          p_limit: 500,
          p_offset: offset,
        });
        if (reportError) throw reportError;
        const page = data ?? [];
        allReports.push(...page);
        hasMore = page.length === 500;
        if (hasMore) offset += page.length;
      }
      setReports(allReports);
    } catch (reportError) {
      setError(errorMessage(reportError));
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () =>
      reports.reduce(
        (summary, report) => ({
          events: summary.events + 1,
          registered: summary.registered + report.registered_count,
          present: summary.present + report.present_count,
          absent: summary.absent + report.absent_count,
          unmarked: summary.unmarked + report.unmarked_count,
        }),
        { events: 0, registered: 0, present: 0, absent: 0, unmarked: 0 },
      ),
    [reports],
  );

  function downloadCsv() {
    const lines = [
      columns.map((column) => csvCell(column.label)).join(','),
      ...reports.map((report) =>
        columns.map((column) => csvCell(reportValue(report[column.key]))).join(','),
      ),
    ];
    downloadFile(lines.join('\r\n'), 'club-attendance-report.csv');
  }

  function printPdf() {
    const popup = window.open('', '_blank');
    if (!popup) {
      setError('Allow pop-ups to print or save the report as a PDF.');
      return;
    }
    popup.opener = null;
    const headings = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
    const body = reports
      .map((report) =>
        `<tr>${columns.map((column) => `<td>${escapeHtml(reportValue(report[column.key]))}</td>`).join('')}</tr>`,
      )
      .join('');
    popup.document.write(
      `<!doctype html><html><head><title>Attendance report</title><style>
        body{font:11px Arial,sans-serif;padding:24px;color:#172033}h1{font-size:20px}
        table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:6px;text-align:left}
        th{background:#eee}@media print{body{padding:0}}
      </style></head><body><h1>Club attendance report</h1>
      <table><thead><tr>${headings}</tr></thead><tbody>${body}</tbody></table>
      <script>window.onload=()=>window.print()</script></body></html>`,
    );
    popup.document.close();
  }

  return (
    <div className="space-y-6">
      <header className={`${panelClass} bg-gradient-to-br from-white to-mint/30`}>
        <p className="text-sm font-bold text-slateDark/65">Club Head workspace</p>
        <h1 className="mt-1 text-3xl font-bold">Attendance dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-slateDark/70">
          Compare event attendance across clubs you manage and download a summary report.
        </p>
      </header>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Summary label="Events" value={totals.events} />
        <Summary label="Registrations" value={totals.registered} />
        <Summary label="Present" value={totals.present} />
        <Summary label="Absent" value={totals.absent} />
        <Summary label="Unmarked" value={totals.unmarked} />
      </div>

      <section aria-labelledby="attendance-report-heading" className={panelClass}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="attendance-report-heading" className="text-xl font-bold">Event reports</h2>
            <p className="mt-1 text-sm text-slateDark/70">
              Counts include active registrations. Unmarked shows students without an attendance
              record.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="attendance-club-filter">Filter by club</label>
            <select
              id="attendance-club-filter"
              className="rounded-xl border border-mutedSlate/50 bg-white px-3 py-2 text-sm"
              disabled={clubsLoading}
              value={clubId}
              onChange={(event) => setClubId(event.target.value)}
            >
              <option value="">All authorized clubs</option>
              {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
            </select>
            <button
              className={secondaryButtonClass}
              disabled={loading || reports.length === 0}
              onClick={downloadCsv}
              type="button"
            >
              Download CSV / Excel
            </button>
            <button
              className={secondaryButtonClass}
              disabled={loading || reports.length === 0}
              onClick={printPdf}
              type="button"
            >
              Print / Save PDF
            </button>
          </div>
        </div>
        {loading ? (
          <p role="status" className="py-8 text-center text-sm text-slateDark/70">
            Loading attendance reports…
          </p>
        ) : reports.length === 0 ? (
          <p className="py-8 text-center text-sm text-slateDark/70">
            No managed events are available for this report.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-lavender text-xs uppercase tracking-wide text-slateDark/70">
                <tr>{columns.map((column) => <th className="px-3 py-3" key={column.key}>{column.label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-mutedSlate/20">
                {reports.map((report) => (
                  <tr key={report.event_id}>
                    {columns.map((column) => (
                      <td className="px-3 py-3" key={column.key}>
                        {column.key === 'starts_at'
                          ? formatEventDate(report.starts_at)
                          : column.key === 'attendance_finalized'
                            ? report.attendance_finalized ? 'Yes' : 'No'
                            : reportValue(report[column.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-mutedSlate/25 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slateDark/70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function reportValue(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value === null || value === undefined ? '' : String(value);
}

function csvCell(value: string) {
  const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

function downloadFile(data: string, fileName: string) {
  const blob = new Blob([`\uFEFF${data}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}
