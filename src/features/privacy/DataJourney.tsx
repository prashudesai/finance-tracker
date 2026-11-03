import { ArrowRight, Cloud, Eye, KeyRound, Lock, RotateCcw, Smartphone, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import ui from '../../ui/ui.module.css';
import styles from './DataJourney.module.css';

const PLAIN = 'Salary ₹25,000';
const LOCKED = 'x9#Lq7&vT2';
const GLYPHS = 'x9#Lq7&vT2@kP4$zR8%mW';
const STEP_MS = 2600;
const SCRAMBLE_MS = 90;
const SCRAMBLE_TICKS = 9;

const STEPS = [
  { icon: Smartphone, title: 'You type it', caption: 'On your own phone.' },
  { icon: Lock, title: 'Your phone locks it', caption: 'Locked before it leaves your phone.' },
  {
    icon: Cloud,
    title: 'Stored online, locked',
    caption: "Google and the app's owner only ever see this.",
  },
  { icon: Users, title: 'Only family can open it', caption: 'Each member has their own key.' },
];

const reducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const scrambled = () =>
  Array.from(
    { length: LOCKED.length },
    () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
  ).join('');

/** A made-up salary, followed from one phone, through the cloud, to a family member's phone. */
export function DataJourney() {
  const [still] = useState(reducedMotion);
  const [step, setStep] = useState(still ? STEPS.length - 1 : 0);
  const [playing, setPlaying] = useState(!still);
  const [noise, setNoise] = useState<string | null>(null);

  // Plays through once, then waits. Next or Replay take over.
  useEffect(() => {
    if (!playing || step >= STEPS.length - 1) return;
    const timer = window.setTimeout(() => setStep(step + 1), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, step]);

  // The locking step scrambles the salary for a moment.
  useEffect(() => {
    if (still || step !== 1) return;
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      setNoise(ticks < SCRAMBLE_TICKS ? scrambled() : null);
      if (ticks >= SCRAMBLE_TICKS) window.clearInterval(timer);
    }, SCRAMBLE_MS);
    return () => {
      window.clearInterval(timer);
      setNoise(null);
    };
  }, [still, step]);

  const chip = (index: number) => {
    if (index === 0 || index === 3) return { text: PLAIN, locked: false };
    if (index === 1 && step === 1 && noise) return { text: noise, locked: true };
    if (index === 1 && step < 1) return { text: PLAIN, locked: false };
    return { text: LOCKED, locked: true };
  };

  return (
    <section aria-labelledby="data-journey" className={styles.journey}>
      <h2 id="data-journey">How your data is handled, in 30 seconds</h2>
      <ol className={styles.steps}>
        {STEPS.map(({ icon: Icon, title, caption }, index) => {
          const { text, locked } = chip(index);
          return (
            <li
              aria-current={index === step ? 'step' : undefined}
              className={index <= step ? styles.stepOn : styles.step}
              key={title}
            >
              <span className={index === step && index === 1 ? styles.iconPulse : styles.icon}>
                <Icon aria-hidden="true" size={24} />
              </span>
              <strong>{title}</strong>
              <span className={locked ? styles.chipLocked : styles.chip}>
                {locked ? <span className={ui.visuallyHidden}>Scrambled: </span> : null}
                <span aria-hidden={locked}>{text}</span>
              </span>
              <span className={styles.caption}>{caption}</span>
            </li>
          );
        })}
      </ol>
      {still ? null : (
        <div className={styles.controls}>
          <button
            className={ui.quiet}
            onClick={() => {
              setPlaying(false);
              setStep(step < STEPS.length - 1 ? step + 1 : 0);
            }}
            type="button"
          >
            Next <ArrowRight aria-hidden="true" size={14} />
          </button>
          <button
            className={ui.quiet}
            onClick={() => {
              setStep(0);
              setPlaying(true);
            }}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={14} /> Replay
          </button>
          <span aria-live="polite" className={styles.count}>
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
      )}
      <div className={styles.notes}>
        <div>
          <strong>
            <KeyRound aria-hidden="true" size={16} /> Your key
          </strong>
          <p>
            Your passphrase and recovery code open your records on a new device. Lose both, and
            nobody can recover them, not even the app&apos;s owner.
          </p>
        </div>
        <div>
          <strong>
            <Eye aria-hidden="true" size={16} /> What isn&apos;t locked
          </strong>
          <p>
            Your email and name for sign-in, error reports, and feedback you choose to send. The
            full list is below.
          </p>
        </div>
      </div>
    </section>
  );
}
