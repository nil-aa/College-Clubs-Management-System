import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { closeOdSheet, generateOdSheet, getOdSheet, listOdSheets } from '../features/api/events';
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

type AttendanceSession = {
  id: string;
  event_id: string;
  finalized_at: string | null;
  title: string;
};
type OdSheet = OdSheetView & {
  event_id: string;
  created_at: string;
  closed_at: string | null;
  approved_at: string | null;
};
type OdSheetStudent = OdSheetStudentView & { student_id: string };
type EventSummary = { event_id: string; title: string };
type FieldOption = { value: string; label: string };

const studentOptions: FieldOption[] = [
  { value: 'full_name', label: 'Full name' },
  { value: 'roll_number', label: 'Register number' },
  { value: 'department', label: 'Department' },
  { value: 'year_of_study', label: 'Year of study' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
];

const eventOptions: FieldOption[] = [
  { value: 'title', label: 'Event name' },
  { value: 'club_name', label: 'Club' },
  { value: 'start_time', label: 'Event date and time' },
  { value: 'end_time', label: 'Event end time' },
  { value: 'venue', label: 'Venue' },
  { value: 'category', label: 'Category' },
  { value: 'registration_deadline', label: 'Registration deadline' },
  { value: 'description', label: 'Description' },
];

export function OdSheetsPage() {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [events, setEvents] = useState<Map<string, EventSummary>>(new Map());
  const [sheets, setSheets] = useState<OdSheet[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedStudentFields, setSelectedStudentFields] = useState([
    'full_name',
    'roll_number',
    'department',
    'year_of_study',
  ]);
  const [selectedEventFields, setSelectedEventFields] = useState([
    'title',
    'club_name',
    'start_time',
    'venue',
  ]);
  const [title, setTitle] = useState('');
  const [selectedSheet, setSelectedSheet] = useState<OdSheet | null>(null);
  const [students, setStudents] = useState<OdSheetStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listOdSheets();
      const nextSessions = (result.sessions ?? []) as AttendanceSession[];
      setSessions(nextSessions);
      setSheets((result.sheets ?? []) as OdSheet[]);
      setEvents(
        new Map(
          nextSessions.map((session) => [
            session.event_id,
            { event_id: session.event_id, title: session.title },
          ]),
        ),
      );
    } catch (loadError) {
      setError(apiErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedSession = sessions.find((session) => session.event_id === selectedEventId);
  const selectedEvent = selectedEventId ? events.get(selectedEventId) : undefined;

  function chooseEvent(eventId: string) {
    setSelectedEventId(eventId);
    const selected = events.get(eventId);
    setTitle(selected ? `OD - ${selected.title}` : '');
  }

  async function generate() {
    if (!selectedEventId || !title.trim() || !selectedStudentFields.length) return;
    setWorking(true);
    setError('');
    setMessage('');
    try {
      const data = await generateOdSheet(selectedEventId, {
        title,
        student_fields: selectedStudentFields,
        event_fields: selectedEventFields,
      });
      await refresh();
      await openSheet(data.id);
      setMessage('Participation list generated. Close it when it is ready for faculty review.');
    } catch (generateError) {
      setError(apiErrorMessage(generateError));
    } finally {
      setWorking(false);
    }
  }

  async function openSheet(sheetId: string) {
    const result = await getOdSheet(sheetId);
    setSelectedSheet(result.sheet as OdSheet);
    setStudents((result.students ?? []) as OdSheetStudent[]);
  }

  const columns = useMemo(
    () => (selectedSheet ? odSheetColumns(selectedSheet) : []),
    [selectedSheet],
  );

  async function closeParticipationList() {
    if (!selectedSheet || selectedSheet.status !== 'OPEN') return;
    if (!window.confirm('Close this participation list and send it for faculty review?')) return;
    setWorking(true);
    setError('');
    setMessage('');
    try {
      await closeOdSheet(selectedSheet.id);
      await refresh();
      await openSheet(selectedSheet.id);
      setMessage('Participation list closed and sent for faculty review.');
    } catch (closeError) {
      setError(apiErrorMessage(closeError));
    } finally {
      setWorking(false);
    }
  }

  function downloadCsv() {
    if (!selectedSheet || selectedSheet.status !== 'APPROVED') return;
    downloadOdSheetCsv(selectedSheet, students);
  }

  function printPdf() {
    if (!selectedSheet || selectedSheet.status !== 'APPROVED') return;
    if (!printOdSheetPdf(selectedSheet, students)) {
      setError('Allow pop-ups to print or save this OD sheet as a PDF.');
    }
  }

  return (
    <div className="space-y-6">
      <header className={panelClass}>
        <p className="text-sm font-bold text-slateDark/65">Club Head event operations</p>
        <h1 className="mt-1 text-3xl font-bold">Participation lists & OD sheets</h1>
        <p className="mt-2 max-w-3xl text-sm text-slateDark/70">
          Generate a viewable participation list from finalized attendance. Close it for faculty
          review; downloads become available after approval.
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

      <section aria-labelledby="generate-od-heading" className={panelClass}>
        <h2 id="generate-od-heading" className="text-xl font-bold">
          Generate a sheet
        </h2>
        {loading ? (
          <p role="status" className="mt-4 text-sm text-slateDark/70">
            Loading finalized events…
          </p>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <label className="block text-sm font-semibold">
                Finalized event
                <select
                  className="mt-1 w-full rounded-xl border border-mutedSlate/50 bg-white px-3 py-2.5"
                  value={selectedEventId}
                  onChange={(event) => chooseEvent(event.target.value)}
                >
                  <option value="">Select event</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.event_id}>
                      {events.get(session.event_id)?.title ?? session.event_id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                OD sheet title
                <input
                  className="mt-1 w-full rounded-xl border border-mutedSlate/50 px-3 py-2.5"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <FieldPicker
                title="Student details"
                options={studentOptions}
                selected={selectedStudentFields}
                onChange={setSelectedStudentFields}
              />
              <FieldPicker
                title="Event details"
                options={eventOptions}
                selected={selectedEventFields}
                onChange={setSelectedEventFields}
              />
              <button
                className={primaryButtonClass}
                disabled={
                  working || !selectedSession || !title.trim() || !selectedStudentFields.length
                }
                onClick={() => void generate()}
                type="button"
              >
                {working ? 'Generating…' : 'Generate OD sheet'}
              </button>
            </div>
            <aside className="rounded-2xl bg-lavender p-4 text-sm text-slateDark/75">
              <p className="font-bold text-slateDark">Snapshot rules</p>
              <p className="mt-2">
                Only students marked present are copied. Student and event values are saved with the
                sheet, so later profile or event changes won’t alter an existing export.
              </p>
              {selectedEvent && <p className="mt-3 font-semibold">{selectedEvent.title}</p>}
              {selectedSession?.finalized_at && (
                <p className="mt-1 text-xs">
                  Finalized {new Date(selectedSession.finalized_at).toLocaleString()}.
                </p>
              )}
            </aside>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <section className={panelClass}>
          <h2 className="text-xl font-bold">Generated sheets</h2>
          {sheets.length === 0 ? (
            <p className="mt-4 text-sm text-slateDark/70">No OD sheets generated yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-mutedSlate/20">
              {sheets.map((sheet) => (
                <li key={sheet.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="font-bold">{sheet.title}</p>
                    <p className="mt-1 text-xs text-slateDark/65">
                      {new Date(sheet.created_at).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slateDark/70">
                      {sheet.status === 'APPROVED'
                        ? 'Approved OD list'
                        : sheet.status === 'CLOSED'
                          ? 'Awaiting faculty approval'
                          : 'Participation list — open'}
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
                    Open
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={panelClass}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Preview & download</h2>
              <p className="mt-1 text-sm text-slateDark/70">
                {selectedSheet?.title ?? 'Choose a generated sheet to preview.'}
              </p>
            </div>
            {selectedSheet && (
              <div className="flex flex-wrap gap-2">
                {selectedSheet.status === 'OPEN' && (
                  <button
                    className={primaryButtonClass}
                    disabled={working}
                    onClick={() => void closeParticipationList()}
                    type="button"
                  >
                    {working ? 'Closing…' : 'Close for faculty review'}
                  </button>
                )}
                {selectedSheet.status === 'APPROVED' ? (
                  <>
                    <button className={secondaryButtonClass} onClick={downloadCsv} type="button">
                      Download CSV / Excel
                    </button>
                    <button className={primaryButtonClass} onClick={printPdf} type="button">
                      Print / Save PDF
                    </button>
                  </>
                ) : (
                  <span className="self-center text-sm font-semibold text-slateDark/65">
                    {selectedSheet.status === 'CLOSED'
                      ? 'This list is with the faculty reviewer. Downloads are locked.'
                      : 'This is a participation list. Close it before faculty review; downloads are locked until approval.'}
                  </span>
                )}
              </div>
            )}
          </div>
          {selectedSheet && (
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
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FieldPicker({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: FieldOption[];
  selected: string[];
  onChange: Dispatch<SetStateAction<string[]>>;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-bold">{title}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label className="flex items-center gap-2 text-sm" key={option.value}>
            <input
              checked={selected.includes(option.value)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, option.value]
                    : selected.filter((field) => field !== option.value),
                )
              }
              type="checkbox"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
