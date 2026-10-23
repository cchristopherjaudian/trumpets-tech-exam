import type { ApiErrorCode } from '@text-widgets/shared';

export type ApiError =
  | { kind: 'http'; status: number; code: ApiErrorCode; message: string }
  | { kind: 'network'; message: string };

export type Result<T, E = ApiError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
