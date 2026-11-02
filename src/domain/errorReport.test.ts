import { firstAppFrame, safeRoute, sanitizeMessage } from './errorReport';

test('messages lose amounts, emails, quoted text and numbers', () => {
  const cleaned = sanitizeMessage(
    `Cannot save "Alex Morgan" salary ₹1,45,000 for alex@example.com on 2026-03-01 id 'abc123'`,
  );
  expect(cleaned).toBe('Cannot save [text] salary [amount] for [email] on # id [text]');
  for (const secret of ['Alex', '145', 'example.com', '2026', 'abc123']) {
    expect(cleaned).not.toContain(secret);
  }
});

test('long messages are cut', () => {
  expect(sanitizeMessage('x'.repeat(500))).toHaveLength(160);
});

test('only the app file and line are kept from a stack', () => {
  const stack = 'Error\n at https://finance-trackerp.web.app/assets/index-abc.js:12:900\n at x';
  expect(firstAppFrame(stack)).toBe('index-abc.js:12');
  expect(firstAppFrame('Error\n at somewhere')).toBe('');
  expect(firstAppFrame(undefined)).toBe('');
});

test('routes drop anything after the path', () => {
  expect(safeRoute('/cash-flow?x=1#y')).toBe('/cash-flow');
});
