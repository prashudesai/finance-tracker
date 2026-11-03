import { describe, expect, test } from 'vitest';
import { DAILY_LIMIT_MESSAGE, plainError } from './errors';

const coded = (code: string) => Object.assign(new Error('raw library text'), { code });

describe('plainError', () => {
  test('explains the free plan daily limit', () => {
    expect(plainError(coded('resource-exhausted'), 'Fallback')).toBe(DAILY_LIMIT_MESSAGE);
  });

  test('keeps the app’s own messages and hides library ones', () => {
    expect(plainError(new Error('Enter a name.'), 'Fallback')).toBe('Enter a name.');
    expect(plainError(coded('permission-denied'), 'Fallback')).toBe('Fallback');
  });
});
