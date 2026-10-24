/* eslint-disable no-unused-vars */
import { useEffect, useState, type FormEvent } from 'react';
import type { ClubOption, Role, UserRoleAssignment } from './types';

type RoleAssignmentFormProps = {
  userId: string;
  userName: string;
  roles: Role[];
  clubs: ClubOption[];
  assignments: UserRoleAssignment[];
  clubHeadRoleId?: string;
  facultyCoordinatorRoleId?: string;
  currentRole: string;
  onRoleChange: (role: string) => Promise<void>;
  onAssignClubHead: (clubId: string) => Promise<void>;
  onRevokeClubHead: (clubId: string) => Promise<void>;
  onAssignFacultyCoordinator: (clubId: string) => Promise<void>;
  onRevokeFacultyCoordinator: (clubId: string) => Promise<void>;
  submitting: boolean;
  error: string;
};

const inputClass =
  'w-full rounded-xl border border-mutedSlate/50 bg-white px-3 py-2.5 text-sm text-slateDark outline-none focus:border-aqua focus:ring-4 focus:ring-aqua/35';

export function RoleAssignmentForm({
  userId,
  userName,
  roles,
  clubs,
  assignments,
  clubHeadRoleId,
  facultyCoordinatorRoleId,
  currentRole,
  onRoleChange,
  onAssignClubHead,
  onRevokeClubHead,
  onAssignFacultyCoordinator,
  onRevokeFacultyCoordinator,
  submitting,
  error,
}: RoleAssignmentFormProps) {
  const [role, setRole] = useState(currentRole);
  const [clubId, setClubId] = useState('');
  const [facultyClubId, setFacultyClubId] = useState('');

  useEffect(() => {
    setRole(currentRole);
  }, [currentRole]);

  async function handleRoleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (role === currentRole) return;
    if (
      !window.confirm(
        `Change ${userName}'s role to ${roles.find((item) => item.code === role)?.name ?? role}?`,
      )
    ) {
      setRole(currentRole);
      return;
    }
    await onRoleChange(role);
  }

  async function handleClubHeadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clubId) return;
    await onAssignClubHead(clubId);
    setClubId('');
  }

  async function handleRevoke(club: ClubOption) {
    if (window.confirm(`Revoke ${userName}'s Club Head assignment for ${club.name}?`)) {
      await onRevokeClubHead(club.id);
    }
  }

  async function handleFacultySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!facultyClubId) return;
    await onAssignFacultyCoordinator(facultyClubId);
    setFacultyClubId('');
  }

  async function handleFacultyRevoke(club: ClubOption) {
    if (window.confirm(`Revoke ${userName}'s Faculty Coordinator assignment for ${club.name}?`)) {
      await onRevokeFacultyCoordinator(club.id);
    }
  }

  const activeClubHeadAssignments = assignments.filter(
    (assignment) =>
      assignment.status === 'active' && assignment.club_id && assignment.role_id === clubHeadRoleId,
  );
  const activeFacultyAssignments = assignments.filter(
    (assignment) =>
      assignment.status === 'active' &&
      assignment.club_id &&
      assignment.role_id === facultyCoordinatorRoleId,
  );

  return (
    <section className="rounded-3xl border border-mutedSlate/25 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <p className="text-sm font-semibold text-slateDark/70">Selected user</p>
        <h2 className="mt-1 text-xl font-bold text-slateDark">{userName || 'Unnamed user'}</h2>
        <p className="mt-1 break-all text-xs text-slateDark/60">{userId}</p>
      </div>
      {error && (
        <p
          className="mt-4 rounded-xl border border-rose-200 bg-pink px-4 py-3 text-sm font-medium text-rose-900"
          role="alert"
        >
          {error}
        </p>
      )}
      <form
        className="mt-5 grid gap-3 rounded-2xl bg-mint/55 p-4 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={handleRoleSubmit}
      >
        <div>
          <label className="mb-2 block text-sm font-semibold text-slateDark" htmlFor="user-role">
            Global role
          </label>
          <select
            className={inputClass}
            id="user-role"
            onChange={(event) => setRole(event.target.value)}
            value={role}
          >
            {roles.map((item) => (
              <option key={item.id} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="rounded-xl bg-aqua px-4 py-2.5 text-sm font-bold text-slateDark transition hover:bg-aqua/80 focus:outline-none focus:ring-4 focus:ring-aqua/45 disabled:opacity-60"
          disabled={submitting || role === currentRole}
          type="submit"
        >
          {submitting ? 'Saving…' : 'Save role'}
        </button>
      </form>
      <p className="mt-3 text-xs text-slateDark/70">
        Club Head only grants club management access after a club assignment is active. The global
        Faculty role identifies a faculty account; assign Faculty Coordinator below to grant OD
        review access for a club.
      </p>
      {facultyCoordinatorRoleId && (
        <a
          className="mt-2 inline-block text-sm font-bold text-slateDark underline decoration-lilac decoration-2 underline-offset-4"
          href="#faculty-coordinator-assignment"
        >
          Assign Faculty Coordinator for a club
        </a>
      )}
      <div className="mt-6 border-t border-mutedSlate/20 pt-5">
        <p className="text-sm font-semibold text-slateDark/70">Club Head assignments</p>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={handleClubHeadSubmit}
        >
          <div>
            <label
              className="mb-2 block text-sm font-semibold text-slateDark"
              htmlFor="club-head-club"
            >
              Club
            </label>
            <select
              className={inputClass}
              disabled={clubs.length === 0 || submitting}
              id="club-head-club"
              onChange={(event) => setClubId(event.target.value)}
              value={clubId}
            >
              <option value="">Choose a club</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </div>
          <button
            className="rounded-xl bg-lilac px-4 py-2.5 text-sm font-bold text-slateDark transition hover:bg-lilac/80 focus:outline-none focus:ring-4 focus:ring-lilac/45 disabled:opacity-60"
            disabled={!clubId || clubs.length === 0 || submitting}
            type="submit"
          >
            Assign Club Head
          </button>
        </form>
        {clubs.length === 0 && (
          <p className="mt-3 text-xs text-slateDark/70">
            No clubs exist yet, so there are no Club Head scopes to assign.
          </p>
        )}
        {activeClubHeadAssignments.length === 0 ? (
          <p className="mt-4 text-sm text-slateDark/70">No active club assignments.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {activeClubHeadAssignments.map((assignment) => {
              const club = clubs.find((item) => item.id === assignment.club_id);
              if (!club) return null;
              return (
                <li
                  className="flex flex-col gap-3 rounded-xl border border-mutedSlate/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  key={assignment.id}
                >
                  <span className="text-sm font-semibold text-slateDark">{club.name}</span>
                  <button
                    className="self-start rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-900 transition hover:bg-pink focus:outline-none focus:ring-4 focus:ring-pink sm:self-auto"
                    disabled={submitting}
                    onClick={() => void handleRevoke(club)}
                    type="button"
                  >
                    Revoke
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="mt-6 border-t border-mutedSlate/20 pt-5" id="faculty-coordinator-assignment">
        <p className="text-sm font-semibold text-slateDark/70">Faculty Coordinator assignments</p>
        <p className="mt-1 text-xs text-slateDark/65">
          Faculty Coordinators can review and approve OD lists for their assigned clubs.
        </p>
        <form
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          onSubmit={handleFacultySubmit}
        >
          <div>
            <label
              className="mb-2 block text-sm font-semibold text-slateDark"
              htmlFor="faculty-club"
            >
              Faculty club
            </label>
            <select
              className={inputClass}
              disabled={!facultyCoordinatorRoleId || clubs.length === 0 || submitting}
              id="faculty-club"
              onChange={(event) => setFacultyClubId(event.target.value)}
              value={facultyClubId}
            >
              <option value="">Choose a club</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </div>
          <button
            className="rounded-xl bg-lilac px-4 py-2.5 text-sm font-bold text-slateDark disabled:opacity-60"
            disabled={!facultyClubId || !facultyCoordinatorRoleId || submitting}
            type="submit"
          >
            Assign Faculty Coordinator
          </button>
        </form>
        {!facultyCoordinatorRoleId && (
          <p className="mt-3 text-xs text-rose-800">
            Faculty Coordinator role is missing. Apply the latest database migration.
          </p>
        )}
        {activeFacultyAssignments.length === 0 ? (
          <p className="mt-4 text-sm text-slateDark/70">No active faculty assignments.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {activeFacultyAssignments.map((assignment) => {
              const club = clubs.find((item) => item.id === assignment.club_id);
              if (!club) return null;
              return (
                <li
                  className="flex items-center justify-between gap-3 rounded-xl border border-mutedSlate/25 px-4 py-3"
                  key={assignment.id}
                >
                  <span className="text-sm font-semibold text-slateDark">{club.name}</span>
                  <button
                    className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-900 disabled:opacity-60"
                    disabled={submitting}
                    onClick={() => void handleFacultyRevoke(club)}
                    type="button"
                  >
                    Revoke
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
