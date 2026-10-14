/**
 * Integration contract for Member 2: provide this component with the owning
 * club id and replace the placeholder with event queries once events exists.
 * Member 1 intentionally does not query an events table.
 */
export function EventsSection({ clubId }: { clubId: string }) {
  return (
    <section className="rounded-3xl border border-dashed border-lilac bg-white/70 p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-slateDark/65">Events</p>
      <h2 className="mt-1 text-xl font-bold text-slateDark">Upcoming events</h2>
      <p className="mt-2 text-sm text-slateDark/70">
        Events for club <span className="font-semibold">{clubId}</span> will appear here when the
        events module is connected.
      </p>
    </section>
  );
}
