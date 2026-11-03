import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  EllipsisVertical,
  History,
  Lock,
  MonitorDown,
  Play,
  Plus,
  Pointer,
  Search,
  Settings,
  Share,
  SquarePlus,
  Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import ui from '../../ui/ui.module.css';
import styles from './InstallGuide.module.css';

export type Platform = 'ios' | 'android' | 'desktop';

/** What happens at a step: the finger taps a target, or the app lands somewhere. */
type Action = 'share' | 'menu' | 'target' | 'ok' | 'home' | 'window';

interface Step {
  title: string;
  hint: string;
  action: Action;
}

const STEPS: Record<Platform, Step[]> = {
  ios: [
    {
      title: 'Tap Share',
      hint: 'The square with an arrow, at the bottom of Safari.',
      action: 'share',
    },
    {
      title: 'Tap Add to Home Screen',
      hint: 'Scroll down the list if you don’t see it.',
      action: 'target',
    },
    { title: 'Tap Add', hint: 'Top right corner.', action: 'ok' },
    {
      title: 'Done',
      hint: 'Finance Tracker opens from your home screen, full screen, like any app.',
      action: 'home',
    },
  ],
  android: [
    { title: 'Tap the menu', hint: 'The three dots, top right in Chrome.', action: 'menu' },
    { title: 'Tap Install app', hint: 'Some phones say Add to Home screen.', action: 'target' },
    { title: 'Tap Install', hint: 'In the box that opens.', action: 'ok' },
    {
      title: 'Done',
      hint: 'It sits with your other apps and opens without the browser.',
      action: 'home',
    },
  ],
  desktop: [
    {
      title: 'Click the install icon',
      hint: 'The small screen with an arrow, at the right of the address bar in Chrome or Edge.',
      action: 'menu',
    },
    {
      title: 'Click Install',
      hint: 'On a Mac with Safari, choose File, then Add to Dock.',
      action: 'ok',
    },
    {
      title: 'Done',
      hint: 'It opens in its own window, from your dock, taskbar or Start menu.',
      action: 'window',
    },
  ],
};

const LABELS: Record<Platform, string> = { ios: 'iPhone', android: 'Android', desktop: 'Computer' };
const STEP_MS = 2300;
const TAP_MS = 650;
const RESULT_MS = 1050;

/** The likeliest platform for this browser. iPads count as iPhones, since Safari is the same. */
export function detectPlatform(userAgent = navigator.userAgent): Platform {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return 'desktop';
}

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

interface Scene {
  step: number;
  finger: { x: number; y: number } | null;
  taps: number;
  lit: boolean;
  sheet: boolean;
  dialog: boolean;
  landed: boolean;
}

const START: Scene = {
  step: 0,
  finger: null,
  taps: 0,
  lit: false,
  sheet: false,
  dialog: false,
  landed: false,
};

const AppIcon = ({ small = false }: { small?: boolean }) => (
  <span className={small ? styles.appIconSmall : styles.appIcon}>
    <Wallet aria-hidden="true" size={small ? 9 : 18} />
  </span>
);

function Row({
  icon,
  label,
  target = false,
  lit = false,
}: {
  icon: ReactNode;
  label: string;
  target?: boolean;
  lit?: boolean;
}) {
  return (
    <div className={lit ? styles.rowLit : styles.row} data-target={target ? 'target' : undefined}>
      {icon}
      {label}
    </div>
  );
}

/** Shows, with a finger tapping each button, how to install the app on each kind of device. */
export function InstallGuide({ initial = detectPlatform() }: { initial?: Platform }) {
  const [platform, setPlatform] = useState<Platform>(initial);
  const [still] = useState(reducedMotion);
  const steps = STEPS[platform];
  const [scene, setScene] = useState<Scene>(START);
  const [run, setRun] = useState(0);
  const screen = useRef<HTMLDivElement>(null);

  const pointAt = useCallback((target: string) => {
    const box = screen.current;
    const element = box?.querySelector<HTMLElement>(`[data-target="${target}"]`);
    if (!box || !element) return null;
    const outer = box.getBoundingClientRect();
    const inner = element.getBoundingClientRect();
    return {
      x: inner.left - outer.left + inner.width / 2,
      y: inner.top - outer.top + inner.height / 2,
    };
  }, []);

  // Plays the steps once. Changing device or Replay starts again.
  useEffect(() => {
    if (still) {
      setScene({ ...START, step: steps.length, landed: true });
      return;
    }
    setScene(START);
    const timers: number[] = [];
    const at = (ms: number, change: () => void) => timers.push(window.setTimeout(change, ms));
    steps.forEach(({ action }, index) => {
      const start = 500 + index * STEP_MS;
      if (action === 'home' || action === 'window') {
        at(start, () => setScene((now) => ({ ...now, step: index, finger: null, landed: true })));
        at(start + 1200, () => setScene((now) => ({ ...now, step: steps.length })));
        return;
      }
      at(start, () => setScene((now) => ({ ...now, step: index, finger: pointAt(action) })));
      at(start + TAP_MS, () =>
        setScene((now) => ({ ...now, taps: now.taps + 1, lit: action === 'target' || now.lit })),
      );
      at(start + RESULT_MS, () =>
        setScene((now) => {
          if (action === 'ok') return { ...now, dialog: false };
          if (action === 'target' || (action === 'menu' && platform === 'desktop')) {
            return { ...now, sheet: false, dialog: true };
          }
          return { ...now, sheet: true };
        }),
      );
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [platform, pointAt, run, steps, still]);

  const desktop = platform === 'desktop';
  const urlIcon =
    platform === 'android' ? (
      <EllipsisVertical data-target="menu" size={14} />
    ) : desktop ? (
      <MonitorDown data-target="menu" size={14} />
    ) : null;

  return (
    <div className={styles.guide}>
      <div className={styles.top}>
        <div aria-label="Your device" className={ui.segmented} role="group">
          {(Object.keys(STEPS) as Platform[]).map((key) => (
            <button
              aria-pressed={platform === key}
              className={platform === key ? ui.segmentActive : ui.segment}
              key={key}
              onClick={() => setPlatform(key)}
              type="button"
            >
              {LABELS[key]}
            </button>
          ))}
        </div>
        {still ? null : (
          <button className={ui.quiet} onClick={() => setRun(run + 1)} type="button">
            <Play aria-hidden="true" size={14} /> Replay
          </button>
        )}
      </div>
      <div className={styles.body}>
        <div aria-hidden="true" className={desktop ? styles.sceneComputer : styles.scenePhone}>
          {desktop ? <span className={styles.stand} /> : null}
          <div className={styles.frame}>
            <div className={styles.screen} ref={screen}>
              {desktop ? null : <span className={styles.notch} />}
              <div className={styles.url}>
                <Lock size={12} />
                <span>finance-trackerp.web.app</span>
                {urlIcon}
              </div>
              <div className={styles.site}>
                <div className={styles.hero}>₹ 24,80,000</div>
                <div className={styles.card} />
                <div className={styles.card} />
                <div className={styles.card} />
              </div>
              {platform === 'ios' ? (
                <div className={styles.toolbar}>
                  <ChevronLeft size={16} />
                  <ChevronRight size={16} />
                  <Share data-target="share" size={16} />
                  <Bookmark size={16} />
                  <Copy size={16} />
                </div>
              ) : null}
              {desktop ? null : (
                <div className={scene.sheet ? styles.sheetUp : styles.sheet}>
                  {platform === 'ios' ? (
                    <>
                      <span className={styles.grab} />
                      <Row icon={<Copy size={14} />} label="Copy" />
                      <Row icon={<Bookmark size={14} />} label="Add Bookmark" />
                      <Row
                        icon={<SquarePlus size={14} />}
                        label="Add to Home Screen"
                        lit={scene.lit}
                        target
                      />
                      <Row icon={<Search size={14} />} label="Find on Page" />
                    </>
                  ) : (
                    <>
                      <Row icon={<Plus size={14} />} label="New tab" />
                      <Row icon={<History size={14} />} label="History" />
                      <Row
                        icon={<Download size={14} />}
                        label="Install app"
                        lit={scene.lit}
                        target
                      />
                      <Row icon={<Settings size={14} />} label="Settings" />
                    </>
                  )}
                </div>
              )}
              <div className={scene.dialog ? styles.dialogUp : styles.dialog}>
                <div className={styles.dialogBox}>
                  {platform === 'ios' ? (
                    <div className={styles.dialogHead}>
                      <span className={styles.link}>Cancel</span>
                      <span>Add to Home Screen</span>
                      <span className={styles.link} data-target="ok">
                        Add
                      </span>
                    </div>
                  ) : (
                    <div className={styles.dialogHead}>
                      <span>Install app?</span>
                    </div>
                  )}
                  <div className={styles.dialogApp}>
                    <AppIcon />
                    <span>Finance Tracker</span>
                  </div>
                  {platform === 'ios' ? null : (
                    <div className={styles.dialogActions}>
                      <span>Cancel</span>
                      <span className={styles.installButton} data-target="ok">
                        Install
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {desktop ? (
                <div className={scene.landed ? styles.windowUp : styles.window}>
                  <div className={styles.windowBar}>
                    <AppIcon small /> Finance Tracker
                  </div>
                  <div className={styles.hero}>₹ 24,80,000</div>
                  <div className={styles.card} />
                </div>
              ) : (
                <div className={scene.landed ? styles.homeUp : styles.home}>
                  {Array.from({ length: 8 }, (_, index) =>
                    index === 5 ? (
                      <span className={styles.homeApp} key={index}>
                        <Wallet size={20} />
                      </span>
                    ) : (
                      <span className={styles.homeOther} key={index} />
                    ),
                  )}
                  <small>Finance Tracker</small>
                </div>
              )}
              {scene.finger ? (
                <>
                  <span
                    className={styles.ripple}
                    key={`ripple-${scene.taps}`}
                    style={{ left: scene.finger.x, top: scene.finger.y }}
                  />
                  <Pointer
                    className={styles.finger}
                    key={`finger-${scene.taps}`}
                    size={28}
                    style={{ left: scene.finger.x - 9, top: scene.finger.y - 3 }}
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
        <ol className={styles.steps}>
          {steps.map(({ title, hint }, index) => {
            const state =
              index < scene.step
                ? styles.stepDone
                : index === scene.step
                  ? styles.stepOn
                  : styles.step;
            return (
              <li
                aria-current={index === scene.step ? 'step' : undefined}
                className={state}
                key={title}
              >
                <span className={styles.number}>
                  {index < scene.step ? <Check aria-label="Done" size={14} /> : index + 1}
                </span>
                <div>
                  <strong>{title}</strong>
                  <span>{hint}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
