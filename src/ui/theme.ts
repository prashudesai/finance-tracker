import { create } from 'zustand';
import { applyThemeVariables, THEME_CHOICES, type ThemeKey, type ThemeMode } from './themes';

const MODE_KEY = 'theme';
const PALETTE_KEY = 'colorTheme';

function saved(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The choice still applies for this visit.
  }
}

function initialMode(): ThemeMode {
  const value = saved(MODE_KEY);
  if (value === 'light' || value === 'dark') return value;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function initialPalette(): ThemeKey {
  const value = saved(PALETTE_KEY);
  return THEME_CHOICES.some((choice) => choice.key === value) && value ? value : 'modern';
}

/** Red, green and blue of a #rgb, #rrggbb or rgb() colour, or null for anything else. */
export function parseColor(value: string): [number, number, number] | null {
  const text = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;
    return [0, 2, 4].map((start) => parseInt(full.slice(start, start + 2), 16)) as [
      number,
      number,
      number,
    ];
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(text);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

/** `top` laid over `bottom` at `share` opacity, as a hex colour. */
export function mixColors(top: string, bottom: string, share: number) {
  const a = parseColor(top);
  const b = parseColor(bottom);
  if (!a || !b) return null;
  return `#${a
    .map((value, index) => Math.round(value * share + (b[index] ?? 0) * (1 - share)))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Matches the phone's own bars to the theme: the browser bar to the app's tab bar. */
function paintBars(root: HTMLElement) {
  const style = getComputedStyle(root);
  const bg = style.getPropertyValue('--bg');
  const surface = style.getPropertyValue('--surface');
  // The tab bar is the surface colour at 72% over the background.
  const bar = mixColors(surface, bg, 0.72) ?? bg.trim();
  if (bg.trim()) root.style.backgroundColor = bg.trim();
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  if (bar) meta.content = bar;
}

function paint(mode: ThemeMode, palette: ThemeKey) {
  const root = document.documentElement;
  root.dataset.theme = mode;
  applyThemeVariables(root, palette, mode);
  paintBars(root);
  // On first load the stylesheet may not be in yet, so the bars are painted again once it is.
  requestAnimationFrame(() => paintBars(root));
}

window.addEventListener('load', () => paintBars(document.documentElement));

interface ThemeState {
  theme: ThemeMode;
  palette: ThemeKey;
  toggle(): void;
  setPalette(palette: ThemeKey): void;
}

/** One shared choice, so the header and Settings always agree. Saved per device. */
export const useTheme = create<ThemeState>((set, get) => ({
  theme: initialMode(),
  palette: initialPalette(),
  toggle() {
    const theme = get().theme === 'dark' ? 'light' : 'dark';
    save(MODE_KEY, theme);
    paint(theme, get().palette);
    set({ theme });
  },
  setPalette(palette) {
    save(PALETTE_KEY, palette);
    paint(get().theme, palette);
    set({ palette });
  },
}));

// Applied on load, before anything renders, so a saved theme never flashes.
paint(useTheme.getState().theme, useTheme.getState().palette);
