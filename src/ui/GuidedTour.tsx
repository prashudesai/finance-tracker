import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTracker } from '../store/tracker';
import styles from '../Shell.module.css';
import ui from './ui.module.css';

const STEPS = [
  {
    path: '/',
    title: 'Your dashboard',
    text: 'Net worth, this month, and anything that needs attention.',
  },
  {
    path: '/cash-flow',
    title: 'Income & Expense',
    text: 'Record money in and out, and post recurring items.',
  },
  {
    path: '/investments',
    title: 'Investments',
    text: 'Track holdings, PF, PPF, NPS and gratuity. Tap a card for details.',
  },
  {
    path: '/debts',
    title: 'Debts',
    text: 'See what remains on each loan, and record rate changes and part payments.',
  },
  {
    path: '/analytics',
    title: 'Analysis & Planning',
    text: 'See where your income comes from, plan goals and retirement, project growth and export reports.',
  },
  {
    path: '/settings',
    title: 'Settings',
    text: 'Invite family, manage custom values and keep a backup.',
  },
];

/** A short walk through each page. It never changes any records. */
export function GuidedTour() {
  const setTourOpen = useTracker((state) => state.setTourOpen);
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  if (!step) return null;

  const go = (next: number) => {
    const target = STEPS[next];
    if (!target) {
      setTourOpen(false);
      return;
    }
    setIndex(next);
    void navigate(target.path);
  };

  return (
    <section aria-label="App tour" className={styles.tour}>
      <div className={ui.split}>
        <span className={ui.caption}>App tour</span>
        <span className={ui.caption}>
          {index + 1} of {STEPS.length}
        </span>
      </div>
      <h2>{step.title}</h2>
      <p className={ui.subtitle} style={{ margin: 0 }}>
        {step.text}
      </p>
      <div className={ui.actions} style={{ justifyContent: 'flex-end' }}>
        <button className={ui.quiet} onClick={() => setTourOpen(false)} type="button">
          Skip
        </button>
        {index > 0 ? (
          <button className={ui.quiet} onClick={() => go(index - 1)} type="button">
            Back
          </button>
        ) : null}
        <button className={ui.button} onClick={() => go(index + 1)} type="button">
          {index === STEPS.length - 1 ? 'Done' : 'Next'}
        </button>
      </div>
    </section>
  );
}
