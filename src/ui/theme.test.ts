import { describe, expect, test } from 'vitest';
import { mixColors, parseColor } from './theme';

describe('bar colours', () => {
  test('reads hex and rgb colours', () => {
    expect(parseColor('#102826')).toEqual([16, 40, 38]);
    expect(parseColor(' #fff ')).toEqual([255, 255, 255]);
    expect(parseColor('rgb(24, 53, 50)')).toEqual([24, 53, 50]);
    expect(parseColor('var(--x)')).toBeNull();
  });

  test('lays the tab bar colour over the background, as the screen shows it', () => {
    expect(mixColors('#ffffff', '#000000', 0.72)).toBe('#b8b8b8');
    expect(mixColors('#183532', '#102826', 0.72)).toBe('#16312f');
    expect(mixColors('oops', '#000000', 0.5)).toBeNull();
  });
});
