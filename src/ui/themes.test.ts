import { contrast, mix, themeVariables, THEME_CHOICES } from './themes';

const AA = 4.5;
const LARGE = 3;

const themed = THEME_CHOICES.filter((choice) => choice.key !== 'modern');
const cases = themed.flatMap(({ key, label }) =>
  (['light', 'dark'] as const).map((mode) => [label, mode, key] as const),
);

test('every theme from the older app is offered', () => {
  expect(THEME_CHOICES.map((choice) => choice.label)).toEqual([
    'Modern',
    'Obsidian Black',
    'Navy + Emerald',
    'Classic Teal',
    'Emerald Green',
    'Sunset Luxe',
    'Forest & Gold',
    'Arctic Glass',
  ]);
});

test('Modern leaves the base tokens alone', () => {
  expect(themeVariables('modern', 'dark')).toEqual({});
});

test.each(cases)('%s in %s mode stays readable', (_, mode, key) => {
  const tokens = themeVariables(key, mode);
  const value = (name: string) => tokens[name] ?? '';
  for (const background of ['--surface', '--surface-raised', '--surface-sunken', '--bg']) {
    expect(contrast(value('--text'), value(background)), `text on ${background}`).toBeGreaterThan(
      AA,
    );
    expect(
      contrast(value('--accent'), value(background)),
      `accent on ${background}`,
    ).toBeGreaterThan(LARGE);
  }
  expect(contrast(value('--muted'), value('--surface')), 'muted').toBeGreaterThan(AA);
  expect(contrast(value('--accent'), value('--surface')), 'accent text').toBeGreaterThan(AA);
  expect(contrast(value('--accent-text'), value('--accent')), 'button text').toBeGreaterThan(AA);
});

test('mix blends colours', () => {
  expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
});
