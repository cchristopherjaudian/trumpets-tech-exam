import type { ValidationIssue } from '@text-widgets/shared';
import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { validationError } from '../errors.js';

type RouteParams = Record<string, string>;

interface RequestSchemas<P extends RouteParams, B> {
  params?: z.ZodType<P>;
  body?: z.ZodType<B>;
}

/**
 * Validates route params and/or the JSON body against shared zod schemas before the handler
 * runs, replacing them with the parsed output. All issues are reported together as a 400.
 */
export function validate<P extends RouteParams = RouteParams, B = unknown>(
  schemas: RequestSchemas<P, B>,
): RequestHandler<P, unknown, B> {
  return (req, _res, next) => {
    const issues: ValidationIssue[] = [];

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (result.success) req.params = result.data;
      else issues.push(...toValidationIssues(result.error));
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (result.success) req.body = result.data;
      else issues.push(...toValidationIssues(result.error));
    }

    if (issues.length > 0) {
      throw validationError('Request validation failed', issues);
    }
    next();
  };
}

function toValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}
