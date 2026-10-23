import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Vitest globals are disabled, so Testing Library cannot register its own auto-cleanup.
afterEach(() => {
  cleanup();
});

// Testing Library only recognises Jest's fake timers: after each user-event interaction it
// waits on a setTimeout(0) and advances it via `jest.advanceTimersByTime`. Under Vitest's fake
// timers that timer would never fire, so forward the call to Vitest.
Object.assign(globalThis, {
  jest: { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) },
});
