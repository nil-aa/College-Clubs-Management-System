import type { ReactNode } from 'react';

/**
 * Integration contract for Member 2 and Member 3.
 *
 * Member 1 intentionally does not query events, registrations, attendance, or
 * reports here. The owning modules may replace this empty slot or provide
 * widgets through these props once their tables and routes exist.
 */
export type EventsDashboardSlotProps = {
  audience: 'student' | 'club_head';
  clubIds?: readonly string[];
  upcomingEvents?: ReactNode;
  registrationStats?: ReactNode;
  attendanceStats?: ReactNode;
};

export function EventsDashboardSlot({ audience, clubIds = [] }: EventsDashboardSlotProps) {
  return (
    <section className="rounded-3xl border border-dashed border-lilac bg-white/70 p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-slateDark/65">Events</p>
      <h2 className="mt-1 text-xl font-bold text-slateDark">Events workspace</h2>
      <p className="mt-2 text-sm text-slateDark/70">
        Upcoming events, registration statistics and attendance statistics for{' '}
        {audience === 'student' ? 'your account' : 'your assigned clubs'} will appear here when the
        owning modules connect.
      </p>
      {audience === 'club_head' && (
        <p className="mt-3 text-xs text-slateDark/60">
          Dashboard contract: {clubIds.length} assigned club{clubIds.length === 1 ? '' : 's'}{' '}
          available through <code>clubIds</code>.
        </p>
      )}
    </section>
  );
}
