import { useTheme } from './theme';
import { THEME_CHOICES } from './themes';
import ui from './ui.module.css';

/** Light or dark mode and the colour theme, kept on this device. */
export function AppearanceChoice() {
  const { theme, toggle, palette, setPalette } = useTheme();
  return (
    <div className={ui.page}>
      <div className={ui.split}>
        <span>
          Mode: <strong>{theme === 'dark' ? 'Dark' : 'Light'}</strong>
        </span>
        <button className={ui.quiet} onClick={toggle} type="button">
          Switch to {theme === 'dark' ? 'light' : 'dark'} mode
        </button>
      </div>
      <div className={ui.themeGrid} role="group" aria-label="Color themes">
        {THEME_CHOICES.map(({ key, label, swatches }) => (
          <button
            aria-pressed={palette === key}
            className={ui.themeChoice}
            key={key}
            onClick={() => setPalette(key)}
            type="button"
          >
            <span aria-hidden="true" className={ui.themeSwatches}>
              {swatches.map((color) => (
                <i key={color} style={{ background: color }} />
              ))}
            </span>
            {label}
          </button>
        ))}
      </div>
      <p className={ui.caption}>Your choice is saved on this device.</p>
    </div>
  );
}
