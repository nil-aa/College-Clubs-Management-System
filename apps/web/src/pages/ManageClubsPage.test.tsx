import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ManageClubsPage } from './ManageClubsPage';

vi.mock('../hooks/usePermission', () => ({
  usePermission: () => ({ allowed: false, loading: false }),
}));

describe('ManageClubsPage', () => {
  it('hides admin actions when the user lacks the admin permission', () => {
    render(<ManageClubsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Only admins can manage clubs.');
    expect(screen.queryByRole('button', { name: 'Create club' })).not.toBeInTheDocument();
  });
});
