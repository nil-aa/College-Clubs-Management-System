import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Database, Json } from '@club-management/shared';
import { errorMessage } from '../features/clubs/types';
import { panelClass, primaryButtonClass, secondaryButtonClass } from '../features/events/eventUtils';
import { supabase } from '../lib/supabase';

type AttendanceSession = Database['public']['Tables']['event_attendance_sessions']['Row'];
type OdSheet = Database['public']['Tables']['od_sheets']['Row'];
type OdSheetStudent = Database['public']['Tables']['od_sheet_students']['Row'];
type EventSummary = Pick<Database['public']['Tables']['events']['Row'], 'event_id' | 'title'>;
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
      const [sessionResult, sheetResult] = await Promise.all([
        supabase
          .from('event_attendance_sessions')
          .select('*')
          .eq('status', 'FINALIZED')
          .order('finalized_at', { ascending: false }),
        supabase.from('od_sheets').select('*').order('created_at', { ascending: false }),
      ]);
      if (sessionResult.error) throw sessionResult.error;
      if (sheetResult.error) throw sheetResult.error;

      const nextSessions = sessionResult.data ?? [];
      setSessions(nextSessions);
      setSheets(sheetResult.data ?? []);
      const eventIds = [...new Set(nextSessions.map((session) => session.event_id))];
      if (eventIds.length) {
        const eventResult = await supabase
          .from('events')
          .select('event_id, title')
          .in('event_id', eventIds);
        if (eventResult.error) throw eventResult.error;
        setEvents(new Map((eventResult.data ?? []).map((event) => [event.event_id, event])));
      } else {
        setEvents(new Map());
      }
    } catch (loadError) {
      setError(errorMessage(loadError));
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
      const { data, error: generateError } = await supabase.rpc('generate_od_sheet', {
        p_event_id: selectedEventId,
        p_title: title,
        p_student_fields: selectedStudentFields,
        p_event_fields: selectedEventFields,
      });
      if (generateError) throw generateError;
      await refresh();
      await openSheet(data);
      setMessage('OD sheet generated from finalized present attendance.');
    } catch (generateError) {
      setError(errorMessage(generateError));
    } finally {
      setWorking(false);
    }
  }

  async function openSheet(sheetId: string) {
    const sheet = sheets.find((item) => item.id === sheetId);
    const { data, error: studentError } = await supabase
      .from('od_sheet_students')
      .select('*')
      .eq('od_sheet_id', sheetId)
      .order('created_at');
    if (studentError) throw studentError;
    if (sheet) setSelectedSheet(sheet);
    else {
      const { data: sheetData, error: sheetError } = await supabase
        .from('od_sheets')
        .select('*')
        .eq('id', sheetId)
        .single();
      if (sheetError) throw sheetError;
      setSelectedSheet(sheetData);
    }
    setStudents(data ?? []);
  }

  const columns = useMemo(() => {
    if (!selectedSheet) return [];
    return [
      ...selectedSheet.event_fields.map((field) => ({
        key: `event:${field}`,
        label: fieldLabel(field, eventOptions),
        read: () => recordValue(asRecord(selectedSheet.event_data)[field]),
      })),
      ...selectedSheet.student_fields.map((field) => ({
        key: `student:${field}`,
        label: fieldLabel(field, studentOptions),
        read: (student: OdSheetStudent) =>
          recordValue(asRecord(student.student_data)[field]),
      })),
      {
        key: 'attendance_status',
        label: 'Attendance status',
        read: (student: OdSheetStudent) =>
          recordValue(asRecord(student.student_data).attendance_status),
      },
    ];
  }, [selectedSheet]);

  function downloadCsv() {
    if (!selectedSheet) return;
    const lines = [
      columns.map((column) => csvCell(column.label)).join(','),
      ...students.map((student) =>
        columns.map((column) => csvCell(column.read(student))).join(','),
      ),
    ];
    downloadFile(lines.join('\r\n'), `${fileStem(selectedSheet.title)}.csv`);
  }

  function printPdf() {
    if (!selectedSheet) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Allow pop-ups to print or save this OD sheet as a PDF.');
      return;
    }
    printWindow.opener = null;
    const headings = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
    const rows = students
      .map((student) =>
        `<tr>${columns.map((column) => `<td>${escapeHtml(column.read(student))}</td>`).join('')}</tr>`,
      )
      .join('');
    printWindow.document.write(
      `<!doctype html><html><head><title>${escapeHtml(selectedSheet.title)}</title><style>
        body{font:12px Arial,sans-serif;padding:24px;color:#172033}h1{font-size:20px}
        table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:7px;text-align:left}
        th{background:#eee}@media print{body{padding:0}}
      </style></head><body><h1>${escapeHtml(selectedSheet.title)}</h1>
      <table><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody></table>
      <script>window.onload=()=>window.print()</script></body></html>`,
    );
    printWindow.document.close();
  }

  return (
    <div className="space-y-6">
      <header className={panelClass}>
        <p className="text-sm font-bold text-slateDark/65">Club Head event operations</p>
        <h1 className="mt-1 text-3xl font-bold">OD sheets</h1>
        <p className="mt-2 max-w-3xl text-sm text-slateDark/70">
          Generate a student list from finalized present attendance, choose the details to include,
          then download a CSV that opens in Excel or print it to PDF.
        </p>
      </header>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-mint p-4 text-sm">{message}</p>}

      <section aria-labelledby="generate-od-heading" className={panelClass}>
        <h2 id="generate-od-heading" className="text-xl font-bold">Generate a sheet</h2>
        {loading ? (
          <p role="status" className="mt-4 text-sm text-slateDark/70">Loading finalized events…</p>
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
                disabled={working || !selectedSession || !title.trim() || !selectedStudentFields.length}
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
                  </div>
                  <button
                    className={secondaryButtonClass}
                    disabled={working}
                    onClick={() => void openSheet(sheet.id).catch((loadError) => setError(errorMessage(loadError)))}
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
              <div className="flex gap-2">
                <button className={secondaryButtonClass} onClick={downloadCsv} type="button">
                  Download CSV / Excel
                </button>
                <button className={primaryButtonClass} onClick={printPdf} type="button">
                  Print / Save PDF
                </button>
              </div>
            )}
          </div>
          {selectedSheet && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-lavender text-xs uppercase tracking-wide">
                  <tr>{columns.map((column) => <th className="px-3 py-2" key={column.key}>{column.label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-mutedSlate/20">
                  {students.map((student) => (
                    <tr key={student.id}>
                      {columns.map((column) => (
                        <td className="px-3 py-2" key={column.key}>{column.read(student)}</td>
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

function asRecord(value: Json): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function recordValue(value: Json | undefined) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function fieldLabel(field: string, options: FieldOption[]) {
  return options.find((option) => option.value === field)?.label ?? field;
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

function fileStem(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'od-sheet';
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
