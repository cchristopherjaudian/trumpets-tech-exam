export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ValidationIssue {
  path: string;
  message: string;
}

/** Uniform envelope for every non-2xx API response. */
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ReadonlyArray<ValidationIssue>;
  };
}
