export function PlaceholderPage({ title, owner }: { title: string; owner?: string }) {
  return (
    <section className="rounded-3xl border border-mutedSlate/30 bg-white p-8 shadow-xl shadow-slateDark/10">
      <p className="text-sm font-bold text-slateDark/75">Extension point</p>
      <h1 className="mt-2 text-2xl font-bold text-slateDark">{title}</h1>
      <p className="mt-3 text-slateDark/75">
        This route is reserved for the next vertical slice{owner ? ` (${owner})` : ''}.
      </p>
    </section>
  );
}

export function AuthRequiredPage() {
  return <PlaceholderPage title="Authentication required" owner="redirecting to login" />;
}
