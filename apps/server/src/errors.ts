import type { ApiErrorCode, ValidationIssue } from '@text-widgets/shared';

/** An error that maps directly onto the uniform API error envelope. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: ReadonlyArray<ValidationIssue>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const validationError = (message: string, details?: ReadonlyArray<ValidationIssue>) =>
  new HttpError(400, 'VALIDATION_ERROR', message, details);

export const notFoundError = (message: string) => new HttpError(404, 'NOT_FOUND', message);
