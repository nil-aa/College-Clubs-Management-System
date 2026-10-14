import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ClubForm } from './ClubForm';

describe('ClubForm', () => {
  it('shows validation errors and does not submit invalid data', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ClubForm onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Create club' }));
    expect(screen.getByText('Enter a club name.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows a server duplicate-name error', () => {
    render(<ClubForm onSubmit={vi.fn()} serverError="A club with this name already exists." />);
    expect(screen.getByRole('alert')).toHaveTextContent('already exists');
  });
});
