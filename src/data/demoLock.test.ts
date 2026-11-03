import { describe, expect, test } from 'vitest';
import { createDemoLock } from './crypto';

describe('the demo lock', () => {
  test('scrambles text differently every time, and opens it again', async () => {
    const demo = await createDemoLock();
    const first = await demo.lock('Salary ₹25,000');
    const second = await demo.lock('Salary ₹25,000');
    expect(first.c).not.toContain('Salary');
    expect(first.c).not.toBe(second.c);
    expect(await demo.open(first)).toBe('Salary ₹25,000');
  });

  test("one key can't open another's text", async () => {
    const mine = await createDemoLock();
    const theirs = await createDemoLock();
    await expect(theirs.open(await mine.lock('Secret'))).rejects.toThrow();
  });
});
