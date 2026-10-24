import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleAssignmentForm } from './RoleAssignmentForm';
import type { Role, UserRoleAssignment } from './types';

const roles: Role[] = [
  {
    id: 'role-student',
    code: 'student',
    name: 'Student',
    description: null,
    is_global: true,
    is_system: true,
    created_at: '',
  },
  {
    id: 'role-head',
    code: 'club_head',
    name: 'Club Head',
    description: null,
    is_global: false,
    is_system: true,
    created_at: '',
  },
  {
    id: 'role-faculty',
    code: 'faculty',
    name: 'Faculty',
    description: null,
    is_global: true,
    is_system: true,
    created_at: '',
  },
  {
    id: 'role-admin',
    code: 'admin',
    name: 'Admin',
    description: null,
    is_global: true,
    is_system: true,
    created_at: '',
  },
];

const baseProps = () => ({
  userId: 'user-1',
  userName: 'Test User',
  roles,
  clubs: [{ id: 'club-1', name: 'Computing Club', status: 'active' }],
  assignments: [] as UserRoleAssignment[],
  currentRole: 'student',
  onRoleChange: vi.fn().mockResolvedValue(undefined),
  onAssignClubHead: vi.fn().mockResolvedValue(undefined),
  onRevokeClubHead: vi.fn().mockResolvedValue(undefined),
  onAssignFacultyCoordinator: vi.fn().mockResolvedValue(undefined),
  onRevokeFacultyCoordinator: vi.fn().mockResolvedValue(undefined),
  clubHeadRoleId: 'role-head',
  facultyCoordinatorRoleId: 'role-faculty',
  submitting: false,
  error: '',
});

describe('RoleAssignmentForm', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('offers Faculty as a global role separately from club-scoped coordinator access', () => {
    const props = baseProps();
    render(<RoleAssignmentForm {...props} />);

    expect(screen.getByRole('option', { name: 'Faculty' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign Faculty Coordinator' })).toBeDisabled();
    expect(
      screen.getByText(/global Faculty role identifies a faculty account/i),
    ).toBeInTheDocument();
  });

  it('assigns a selected club head scope', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<RoleAssignmentForm {...props} />);

    await user.selectOptions(screen.getByLabelText('Club'), 'club-1');
    await user.click(screen.getByRole('button', { name: 'Assign Club Head' }));

    expect(props.onAssignClubHead).toHaveBeenCalledWith('club-1');
  });

  it('confirms before revoking an existing assignment', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    props.assignments = [
      {
        id: 'assignment-1',
        user_id: 'user-1',
        role_id: 'role-head',
        club_id: 'club-1',
        assigned_by: null,
        created_at: '',
        status: 'active',
        deactivated_at: null,
        deactivated_by: null,
      },
    ];
    render(<RoleAssignmentForm {...props} />);

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(window.confirm).toHaveBeenCalled();
    expect(props.onRevokeClubHead).toHaveBeenCalledWith('club-1');
  });

  it('assigns a Faculty Coordinator to a selected club', async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<RoleAssignmentForm {...props} />);

    await user.selectOptions(screen.getByLabelText('Faculty club'), 'club-1');
    await user.click(screen.getByRole('button', { name: 'Assign Faculty Coordinator' }));

    expect(props.onAssignFacultyCoordinator).toHaveBeenCalledWith('club-1');
  });

  it('shows an assignment error', () => {
    const props = { ...baseProps(), error: 'Only an admin can assign club heads.' };
    render(<RoleAssignmentForm {...props} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Only an admin can assign club heads.');
  });
});
