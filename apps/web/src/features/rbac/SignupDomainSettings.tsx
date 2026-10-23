import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function SignupDomainSettings() {
  const [domains, setDomains] = useState<string[]>([]);
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase.rpc('list_allowed_signup_email_domains');
    if (queryError) setError('Could not load signup domains. Check your access and try again.');
    else setDomains((data ?? []).map((row) => row.domain));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setSuccess('');
    const normalized = domain.trim().toLowerCase();
    if (!domainPattern.test(normalized) || normalized.length > 253 || normalized.split('.').some((label) => label.length > 63)) {
      setError('Enter a valid domain name, such as ssn.edu.in.');
      return;
    }
    setSaving(true);
    const { error: mutationError } = await supabase.rpc('add_allowed_signup_email_domain', { p_domain: normalized });
    setSaving(false);
    if (mutationError) {
      setError(mutationError.code === '23505' ? 'That domain is already allowed.' : 'Could not add the domain. Check your access and try again.');
      return;
    }
    setDomain(''); setSuccess(`${normalized} is now approved for sign-up.`);
    await load();
  }

  async function removeDomain(value: string) {
    setError(''); setSuccess(''); setSaving(true);
    const { error: mutationError } = await supabase.rpc('remove_allowed_signup_email_domain', { p_domain: value });
    setSaving(false);
    if (mutationError) {
      setError(mutationError.code === '23514'
        ? 'At least one signup domain must remain allowed. Add another domain before removing this one.'
        : 'Could not remove the domain. Check your access and try again.');
      return;
    }
    setSuccess(`${value} is no longer approved for sign-up.`);
    await load();
  }

  return (
    <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-sm font-semibold text-slateDark/70">Sign-up eligibility</p>
      <h2 className="mt-1 text-xl font-bold text-slateDark">Approved email domains</h2>
      <p className="mt-2 text-sm text-slateDark/75">Only new accounts using one of these exact email domains can be created. Existing accounts can still log in.</p>
      {error && <p className="mt-4 rounded-xl border border-rose-200 bg-pink px-4 py-3 text-sm text-rose-900" role="alert">{error}</p>}
      {success && <p className="mt-4 rounded-xl border border-teal-200 bg-mint px-4 py-3 text-sm text-slateDark" role="status">{success}</p>}
      {loading ? <p className="mt-4 text-sm">Loading approved domains…</p> : (
        <ul className="mt-4 space-y-2" aria-label="Approved email domains">
          {domains.map((item) => <li className="flex items-center justify-between gap-3 rounded-xl bg-mint/50 px-4 py-3" key={item}>
            <span className="font-semibold text-slateDark">@{item}</span>
            <button className="rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-900 disabled:opacity-50" disabled={saving} onClick={() => void removeDomain(item)} type="button">Remove</button>
          </li>)}
        </ul>
      )}
      <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => void addDomain(event)}>
        <label className="sr-only" htmlFor="signup-domain">Email domain</label>
        <input className="w-full rounded-xl border border-mutedSlate/50 px-3 py-2.5 text-sm" id="signup-domain" onChange={(event) => setDomain(event.target.value)} placeholder="example.edu.in" value={domain} />
        <button className="rounded-xl bg-aqua px-5 py-2.5 text-sm font-bold text-slateDark disabled:opacity-50" disabled={saving} type="submit">Add domain</button>
      </form>
    </section>
  );
}
