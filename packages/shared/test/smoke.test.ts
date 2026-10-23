import { describe, expect, it } from 'vitest';

describe('shared workspace', () => {
  it('is discovered by the root test runner', () => {
    expect(true).toBe(true);
  });
});
