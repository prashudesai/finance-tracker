import { describe, expect, test } from 'vitest';
import { deviceName } from './deviceName';

describe('deviceName', () => {
  test('names the phone and browser', () => {
    const iphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
    expect(deviceName(iphone)).toBe('iPhone · Safari');
  });

  test('names Chrome on a Mac, not Safari', () => {
    const mac =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
    expect(deviceName(mac)).toBe('Mac · Chrome');
  });

  test('falls back when it recognises nothing', () => {
    expect(deviceName('something else')).toBe('A new device');
  });
});
