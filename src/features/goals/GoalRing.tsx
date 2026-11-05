import type { GoalKind } from '../../schema/records';
import { GOAL_ICONS } from './goalText';
import styles from './Goals.module.css';

/** A ring filled to the share saved, with the goal's icon inside. */
export function GoalRing({
  kind,
  progress,
  tone,
  small = false,
}: {
  kind: GoalKind;
  progress: number;
  tone: 'good' | 'neutral' | 'watch';
  small?: boolean;
}) {
  const Icon = GOAL_ICONS[kind];
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(1, Math.max(0, progress)) * circumference;
  return (
    <span
      aria-hidden="true"
      className={`${styles.ring} ${small ? styles.small : ''}`}
      data-tone={tone}
    >
      <svg className={styles.ringSvg} viewBox="0 0 100 100">
        <circle
          className={styles.ringTrack}
          cx="50"
          cy="50"
          fill="none"
          r={radius}
          strokeWidth="9"
        />
        <circle
          className={styles.ringFill}
          cx="50"
          cy="50"
          fill="none"
          r={radius}
          strokeDasharray={`${filled} ${circumference}`}
          strokeWidth="9"
        />
      </svg>
      <Icon className={styles.ringIcon} size={small ? 18 : 24} />
    </span>
  );
}
