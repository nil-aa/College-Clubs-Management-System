import { useCallback, useEffect, useMemo, useState } from 'react';
import { approveOdSheet, getFacultyOdSheet, listFacultyOdSheets } from '../features/api/events';
import { apiErrorMessage } from '../features/api/client';
import {
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../features/events/eventUtils';
import {
  downloadOdSheetCsv,
  odSheetColumns,
  printOdSheetPdf,
  type OdSheetStudentView,
  type OdSheetView,
} from '../features/events/odSheetExport';
import { useRole } from '../hooks/usePermission';

type ReviewSheet = OdSheetView & {
  event_id: string;
  event_title?: string;
  club_name?: string;
  created_at: string;
  closed_at: string | null;
  approved_at: string | null;
};
type ReviewStudent = OdSheetStudentView & { student_id: string };

export function FacultyOdReviewPage() {
  const { allowed, loading: permissionLoading } = useRole('faculty_coordinator');
  const [sheets, setSheets] = useState<ReviewSheet[]>([]);
  const [selected, setSelected] = useState<ReviewSheet | null>(null);
  const [students, setStudents] = useState<ReviewStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSheets((await listFacultyOdSheets()) as ReviewSheet[]);
    } catch (loadError) {
      setError(apiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function openSheet(id: string) {
    const result = await getFacultyOdSheet(id);
    setSelected(result.sheet as ReviewSheet);
    setStudents((result.students ?? []) as ReviewStudent[]);
  }

  async function approve() {
    if (!selected || selected.status !== 'CLOSED') return;
    if (!window.confirm(`Approve the OD participation list “${selected.title}”?`)) return;
    setWorking(true);
    setError('');
    setMessage('');
    try {
      await approveOdSheet(selected.id);
      await refresh();
      await openSheet(selected.id);
      setMessage('List approved. The downloadable OD sheet is now available.');
    } catch (approveError) {
      setError(apiErrorMessage(approveError));
    } finally {
      setWorking(false);
    }
  }

  const columns = useMemo(() => (selected ? odSheetColumns(selected) : []), [selected]);

  function downloadCsv() {
    if (selected?.status === 'APPROVED') downloadOdSheetCsv(selected, students);
  }
  function downloadPdf() {
    if (selected?.status !== 'APPROVED') return;
    if (!printOdSheetPdf(selected, students))
      setError('Allow pop-ups to print or save this OD sheet as a PDF.');
  }

  if (permissionLoading)
    return <div className={panelClass}>Checking Faculty Coordinator access…</div>;
  if (!allowed)
    return (
      <section className={panelClass} role="alert">
        <h1 className="text-2xl font-bold">Faculty access required</h1>
        <p className="mt-2 text-sm text-slateDark/70">
          This page is available to Faculty Coordinators with an active club assignment.
        </p>
      </section>
    );

  return (
    <div className="space-y-6">
      <header className={panelClass}>
        <p className="text-sm font-bold text-slateDark/65">Faculty Coordinator</p>
        <h1 className="mt-1 text-3xl font-bold">OD participation review</h1>
        <p className="mt-2 max-w-3xl text-sm text-slateDark/70">
          Review participant details for your assigned clubs. Approval publishes the downloadable OD
          list.
        </p>
      </header>
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-mint p-4 text-sm">
          {message}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <section className={panelClass}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold">Review queue</h2>
            <button
              className={secondaryButtonClass}
              disabled={loading}
              onClick={() => void refresh()}
              type="button"
            >
              Refresh
            </button>
          </div>
          {loading ? (
            <p className="mt-4 text-sm">Loading review queue…</p>
          ) : sheets.length === 0 ? (
            <p className="mt-4 text-sm text-slateDark/70">
              No closed participation lists are waiting for review.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-mutedSlate/20">
              {sheets.map((sheet) => (
                <li key={sheet.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="font-bold">{sheet.title}</p>
                    <p className="mt-1 text-xs text-slateDark/65">
                      {sheet.club_name ?? 'Club'} · {sheet.event_title ?? 'Event'}
                    </p>
                    <p className="mt-1 text-xs font-semibold">
                      {sheet.status === 'APPROVED' ? 'Approved' : 'Awaiting your review'}
                    </p>
                  </div>
                  <button
                    className={secondaryButtonClass}
                    disabled={working}
                    onClick={() =>
                      void openSheet(sheet.id).catch((loadError) =>
                        setError(apiErrorMessage(loadError)),
                      )
                    }
                    type="button"
                  >
                    Review
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={panelClass}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Participation list</h2>
              <p className="mt-1 text-sm text-slateDark/70">
                {selected?.title ?? 'Choose a list from the review queue.'}
              </p>
            </div>
            {selected && (
              <div className="flex flex-wrap gap-2">
                {selected.status === 'CLOSED' ? (
                  <button
                    className={primaryButtonClass}
                    disabled={working}
                    onClick={() => void approve()}
                    type="button"
                  >
                    {working ? 'Approving…' : 'Approve OD list'}
                  </button>
                ) : (
                  <>
                    <button className={secondaryButtonClass} onClick={downloadCsv} type="button">
                      Download CSV / Excel
                    </button>
                    <button className={primaryButtonClass} onClick={downloadPdf} type="button">
                      Print / Save PDF
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          {selected && (
            <>
              <p className="mt-3 rounded-lg bg-lavender px-3 py-2 text-sm">
                {selected.status === 'APPROVED'
                  ? 'Approved OD list · downloads enabled'
                  : 'Closed participation list · approval enables downloads'}
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-lavender text-xs uppercase tracking-wide">
                    <tr>
                      {columns.map((column) => (
                        <th className="px-3 py-2" key={column.key}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mutedSlate/20">
                    {students.map((student) => (
                      <tr key={student.id}>
                        {columns.map((column) => (
                          <td className="px-3 py-2" key={column.key}>
                            {column.read(student)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {students.length === 0 && (
                  <p className="p-4 text-sm text-slateDark/70">
                    No present participants were included in this sheet.
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
