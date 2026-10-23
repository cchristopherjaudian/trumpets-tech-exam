import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Alert } from '../../../src/components/ui/Alert.js';

describe('Alert', () => {
  it('announces its message as an alert', () => {
    render(<Alert message="Could not load widgets." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load widgets.');
  });

  it('shows no actions when no callbacks are given', () => {
    render(<Alert message="Oops" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers retry and dismiss actions when callbacks are given', async () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    render(<Alert message="Oops" onRetry={onRetry} onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('builds its actions from the shared Button component', () => {
    render(<Alert message="Oops" onRetry={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Retry' })).toHaveClass('button');
  });
});
