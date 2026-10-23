import { MAX_TEXT_LENGTH } from '@text-widgets/shared';
import { useId, type TextareaHTMLAttributes } from 'react';
import { cx } from './types.js';

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value' | 'defaultValue'> {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Keep the label available to assistive technology but hide it visually. */
  hideLabel?: boolean;
  showCount?: boolean;
}

const formatCount = (count: number) => count.toLocaleString('en-US');

/** A generic, labelled, controlled multi-line plain-text input. */
export function TextArea({
  label,
  value,
  onValueChange,
  hideLabel = false,
  showCount = false,
  maxLength = MAX_TEXT_LENGTH,
  className,
  id,
  ...props
}: TextAreaProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const countId = `${inputId}-count`;

  return (
    <div className={cx('text-area', className)}>
      <label htmlFor={inputId} className={cx(hideLabel && 'visually-hidden')}>
        {label}
      </label>
      <textarea
        {...props}
        id={inputId}
        value={value}
        maxLength={maxLength}
        aria-describedby={showCount ? countId : undefined}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {showCount && (
        <span id={countId} className="text-area__count">
          {formatCount(value.length)} / {formatCount(maxLength)}
        </span>
      )}
    </div>
  );
}
