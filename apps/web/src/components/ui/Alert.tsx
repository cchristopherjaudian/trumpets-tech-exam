import { Button } from './Button.js';
import { cx, type BaseProps } from './types.js';

export interface AlertProps extends BaseProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function Alert({ message, onRetry, onDismiss, className, ...rest }: AlertProps) {
  const hasActions = Boolean(onRetry ?? onDismiss);

  return (
    <div {...rest} role="alert" className={cx('alert', className)}>
      <span>{message}</span>
      {hasActions && (
        <span className="alert__actions">
          {onRetry && <Button onClick={onRetry}>Retry</Button>}
          {onDismiss && <Button onClick={onDismiss}>Dismiss</Button>}
        </span>
      )}
    </div>
  );
}
