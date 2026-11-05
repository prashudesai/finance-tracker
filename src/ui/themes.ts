export type ThemeMode = 'light' | 'dark';

interface Palette {
  label: string;
  swatches: string[];
  /** Header gradient, then accent, for dark mode. */
  darkHeader: [string, string];
  darkAccent: string;
  /** Page tint, then accent, for light mode. */
  lightBg: string;
  lightAccent: string;
}

/** Colours carried over from the older app. Modern uses the tokens in tokens.css. */
export const PALETTES = {
  'navy-emerald': {
    label: 'Navy + Emerald',
    swatches: ['#127c70', '#1e3346', '#d5a85f', '#e5f2ef'],
    darkHeader: ['#1e3346', '#142638'],
    darkAccent: '#55c4a0',
    lightBg: '#e5f2ef',
    lightAccent: '#127c70',
  },
  'classic-teal': {
    label: 'Classic Teal',
    swatches: ['#0f7c7e', '#084b4d', '#d4976f', '#e8f5f5'],
    darkHeader: ['#0b3f40', '#062a2b'],
    darkAccent: '#5eead4',
    lightBg: '#e8f5f5',
    lightAccent: '#0f7c7e',
  },
  'emerald-green': {
    label: 'Emerald Green',
    swatches: ['#059669', '#064e3b', '#34d399', '#d1fae5'],
    darkHeader: ['#064e3b', '#032d22'],
    darkAccent: '#34d399',
    lightBg: '#ecfdf5',
    lightAccent: '#047857',
  },
  'sunset-luxe': {
    label: 'Sunset Luxe',
    swatches: ['#e6536f', '#8f2749', '#f5a65b', '#ffe4e6'],
    darkHeader: ['#63253b', '#3c1729'],
    darkAccent: '#fb7185',
    lightBg: '#fff1f2',
    lightAccent: '#c2415d',
  },
  'forest-gold': {
    label: 'Forest & Gold',
    swatches: ['#357a57', '#1f5139', '#d4a72c', '#dcfce7'],
    darkHeader: ['#163d2b', '#0b281c'],
    darkAccent: '#86efac',
    lightBg: '#f0fdf4',
    lightAccent: '#357a57',
  },
  'arctic-glass': {
    label: 'Arctic Glass',
    swatches: ['#0e7490', '#164e63', '#67e8f9', '#cffafe'],
    darkHeader: ['#0b3e52', '#062a39'],
    darkAccent: '#67e8f9',
    lightBg: '#ecfeff',
    lightAccent: '#0e7490',
  },
} satisfies Record<string, Palette>;

export const THEME_CHOICES = [
  {
    key: 'modern',
    label: 'Modern',
    swatches: ['#102826', '#183532', '#69d6bb', '#e0a13a'],
  },
  {
    key: 'obsidian-black',
    label: 'Obsidian Black',
    swatches: ['#000000', '#171717', '#a3e6cd', '#a3a3a3'],
  },
  ...Object.entries(PALETTES).map(([key, palette]) => ({
    key,
    label: palette.label,
    swatches: palette.swatches,
  })),
];

export type ThemeKey = string;

function channels(hex: string) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

/** Mixes two hex colours. `amount` is the share of `b`. */
export function mix(a: string, b: string, amount: number) {
  const other = channels(b);
  const mixed = channels(a).map((value, index) =>
    Math.round(value + ((other[index] ?? 0) - value) * amount),
  );
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function alpha(hex: string, opacity: number) {
  return `rgb(${channels(hex).join(' ')} / ${opacity}%)`;
}

export function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const [red = 0, green = 0, blue = 0] = channels(hex).map((value) => {
      const scaled = value / 255;
      return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const DARK_TEXT = '#edf3f1';
const LIGHT_TEXT = '#14211d';

function darkTokens(bg: string, surface: string, raised: string, sunken: string, accent: string) {
  return {
    '--bg': bg,
    '--bg-glow': alpha(accent, 12),
    '--surface': surface,
    '--surface-raised': raised,
    '--surface-sunken': sunken,
    '--text': DARK_TEXT,
    '--muted': mix(DARK_TEXT, surface, 0.28),
    '--border': alpha(accent, 22),
    '--border-strong': alpha(accent, 36),
    '--accent': accent,
    '--accent-soft': alpha(accent, 15),
    '--accent-text': '#0f172a',
    '--hero': `radial-gradient(120% 90% at 100% 0%, ${alpha(accent, 42)}, transparent 62%), linear-gradient(115deg, ${sunken}, ${raised})`,
    '--hero-edge': alpha(accent, 55),
  };
}

function lightTokens(bg: string, accent: string) {
  return {
    '--bg': bg,
    '--bg-glow': alpha(accent, 10),
    '--surface': '#ffffff',
    '--surface-raised': mix('#ffffff', accent, 0.04),
    '--surface-sunken': mix(bg, accent, 0.06),
    '--text': LIGHT_TEXT,
    '--muted': mix(LIGHT_TEXT, '#ffffff', 0.32),
    '--border': mix('#ffffff', accent, 0.16),
    '--border-strong': mix('#ffffff', accent, 0.32),
    '--accent': accent,
    '--accent-soft': alpha(accent, 11),
    '--accent-text': '#ffffff',
    '--hero': `radial-gradient(120% 90% at 100% 0%, ${alpha(accent, 30)}, transparent 62%), linear-gradient(115deg, #ffffff, ${mix('#ffffff', accent, 0.06)})`,
    '--hero-edge': mix('#ffffff', accent, 0.45),
  };
}

/** CSS variables for a theme. Modern returns none, so tokens.css applies. */
export function themeVariables(key: ThemeKey, mode: ThemeMode): Record<string, string> {
  if (key === 'obsidian-black') {
    return mode === 'dark'
      ? darkTokens('#000000', '#171717', '#262626', '#0a0a0a', '#a3e6cd')
      : lightTokens('#ededed', '#18765b');
  }
  const palette = (PALETTES as Record<string, Palette>)[key];
  if (!palette) return {};
  if (mode === 'light') return lightTokens(palette.lightBg, palette.lightAccent);
  const [from, to] = palette.darkHeader;
  return darkTokens(
    mix(to, '#000000', 0.25),
    mix(from, to, 0.45),
    from,
    mix(to, '#000000', 0.15),
    palette.darkAccent,
  );
}

const ALL_VARIABLES = Object.keys(themeVariables('obsidian-black', 'dark'));

/** Applies a theme to the page, clearing whatever the last one set. */
export function applyThemeVariables(root: HTMLElement, key: ThemeKey, mode: ThemeMode) {
  for (const name of ALL_VARIABLES) root.style.removeProperty(name);
  const variables = themeVariables(key, mode);
  for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value);
  const accent = variables['--accent'] ?? (mode === 'dark' ? '#69d6bb' : '#0a7d62');
  const stroke = encodeURIComponent(accent);
  root.style.setProperty(
    '--select-arrow',
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='${stroke}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E")`,
  );
}
