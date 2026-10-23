import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Database } from '@club-management/shared';
import { errorMessage } from '../clubs/types';
import { supabase } from '../../lib/supabase';
import { panelClass, primaryButtonClass, secondaryButtonClass } from './eventUtils';

type AttendanceStatus = Database['public']['Enums']['attendance_status'];
type EventParticipant = Database['public']['Functions']['list_event_participants']['Returns'][number];
type AttendanceDraft = { status: AttendanceStatus | ''; notes: string };

const statusOptions: { value: AttendanceStatus; label: string }[] = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT', label: 'Absent' },
];

export function AttendanceEditor({
  eventId,
  participants,
}: {
  eventId: string;
  participants: EventParticipant[];
}) {
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft>>({});
  const [finalized, setFinalized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sessionResult, attendanceResult] = await Promise.all([
        supabase
          .from('event_attendance_sessions')
          .select('status')
          .eq('event_id', eventId)
          .maybeSingle(),
        supabase
          .from('event_attendance')
          .select('student_id, status, notes')
          .eq('event_id', eventId),
      ]);
      if (sessionResult.error) throw sessionResult.error;
      if (attendanceResult.error) throw attendanceResult.error;

      const nextDrafts = Object.fromEntries(
        (attendanceResult.data ?? []).map((record) => [
          record.student_id,
          { status: record.status === 'EXCUSED' ? 'PRESENT' : record.status, notes: record.notes ?? '' },
        ]),
      );
      setDrafts(nextDrafts);
      setFinalized(sessionResult.data?.status === 'FINALIZED');
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const registeredParticipants = useMemo(
    () => participants.filter((participant) => participant.registration_status === 'REGISTERED'),
    [participants],
  );
  const summary = useMemo(() => {
    const marked = registeredParticipants.map((participant) => drafts[participant.student_id]?.status ?? 'PRESENT');
    return {
      registered: registeredParticipants.length,
      present: marked.filter((status) => status === 'PRESENT').length,
      absent: marked.filter((status) => status === 'ABSENT').length,
      unmarked: marked.filter((status) => !status).length,
    };
  }, [registeredParticipants, drafts]);

  function updateDraft(studentId: string, update: Partial<AttendanceDraft>) {
    setDrafts((current) => ({
      ...current,
      [studentId]: { ...(current[studentId] ?? { status: '', notes: '' }), ...update },
    }));
  }

  async function finalize() {
    setWorking(true);
    setError('');
    setMessage('');
    try {
      for (const participant of registeredParticipants) {
        const draft = drafts[participant.student_id] ?? { status: 'PRESENT' as AttendanceStatus, notes: '' };
        const { error: saveError } = await supabase.rpc('mark_event_attendance', {
          p_event_id: eventId,
          p_student_id: participant.student_id,
          p_status: draft.status || 'PRESENT',
          p_notes: draft.notes || null,
        });
        if (saveError) throw saveError;
      }
      const { error: finalizeError } = await supabase.rpc('finalize_event_attendance', {
        p_event_id: eventId,
      });
      if (finalizeError) throw finalizeError;
      setFinalized(true);
      setMessage('Attendance is finalized and locked for changes.');
    } catch (finalizeError) {
      setError(errorMessage(finalizeError));
    } finally {
      setWorking(false);
    }
  }

  return (
    <section aria-labelledby="attendance-heading" className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slateDark/65">Event operations</p>
          <h2 id="attendance-heading" className="mt-1 text-2xl font-bold">
            Attendance
          </h2>
          <p className="mt-1 text-sm text-slateDark/70">
            Mark each current registration, then finalize attendance to lock the record.
          </p>
        </div>
        {finalized ? (
          <span className="rounded-full bg-mint px-3 py-1.5 text-sm font-bold">Finalized</span>
        ) : (
          <button
            className={primaryButtonClass}
            disabled={working || loading}
            onClick={() => void finalize()}
            type="button"
          >
            {working ? 'Finalizing…' : 'Finalize attendance'}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-4 rounded-xl bg-mint p-3 text-sm text-slateDark">
          {message}
        </p>
      )}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Summary label="Registered" value={summary.registered} />
        <Summary label="Present" value={summary.present} />
        <Summary label="Absent" value={summary.absent} />
      </div>
      {loading ? (
        <p role="status" className="py-8 text-center text-sm text-slateDark/70">
          Loading attendance…
        </p>
      ) : registeredParticipants.length === 0 ? (
        <p className="py-8 text-center text-sm text-slateDark/70">
          There are no current registrations to mark for this event.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-lavender text-xs uppercase tracking-wide text-slateDark/70">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Register number</th>
                <th className="px-4 py-3">Attendance</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mutedSlate/20">
              {registeredParticipants.map((participant) => {
                const draft = drafts[participant.student_id] ?? { status: 'PRESENT', notes: '' };
                return (
                  <tr key={participant.registration_id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{participant.full_name}</p>
                      <p className="mt-1 text-xs text-slateDark/65">
                        {participant.department || 'Department not provided'}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono">{participant.roll_number || '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Attendance for ${participant.full_name}`}
                        className="rounded-lg border border-mutedSlate/50 bg-white px-3 py-2 disabled:bg-lavender"
                        disabled={finalized || working}
                        value={draft.status || 'PRESENT'}
                        onChange={(event) =>
                          updateDraft(participant.student_id, {
                            status: event.target.value as AttendanceStatus | '',
                          })
                        }
                      >
                        <option value="">Select status</option>
                        {statusOptions.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        aria-label={`Notes for ${participant.full_name}`}
                        className="w-full rounded-lg border border-mutedSlate/50 px-3 py-2 disabled:bg-lavender"
                        disabled={finalized || working}
                        value={draft.notes}
                        onChange={(event) =>
                          updateDraft(participant.student_id, { notes: event.target.value })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <button
        className={`${secondaryButtonClass} mt-4`}
        disabled={loading || working}
        onClick={() => void load()}
        type="button"
      >
        Refresh attendance
      </button>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-mutedSlate/25 bg-white p-3">
      <p className="text-xs font-semibold text-slateDark/65">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
