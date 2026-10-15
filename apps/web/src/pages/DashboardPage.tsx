import { useCallback, useEffect, useState } from 'react';
import {
  getAdminDashboardStats,
  type AdminDashboardAuditEntry,
  type AdminDashboardStats,
} from '@club-management/shared';
import { Link } from 'react-router-dom';
import { EventsDashboardSlot } from '../features/dashboard/EventsDashboardSlot';
import { NotificationItem } from '../features/notifications/NotificationItem';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { usePermission, useRole } from '../hooks/usePermission';
import { supabase } from '../lib/supabase';
import { errorMessage, type Club } from '../features/clubs/types';
import { auditActionLabel, formatAuditDate, formatAuditDetails } from '../features/audit/types';

export function DashboardPage() {
  const { user, profile } = useAuth();
  const { allowed: isAdmin, loading: adminLoading } = usePermission('audit.read');
  const { allowed: isClubHead, loading: clubHeadLoading } = useRole('club_head');
  const displayName =
    profile?.full_name || user?.user_metadata.full_name || user?.email?.split('@')[0] || 'Member';

  if (adminLoading || clubHeadLoading) {
    return <div className="rounded-3xl bg-white p-8">Preparing your dashboard…</div>;
  }
  if (isAdmin) return <AdminDashboard />;
  if (isClubHead) return <ClubHeadDashboard displayName={displayName} />;
  return <StudentDashboard displayName={displayName} />;
}

function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void getAdminDashboardStats(supabase)
      .then(setStats)
      .catch((loadError: unknown) => setError(errorMessage(loadError)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <DashboardHeading
        eyebrow="Administration"
        title="Admin dashboard"
        description="A quick view of club health, role coverage and recent changes."
      />
      {error && <ErrorNotice message={error} />}
      {loading ? (
        <div className="rounded-3xl bg-white p-8">Loading dashboard statistics…</div>
      ) : stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Active clubs" value={stats.active_club_count} tone="mint" />
            <StatCard label="Inactive clubs" value={stats.inactive_club_count} tone="pink" />
            <StatCard
              label="Clubs without a head"
              value={stats.clubs_without_head_count}
              tone="lilac"
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-xl font-bold">Users by role</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ...stats.users_by_role.filter((item) => item.role !== 'admin' && item.role !== 'global_admin'),
                  {
                    role: 'admin',
                    count: stats.users_by_role.find((item) => item.role === 'global_admin')?.count ?? 0,
                  },
                ].map((item) => (
                  <div className="rounded-2xl bg-mint/60 px-4 py-3" key={item.role}>
                    <p className="text-sm font-semibold capitalize text-slateDark/70">
                      {item.role.replace('_', ' ')}
                    </p>
                    <p className="mt-1 text-2xl font-bold">{item.count}</p>
                  </div>
                ))}
              </div>
            </section>
            <RecentAuditEntries entries={stats.recent_audit_logs} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function ClubHeadDashboard({ displayName }: { displayName: string }) {
  const { user } = useAuth();
  const { latest, unreadCount, markAsRead } = useNotifications();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadClubs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const roleResult = await supabase.from('roles').select('id').eq('code', 'club_head').single();
    if (roleResult.error) {
      setError(errorMessage(roleResult.error));
      setLoading(false);
      return;
    }
    const assignmentResult = await supabase
      .from('user_roles')
      .select('club_id')
      .eq('user_id', user.id)
      .eq('role_id', roleResult.data.id)
      .eq('status', 'active')
      .not('club_id', 'is', null);
    if (assignmentResult.error) {
      setError(errorMessage(assignmentResult.error));
      setLoading(false);
      return;
    }
    const clubIds = assignmentResult.data
      .map((assignment) => assignment.club_id)
      .filter((id): id is string => Boolean(id));
    if (clubIds.length === 0) {
      setClubs([]);
      setLoading(false);
      return;
    }
    const clubResult = await supabase.from('clubs').select('*').in('id', clubIds).order('name');
    if (clubResult.error) setError(errorMessage(clubResult.error));
    else setClubs((clubResult.data ?? []) as Club[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadClubs();
  }, [loadClubs]);

  const unread = latest.filter((notification) => !notification.is_read);
  return (
    <div className="space-y-6">
      <DashboardHeading
        eyebrow="Club Head workspace"
        title={`Welcome, ${displayName}`}
        description="Manage the clubs assigned to you and keep up with new notifications."
      />
      {error && <ErrorNotice message={error} />}
      <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">My Clubs</h2>
            <p className="mt-1 text-sm text-slateDark/70">
              Your assigned clubs, including inactive clubs.
            </p>
          </div>
          <Link
            className="font-bold text-slateDark underline decoration-aqua decoration-2 underline-offset-4"
            to="/clubs"
          >
            Open directory
          </Link>
        </div>
        {loading ? (
          <p className="mt-5 text-sm text-slateDark/70">Loading your clubs…</p>
        ) : clubs.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-lavender p-4 text-sm text-slateDark/70">
            No clubs are assigned to you yet.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {clubs.map((club) => (
              <Link
                className="rounded-2xl border border-mutedSlate/25 p-4 transition hover:border-aqua hover:bg-mint/40 focus:outline-none focus:ring-4 focus:ring-aqua/40"
                key={club.id}
                to={`/clubs/${club.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold">{club.name}</h3>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${club.is_active ? 'bg-mint' : 'bg-pink'}`}
                  >
                    {club.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slateDark/70">{club.category || 'Student club'}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Unread notifications</h2>
            <p className="mt-1 text-sm text-slateDark/70">
              {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}.
            </p>
          </div>
          <Link
            className="font-bold text-slateDark underline decoration-aqua decoration-2 underline-offset-4"
            to="/notifications"
          >
            View all
          </Link>
        </div>
        {unread.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-lavender p-4 text-sm text-slateDark/70">
            You are all caught up.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {unread.map((notification) => (
              <NotificationItem
                compact
                key={notification.id}
                notification={notification}
                onRead={() => void markAsRead(notification.id, notification.is_read)}
              />
            ))}
          </div>
        )}
      </section>
      <EventsDashboardSlot audience="club_head" clubIds={clubs.map((club) => club.id)} />
    </div>
  );
}

function StudentDashboard({ displayName }: { displayName: string }) {
  const { latest, markAsRead } = useNotifications();
  return (
    <div className="space-y-6">
      <DashboardHeading
        eyebrow="Student workspace"
        title={`Welcome, ${displayName}`}
        description="Discover active clubs and keep up with your latest notifications."
      />
      <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Explore clubs</h2>
            <p className="mt-1 text-sm text-slateDark/70">
              Find a club that matches your interests.
            </p>
          </div>
          <Link
            className="rounded-xl bg-aqua px-4 py-2.5 text-sm font-bold hover:bg-aqua/80 focus:outline-none focus:ring-4 focus:ring-aqua/45"
            to="/clubs"
          >
            Open club directory
          </Link>
        </div>
      </section>
      <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Latest notifications</h2>
          <Link
            className="font-bold text-slateDark underline decoration-aqua decoration-2 underline-offset-4"
            to="/notifications"
          >
            View all
          </Link>
        </div>
        {latest.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-lavender p-4 text-sm text-slateDark/70">
            You have no notifications yet.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {latest.map((notification) => (
              <NotificationItem
                compact
                key={notification.id}
                notification={notification}
                onRead={() => void markAsRead(notification.id, notification.is_read)}
              />
            ))}
          </div>
        )}
      </section>
      <EventsDashboardSlot audience="student" />
    </div>
  );
}

function DashboardHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slateDark/70">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-bold">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-slateDark/75">{description}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'mint' | 'pink' | 'lilac';
}) {
  return (
    <div
      className={`rounded-3xl border border-mutedSlate/20 p-5 shadow-sm ${tone === 'mint' ? 'bg-mint/70' : tone === 'pink' ? 'bg-pink' : 'bg-lilac/55'}`}
    >
      <p className="text-sm font-semibold text-slateDark/70">{label}</p>
      <p className="mt-2 text-4xl font-bold">{value}</p>
    </div>
  );
}

function RecentAuditEntries({ entries }: { entries: AdminDashboardAuditEntry[] }) {
  return (
    <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Recent audit entries</h2>
        <Link
          className="font-bold text-slateDark underline decoration-aqua decoration-2 underline-offset-4"
          to="/audit-logs"
        >
          View audit log
        </Link>
      </div>
      {entries.length === 0 ? (
        <p className="mt-5 rounded-2xl bg-lavender p-4 text-sm text-slateDark/70">
          No audit entries yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {entries.map((entry, index) => (
            <details
              className="rounded-2xl border border-mutedSlate/20 p-3"
              key={`${entry.created_at}-${index}`}
            >
              <summary className="cursor-pointer font-semibold focus:outline-none focus:ring-4 focus:ring-aqua/40">
                <span>{auditActionLabel(entry.action)}</span>
                <span className="ml-2 text-xs font-normal text-slateDark/60">
                  {formatAuditDate(entry.created_at)}
                </span>
              </summary>
              <p className="mt-2 text-sm text-slateDark/70">
                {entry.actor_name || 'System'} · {entry.entity_type}
              </p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-lavender p-3 text-xs">
                {formatAuditDetails(entry.details)}
              </pre>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <p
      className="rounded-xl border border-rose-200 bg-pink px-4 py-3 text-sm text-rose-900"
      role="alert"
    >
      {message}
    </p>
  );
}
