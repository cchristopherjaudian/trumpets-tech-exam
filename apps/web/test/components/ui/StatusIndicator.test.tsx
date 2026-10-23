import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SaveStatus } from '../../../src/autosave/save-status.js';
import { StatusIndicator } from '../../../src/components/ui/StatusIndicator.js';

describe('StatusIndicator', () => {
  it.each<[SaveStatus, string]>([
    ['saved', 'Saved'],
    ['pending', 'Unsaved changes'],
    ['saving', 'Saving…'],
    ['error', 'Save failed'],
  ])('shows %s as "%s"', (status, label) => {
    render(<StatusIndicator status={status} />);

    const indicator = screen.getByRole('status');
    expect(indicator).toHaveTextContent(label);
    expect(indicator).toHaveClass('status', `status--${status}`);
  });

  it('announces changes politely to assistive technology', () => {
    render(<StatusIndicator status="saving" />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('updates its announcement when the status changes', () => {
    const { rerender } = render(<StatusIndicator status="saving" />);
    rerender(<StatusIndicator status="saved" />);

    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });
});
