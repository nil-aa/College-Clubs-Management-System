import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Can } from './Can';

const permissionState = vi.hoisted(() => ({ allowed: false, loading: false }));

vi.mock('../hooks/usePermission', () => ({
  usePermission: () => permissionState,
}));

describe('Can', () => {
  beforeEach(() => {
    permissionState.allowed = false;
    permissionState.loading = false;
  });

  it('renders children only when the permission is granted', async () => {
    permissionState.allowed = true;
    render(<Can permission="roles.manage">Admin action</Can>);
    await waitFor(() => expect(screen.getByText('Admin action')).toBeInTheDocument());
  });

  it('renders the fallback while access is unavailable', () => {
    render(
      <Can fallback={<span>Not available</span>} permission="roles.manage">
        Admin action
      </Can>,
    );
    expect(screen.queryByText('Admin action')).not.toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeInTheDocument();
  });
});
