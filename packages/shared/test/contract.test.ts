import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  API_ERROR_CODES,
  CreateWidgetRequestSchema,
  MAX_TEXT_LENGTH,
  UpdateWidgetRequestSchema,
  WidgetIdParamsSchema,
  type ApiErrorBody,
  type CreateWidgetRequest,
  type ListWidgetsResponse,
  type UpdateWidgetRequest,
  type Widget,
} from '../src/index.js';

const VALID_ID = '3f2b8c1e-9d4a-4f6b-8e2a-1c5d7f9b0a3e';

describe('MAX_TEXT_LENGTH', () => {
  it('allows 50,000 UTF-16 code units, well above the 10,000 minimum', () => {
    expect(MAX_TEXT_LENGTH).toBe(50_000);
  });
});

describe('UpdateWidgetRequestSchema', () => {
  it.each([
    ['empty', ''],
    ['1,000 characters', 'a'.repeat(1_000)],
    ['10,000 characters', 'b'.repeat(10_000)],
    ['exactly the maximum', 'c'.repeat(MAX_TEXT_LENGTH)],
    ['unicode, emoji and line breaks', 'Café ☕ naïve 🎺🚀\n\tindented  spaces\r\n'],
  ])('accepts %s text unchanged', (_label, text) => {
    const result = UpdateWidgetRequestSchema.safeParse({ text });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ text });
  });

  it('rejects text one unit over the maximum', () => {
    const result = UpdateWidgetRequestSchema.safeParse({ text: 'x'.repeat(MAX_TEXT_LENGTH + 1) });
    expect(result.success).toBe(false);
  });

  it('counts an emoji as two units when enforcing the maximum', () => {
    const text = '🎺'.repeat(MAX_TEXT_LENGTH / 2 + 1);
    expect(UpdateWidgetRequestSchema.safeParse({ text }).success).toBe(false);
  });

  it.each([
    ['a number', { text: 42 }],
    ['null', { text: null }],
    ['an array', { text: ['a'] }],
    ['missing', {}],
    ['a non-object body', 'hello'],
  ])('rejects text that is %s', (_label, body) => {
    const result = UpdateWidgetRequestSchema.safeParse(body);
    expect(result.success).toBe(false);
    expect(result.error?.issues.length).toBeGreaterThan(0);
  });

  it('strips unknown fields', () => {
    expect(UpdateWidgetRequestSchema.parse({ text: 'hi', id: 'nope' })).toEqual({ text: 'hi' });
  });
});

describe('CreateWidgetRequestSchema', () => {
  it('defaults to empty text when the body is missing', () => {
    expect(CreateWidgetRequestSchema.parse(undefined)).toEqual({ text: '' });
  });

  it('defaults to empty text when text is omitted', () => {
    expect(CreateWidgetRequestSchema.parse({})).toEqual({ text: '' });
  });

  it('accepts initial text within the limit', () => {
    expect(CreateWidgetRequestSchema.parse({ text: 'hello' })).toEqual({ text: 'hello' });
  });

  it('rejects non-string or over-limit initial text', () => {
    expect(CreateWidgetRequestSchema.safeParse({ text: 1 }).success).toBe(false);
    expect(
      CreateWidgetRequestSchema.safeParse({ text: 'x'.repeat(MAX_TEXT_LENGTH + 1) }).success,
    ).toBe(false);
  });
});

describe('WidgetIdParamsSchema', () => {
  it('accepts a UUID', () => {
    expect(WidgetIdParamsSchema.parse({ id: VALID_ID })).toEqual({ id: VALID_ID });
  });

  it.each(['', 'abc', '123', `${VALID_ID}x`, 'not-a-uuid-at-all-0000000000000000'])(
    'rejects malformed id %j',
    (id) => {
      expect(WidgetIdParamsSchema.safeParse({ id }).success).toBe(false);
    },
  );
});

describe('API_ERROR_CODES', () => {
  it('lists every error code in the uniform envelope', () => {
    expect(API_ERROR_CODES).toEqual([
      'VALIDATION_ERROR',
      'NOT_FOUND',
      'PAYLOAD_TOO_LARGE',
      'INTERNAL_ERROR',
    ]);
  });
});

describe('contract types', () => {
  it('describe the widget model and payloads', () => {
    expectTypeOf<Widget>().toEqualTypeOf<{
      id: string;
      text: string;
      createdAt: string;
      updatedAt: string;
    }>();
    expectTypeOf<ListWidgetsResponse>().toEqualTypeOf<{ widgets: Widget[] }>();
    expectTypeOf<UpdateWidgetRequest>().toEqualTypeOf<{ text: string }>();
    expectTypeOf<CreateWidgetRequest>().toEqualTypeOf<{ text: string }>();
    expectTypeOf<ApiErrorBody['error']['code']>().toEqualTypeOf<
      'VALIDATION_ERROR' | 'NOT_FOUND' | 'PAYLOAD_TOO_LARGE' | 'INTERNAL_ERROR'
    >();
  });
});
