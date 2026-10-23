/** Props every UI primitive accepts in addition to its own. */
export interface BaseProps {
  className?: string;
  'data-testid'?: string;
}

/** Joins class names, skipping empty values. */
export const cx = (...classNames: Array<string | false | undefined>) =>
  classNames.filter(Boolean).join(' ');
