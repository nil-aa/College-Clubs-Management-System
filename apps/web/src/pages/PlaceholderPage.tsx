export function PlaceholderPage({ title, owner }: { title: string; owner?: string }) {
  return (
    <section className="rounded-xl border bg-white p-8 shadow-sm">
      <p className="text-sm font-medium text-indigo-600">Extension point</p>
      <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-slate-600">
        This route is reserved for the next vertical slice{owner ? ` (${owner})` : ''}.
      </p>
    </section>
  );
}

export function AuthRequiredPage() {
  return (
    <PlaceholderPage
      title="Authentication required"
      owner="login UI will be added in the authentication slice"
    />
  );
}
