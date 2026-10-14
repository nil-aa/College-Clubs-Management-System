export function DashboardPage() {
  return (
    <section className="rounded-3xl border border-mutedSlate/30 bg-white p-8 shadow-xl shadow-slateDark/10">
      <p className="text-sm font-bold text-slateDark/75">Your workspace</p>
      <h1 className="mt-2 text-3xl font-bold text-slateDark">Welcome to the club workspace</h1>
      <p className="mt-4 max-w-2xl text-slateDark/75">
        This dashboard is intentionally a placeholder. Feature slices will add their database, RLS,
        backend logic and UI together.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {['Identity & profiles', 'Club access', 'Notifications'].map((label) => (
          <div className="rounded-2xl bg-mint/60 p-4" key={label}>
            <p className="font-semibold text-slateDark">{label}</p>
            <p className="mt-1 text-sm text-slateDark/75">Ready for the next vertical slice.</p>
          </div>
        ))}
      </div>
    </section>
  );
}
