import type { SaveStatus } from '../../autosave/save-status.js';
import { cx, type BaseProps } from './types.js';

const LABELS: Record<SaveStatus, string> = {
  saved: 'Saved',
  pending: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Save failed',
};

export interface StatusIndicatorProps extends BaseProps {
  status: SaveStatus;
}

export function StatusIndicator({ status, className, ...rest }: StatusIndicatorProps) {
  return (
    <span
      {...rest}
      role="status"
      aria-live="polite"
      className={cx('status', `status--${status}`, className)}
    >
      {LABELS[status]}
    </span>
  );
}
