import type { ApiErrorBody } from '@text-widgets/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError, notFoundError, validationError } from '../errors.js';

export interface Logger {
  error(message: string, error: unknown): void;
}

/** Terminal handler for requests no API route matched. */
export const apiNotFound: RequestHandler = (req) => {
  throw notFoundError(`Route ${req.method} ${req.originalUrl} not found`);
};

/** Maps every error to the uniform envelope. Unexpected errors are logged, never exposed. */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    const httpError = toHttpError(error);
    if (!httpError) {
      logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, error);
    }
    const { status, code, message, details } =
      httpError ?? new HttpError(500, 'INTERNAL_ERROR', 'Internal server error');

    const body: ApiErrorBody = { error: { code, message, ...(details && { details }) } };
    res.status(status).json(body);
  };
}

/** Errors raised by express.json() (body-parser) carry a `type` and a 4xx `status`. */
interface BodyParserError {
  type: string;
  status: number;
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as Partial<BodyParserError>).type === 'string' &&
    typeof (error as Partial<BodyParserError>).status === 'number'
  );
}

function toHttpError(error: unknown): HttpError | undefined {
  if (error instanceof HttpError) return error;
  if (!isBodyParserError(error)) return undefined;

  switch (error.type) {
    case 'entity.too.large':
      return new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    case 'entity.parse.failed':
      return validationError('Malformed JSON body');
    default:
      return error.status >= 400 && error.status < 500
        ? validationError('Unreadable request body')
        : undefined;
  }
}
