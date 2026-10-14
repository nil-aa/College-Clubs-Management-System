import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermission } from '../hooks/usePermission';

const defaultClubId =
  import.meta.env.VITE_DEFAULT_CLUB_ID || '20000000-0000-0000-0000-000000000001';

const ownNav = [
  { label: 'Clubs', to: '/clubs', permission: 'clubs.read' },
  { label: 'Memberships', to: '/memberships', permission: 'memberships.read' },
  { label: 'Recruitment', to: '/recruitment', permission: 'recruitment.read' },
  { label: 'Committees', to: '/committees', permission: 'committee.read' },
  { label: 'Volunteers', to: '/volunteers', permission: 'volunteers.read' },
];

const teammateNav = [
  { label: 'Events (Teammate 2)', to: '/events' },
  { label: 'Bookings & Finance (Teammate 3)', to: '/bookings' },
];

function PermissionNavItem({ item }: { item: (typeof ownNav)[number] }) {
  const { allowed, loading } = usePermission(item.permission, defaultClubId);
  if (loading || !allowed) return null;
  return <NavItem label={item.label} to={item.to} />;
}

function NavItem({ label, to }: { label: string; to: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-indigo-100 text-indigo-800' : 'text-slate-600 hover:bg-slate-100'}`
      }
    >
      {label}
    </NavLink>
  );
}

export function AppLayout() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-lg font-semibold">Club Management</p>
            <p className="text-xs text-slate-500">Identity, clubs and membership foundation</p>
          </div>
          <span className="text-sm text-slate-600">{user?.email ?? 'Signed out'}</span>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-8 px-6 py-6">
        <aside className="flex w-64 shrink-0 flex-col gap-1">
          <NavItem label="Dashboard" to="/" />
          <p className="px-3 pb-1 pt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Identity & clubs
          </p>
          {ownNav.map((item) => (
            <PermissionNavItem item={item} key={item.to} />
          ))}
          <p className="px-3 pb-1 pt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Team modules
          </p>
          {teammateNav.map((item) => (
            <NavItem {...item} key={item.to} />
          ))}
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
