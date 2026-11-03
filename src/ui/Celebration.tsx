import { PartyPopper } from 'lucide-react';
import { useEffect } from 'react';
import styles from './Celebration.module.css';

const COLOURS = ['#6CDDBB', '#EF9F27', '#7F77DD', '#D4537E', '#9FE1CB', '#F0997B'];
const PIECES = Array.from({ length: 36 }, (_, index) => ({
  left: (index * 37) % 100,
  delay: (index % 9) * 0.07,
  colour: COLOURS[index % COLOURS.length],
  turn: (index * 53) % 360,
}));
const SHOW_MS = 4200;

/** A short burst of confetti for a rare moment, such as a loan paid off. Tapping closes it. */
export function Celebration({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className={styles.layer} onClick={onDone} role="presentation">
      <div aria-hidden="true" className={styles.confetti}>
        {PIECES.map(({ left, delay, colour, turn }, index) => (
          <i
            key={index}
            style={{
              left: `${left}%`,
              animationDelay: `${delay}s`,
              background: colour,
              rotate: `${turn}deg`,
            }}
          />
        ))}
      </div>
      <div className={styles.card} role="status">
        <PartyPopper aria-hidden="true" size={28} />
        <strong>{message}</strong>
        <span>Well done.</span>
      </div>
    </div>
  );
}
