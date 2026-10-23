import { MAX_TEXT_LENGTH } from '@text-widgets/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TextArea, type TextAreaProps } from '../../../src/components/ui/TextArea.js';

type HarnessProps = Omit<TextAreaProps, 'value' | 'onValueChange'> & {
  initialValue?: string;
  onValueChange?: (value: string) => void;
};

/** Controlled wrapper so tests exercise the component the way callers use it. */
function Harness({ initialValue = '', onValueChange, ...props }: HarnessProps) {
  const [value, setValue] = useState(initialValue);
  return (
    <TextArea
      {...props}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
    />
  );
}

describe('TextArea', () => {
  it('is a textbox labelled by its visible label', () => {
    render(<Harness label="Widget text" />);

    expect(screen.getByLabelText('Widget text')).toBe(screen.getByRole('textbox'));
    expect(screen.getByText('Widget text')).not.toHaveClass('visually-hidden');
  });

  it('can visually hide its label while keeping it accessible', () => {
    render(<Harness label="Widget text" hideLabel />);

    expect(screen.getByRole('textbox', { name: 'Widget text' })).toBeInTheDocument();
    expect(screen.getByText('Widget text')).toHaveClass('visually-hidden');
  });

  it('reports each change as a plain string value', async () => {
    const onValueChange = vi.fn();
    render(<Harness label="Text" onValueChange={onValueChange} />);

    await userEvent.type(screen.getByRole('textbox'), 'ab');

    expect(onValueChange).toHaveBeenNthCalledWith(1, 'a');
    expect(onValueChange).toHaveBeenLastCalledWith('ab');
  });

  it('preserves line breaks and surrounding whitespace exactly', async () => {
    const onValueChange = vi.fn();
    render(<Harness label="Text" onValueChange={onValueChange} />);

    await userEvent.type(screen.getByRole('textbox'), '  line one{Enter}{Enter}\tline two  ');

    expect(onValueChange).toHaveBeenLastCalledWith('  line one\n\n\tline two  ');
    expect(screen.getByRole('textbox')).toHaveValue('  line one\n\n\tline two  ');
  });

  it('accepts 10,000 characters in one input', () => {
    const onValueChange = vi.fn();
    const text = 'x'.repeat(10_000);
    render(<Harness label="Text" onValueChange={onValueChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });

    expect(onValueChange).toHaveBeenCalledWith(text);
    expect(screen.getByRole('textbox')).toHaveValue(text);
  });

  it('enforces the shared maximum length by default and allows overriding it', () => {
    const { rerender } = render(<TextArea label="Text" value="" onValueChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', String(MAX_TEXT_LENGTH));

    rerender(<TextArea label="Text" value="" onValueChange={vi.fn()} maxLength={10} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '10');
  });

  it('shows a character counter linked to the textbox when requested', () => {
    render(<Harness label="Text" initialValue={'y'.repeat(1_234)} showCount />);

    const counter = screen.getByText('1,234 / 50,000');
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription('1,234 / 50,000');
    expect(counter).toHaveClass('text-area__count');
  });

  it('hides the counter by default', () => {
    render(<Harness label="Text" initialValue="abc" />);

    expect(screen.queryByText(/\/ 50,000/)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby');
  });

  it('forwards native textarea attributes such as onBlur and placeholder', async () => {
    const onBlur = vi.fn();
    render(<Harness label="Text" placeholder="Start typing…" onBlur={onBlur} />);

    const textbox = screen.getByPlaceholderText('Start typing…');
    await userEvent.click(textbox);
    await userEvent.tab();

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('generates unique ids so multiple instances stay correctly labelled', () => {
    render(
      <>
        <Harness label="First" />
        <Harness label="Second" />
      </>,
    );

    expect(screen.getByRole('textbox', { name: 'First' })).not.toBe(
      screen.getByRole('textbox', { name: 'Second' }),
    );
  });
});
