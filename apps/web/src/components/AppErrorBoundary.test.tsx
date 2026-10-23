import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

function BrokenPage(): never {
  throw new Error('private implementation detail');
}

describe('AppErrorBoundary', () => {
  it('shows a safe recovery screen after a render failure', () => {
    const original = console.error;
    console.error = () => undefined;
    try {
      render(
        <AppErrorBoundary>
          <BrokenPage />
        </AppErrorBoundary>,
      );
      expect(screen.getByRole('alert')).toHaveTextContent('This page ran into a problem');
      expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
      expect(screen.queryByText('private implementation detail')).not.toBeInTheDocument();
    } finally {
      console.error = original;
    }
  });
});
