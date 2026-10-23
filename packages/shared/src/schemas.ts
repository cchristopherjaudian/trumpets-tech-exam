import { z } from 'zod';
import { MAX_TEXT_LENGTH } from './constants.js';

// Measured with `String.length` (UTF-16 code units) rather than zod's `.max()`, which counts
// code points. This keeps the server limit identical to the textarea's `maxlength`.
const widgetText = z
  .string()
  .refine((text) => text.length <= MAX_TEXT_LENGTH, {
    message: `Text must be at most ${MAX_TEXT_LENGTH} characters`,
  });

/** Body of `POST /api/widgets`. The body itself is optional; text defaults to empty. */
export const CreateWidgetRequestSchema = z
  .object({ text: widgetText.default('') })
  .prefault({});

/** Body of `PATCH /api/widgets/:id`. */
export const UpdateWidgetRequestSchema = z.object({ text: widgetText });

/** Route params for endpoints addressing a single widget. */
export const WidgetIdParamsSchema = z.object({ id: z.uuid() });

export type CreateWidgetRequest = z.output<typeof CreateWidgetRequestSchema>;
export type UpdateWidgetRequest = z.output<typeof UpdateWidgetRequestSchema>;
export type WidgetIdParams = z.output<typeof WidgetIdParamsSchema>;
