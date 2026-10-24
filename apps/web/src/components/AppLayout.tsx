import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermission, useRole } from '../hooks/usePermission';
import { NotificationBell } from './NotificationBell';
import { useManagedClubs } from '../features/events/useManagedClubs';

const defaultClubId =
  import.meta.env.VITE_DEFAULT_CLUB_ID || '20000000-0000-0000-0000-000000000001';

type PermissionNav = { label: string; to: string; permission: string; clubId?: string | null };

const ownNav: PermissionNav[] = [
  {
    label: 'Users & Roles',
    to: '/roles-permissions',
    permission: 'users.manage',
    clubId: null,
  },
  { label: 'Manage Clubs', to: '/manage-clubs', permission: 'users.manage', clubId: null },
  { label: 'Audit Log', to: '/audit-logs', permission: 'audit.read', clubId: null },
  { label: 'Clubs', to: '/clubs', permission: 'clubs.read' },
  { label: 'Memberships', to: '/memberships', permission: 'memberships.read' },
  { label: 'Recruitment', to: '/recruitment', permission: 'recruitment.read' },
  { label: 'Committees', to: '/committees', permission: 'committee.read' },
  { label: 'Volunteers', to: '/volunteers', permission: 'volunteers.read' },
];

function PermissionNavItem({ item }: { item: PermissionNav }) {
  const { allowed, loading } = usePermission(
    item.permission,
    item.clubId === undefined ? defaultClubId : item.clubId,
  );
  if (loading || !allowed) return null;
  return <NavItem label={item.label} to={item.to} />;
}

function NavItem({ label, to }: { label: string; to: string }) {
  return (
    <NavLink
      end={to === '/'}
      to={to}
      className={({ isActive }) =>
        `rounded-xl px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-aqua/40 ${isActive ? 'bg-mint text-slateDark' : 'text-slateDark/75 hover:bg-pink'}`
      }
    >
      {label}
    </NavLink>
  );
}

export function AppLayout() {
  const { user, profile, signOut } = useAuth();
  const { allowed: isGlobalAdmin } = useRole('global_admin');
  const { allowed: isClubHead } = useRole('club_head');
  const { allowed: isStudent } = useRole('student');
  const { allowed: isFacultyCoordinator } = useRole('faculty_coordinator');
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const { clubs: managedEventClubs } = useManagedClubs();
  const displayName =
    profile?.full_name || user?.user_metadata.full_name || user?.email?.split('@')[0] || 'Member';

  async function handleLogout() {
    setLogoutError('');
    setLoggingOut(true);
    const { error } = await signOut();
    setLoggingOut(false);
    if (error) {
      setLogoutError(error.message || 'Could not log out.');
      return;
    }
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-lavender text-slateDark">
      <header className="border-b border-mutedSlate/30 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-lg font-bold">Club Management</p>
            <p className="text-xs text-slateDark/70">Identity, clubs and notifications</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <NavLink
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slateDark/75 hover:bg-pink focus:outline-none focus:ring-4 focus:ring-aqua/40"
              to="/profile"
            >
              <span className="hidden sm:inline">Hello, </span>
              {displayName}
            </NavLink>
            <button
              className="rounded-xl border border-mutedSlate/50 px-3 py-2 text-sm font-bold text-slateDark transition hover:bg-pink focus:outline-none focus:ring-4 focus:ring-aqua/40 disabled:opacity-60"
              disabled={loggingOut}
              onClick={handleLogout}
              type="button"
            >
              {loggingOut ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        </div>
        {logoutError && (
          <p
            className="mx-auto max-w-7xl px-4 pb-3 text-sm font-medium text-rose-800 sm:px-6"
            role="alert"
          >
            {logoutError}
          </p>
        )}
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-8">
        <aside className="flex shrink-0 flex-col gap-1 lg:w-64">
          {isGlobalAdmin && <NavItem label="Dashboard" to="/dashboard" />}
          <NavItem label="Events" to={isGlobalAdmin ? '/events' : '/'} />
          <NavItem label="My Registrations" to="/my-registrations" />
          <NavItem label="Participation History" to="/participation-history" />
          {managedEventClubs.length > 0 && <NavItem label="Manage Events" to="/manage-events" />}
          {managedEventClubs.length > 0 && <NavItem label="OD Sheets" to="/od-sheets" />}
          {isFacultyCoordinator && <NavItem label="OD Review" to="/faculty/od-reviews" />}
          {managedEventClubs.length > 0 ? (
            <NavItem label="Attendance Reports" to="/attendance-reports" />
          ) : (
            <PermissionNavItem
              item={{
                label: 'Attendance Reports',
                to: '/attendance-reports',
                permission: 'events.manage',
                clubId: null,
              }}
            />
          )}
          {!isGlobalAdmin && !isClubHead && !isStudent && (
            <NavItem label="Dashboard" to="/dashboard" />
          )}
          <p className="px-3 pb-1 pt-4 text-xs font-bold uppercase tracking-wide text-slateDark/65">
            Identity & clubs
          </p>
          {ownNav
            .filter(
              (item) =>
                !isGlobalAdmin ||
                !['/memberships', '/recruitment', '/committees', '/volunteers'].includes(item.to),
            )
            .map((item) => (
              <PermissionNavItem item={item} key={item.to} />
            ))}
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
