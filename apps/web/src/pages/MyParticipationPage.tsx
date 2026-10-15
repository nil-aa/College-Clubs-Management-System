import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@club-management/shared';
import { errorMessage } from '../features/clubs/types';
import { formatEventDate, panelClass } from '../features/events/eventUtils';
import { supabase } from '../lib/supabase';

type Participation =
  Database['public']['Functions']['list_my_event_participation']['Returns'][number];

export function MyParticipationPage() {
  const [history, setHistory] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: historyError } = await supabase.rpc('list_my_event_participation');
    if (historyError) {
      setError(errorMessage(historyError));
      setHistory([]);
    } else {
      setHistory(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const finalizedRecords = history.filter((item) => item.attendance_finalized);
  const presentCount = finalizedRecords.filter((item) => item.attendance_status === 'PRESENT').length;
  const absentCount = finalizedRecords.filter((item) => item.attendance_status === 'ABSENT').length;
  const excusedCount = finalizedRecords.filter((item) => item.attendance_status === 'EXCUSED').length;

  return (
    <div className="space-y-6">
      <header className={`${panelClass} bg-gradient-to-br from-white to-mint/30`}>
        <p className="text-sm font-bold text-slateDark/65">Your events</p>
        <h1 className="mt-1 text-3xl font-bold">Participation history</h1>
        <p className="mt-2 max-w-2xl text-sm text-slateDark/70">
          Review your event registrations and finalized attendance across clubs.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label="Event registrations" value={history.length} />
        <Summary label="Attended" value={presentCount} />
        <Summary label="Absent" value={absentCount} />
        <Summary label="Excused" value={excusedCount} />
      </div>

      <section aria-labelledby="history-heading" className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="history-heading" className="text-xl font-bold">All event registrations</h2>
            <p className="mt-1 text-sm text-slateDark/70">
              Attendance is shown after a Club Head finalizes the event record.
            </p>
          </div>
          <button
            className="rounded-xl border border-mutedSlate/50 px-3 py-2 text-sm font-bold hover:bg-lavender disabled:opacity-60"
            disabled={loading}
            onClick={() => void load()}
            type="button"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p role="status" className="py-8 text-center text-sm text-slateDark/70">
            Loading your participation history…
          </p>
        ) : history.length === 0 ? (
          <p className="py-8 text-center text-sm text-slateDark/70">
            Your event registrations will appear here.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-lavender text-xs uppercase tracking-wide text-slateDark/70">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Club</th>
                  <th className="px-4 py-3">Date & venue</th>
                  <th className="px-4 py-3">Registration</th>
                  <th className="px-4 py-3">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mutedSlate/20">
                {history.map((item) => (
                  <tr key={item.registration_id}>
                    <td className="px-4 py-4 font-bold">{item.event_title}</td>
                    <td className="px-4 py-4">{item.club_name}</td>
                    <td className="px-4 py-4">
                      <p>{formatEventDate(item.starts_at)}</p>
                      <p className="mt-1 text-xs text-slateDark/65">{item.venue}</p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill status={item.registration_status} />
                    </td>
                    <td className="px-4 py-4">
                      {item.attendance_finalized ? (
                        <StatusPill status={item.attendance_status ?? 'UNMARKED'} />
                      ) : (
                        <StatusPill status="PENDING" />
                      )}
                    </td>
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

function StatusPill({ status }: { status: string }) {
  const label = status === 'UNMARKED' ? 'Unmarked' : status === 'PENDING'
    ? 'Pending finalization'
    : status.charAt(0) + status.slice(1).toLowerCase();
  const tone = status === 'REGISTERED' || status === 'PRESENT'
    ? 'bg-mint text-slateDark'
    : status === 'CANCELLED' || status === 'ABSENT'
      ? 'bg-rose-100 text-rose-900'
      : 'bg-lavender text-slateDark/75';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{label}</span>;
}
