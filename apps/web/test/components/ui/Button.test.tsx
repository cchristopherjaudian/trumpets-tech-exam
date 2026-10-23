import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../../src/components/ui/Button.js';

describe('Button', () => {
  it('renders its label and calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add widget</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Add widget' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to a non-submitting button so it never submits surrounding forms', () => {
    render(<Button>Go</Button>);

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it.each(['primary', 'secondary', 'danger'] as const)('applies the %s variant', (variant) => {
    render(<Button variant={variant}>Go</Button>);

    expect(screen.getByRole('button')).toHaveClass('button', `button--${variant}`);
  });

  it('uses the secondary variant by default and keeps custom classes', () => {
    render(<Button className="extra">Go</Button>);

    expect(screen.getByRole('button')).toHaveClass('button', 'button--secondary', 'extra');
  });

  it('supports an accessible label distinct from its visible text', () => {
    render(<Button aria-label="Delete widget 2">✕</Button>);

    expect(screen.getByRole('button', { name: 'Delete widget 2' })).toBeInTheDocument();
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(onClick).not.toHaveBeenCalled();
  });
});
