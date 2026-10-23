import { useId, type ReactNode } from 'react';
import { cx, type BaseProps } from './types.js';

export interface WidgetFrameProps extends BaseProps {
  title: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** Bordered container shared by every widget type. */
export function WidgetFrame({ title, actions, footer, children, className, ...rest }: WidgetFrameProps) {
  const titleId = useId();

  return (
    <section {...rest} aria-labelledby={titleId} className={cx('widget-frame', className)}>
      <header className="widget-frame__header">
        <h2 id={titleId} className="widget-frame__title">
          {title}
        </h2>
        {actions}
      </header>
      {children}
      {footer && <footer className="widget-frame__footer">{footer}</footer>}
    </section>
  );
}
