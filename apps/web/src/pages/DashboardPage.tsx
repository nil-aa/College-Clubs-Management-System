export function DashboardPage() {
  return (
    <section className="rounded-xl border bg-white p-8 shadow-sm">
      <p className="text-sm font-medium text-indigo-600">Foundation scaffold</p>
      <h1 className="mt-2 text-3xl font-semibold">Welcome to the club workspace</h1>
      <p className="mt-4 max-w-2xl text-slate-600">
        This dashboard is intentionally a placeholder. Feature slices will add their database, RLS,
        backend logic and UI together.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {['Identity & profiles', 'Club access', 'Notifications'].map((label) => (
          <div className="rounded-lg bg-slate-50 p-4" key={label}>
            <p className="font-medium">{label}</p>
            <p className="mt-1 text-sm text-slate-500">Ready for the next vertical slice.</p>
          </div>
        ))}
      </div>
    </section>
  );
}
