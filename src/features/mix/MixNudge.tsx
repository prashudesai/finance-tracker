import { ChevronRight, Scale } from 'lucide-react';
import { Link } from 'react-router';
import { holdingRows } from '../../domain/analytics';
import { reviewMix } from '../../domain/portfolioMix';
import { useSettings, useView } from '../../store/tracker';
import { localDate } from '../../ui/format';
import styles from './Mix.module.css';
import { tipText } from './tipText';

/** A link to Portfolio mix, with the most pressing tip, for the Investments page. */
export function MixNudge() {
  const view = useView();
  const settings = useSettings();
  const today = localDate();
  const review = reviewMix(holdingRows(view, today), view, {
    today,
    settings,
    ...(settings.retirement?.birthDate ? { birthDate: settings.retirement.birthDate } : {}),
    ...(settings.retirement?.retireDate ? { retireDate: settings.retirement.retireDate } : {}),
  });
  const open = review.tips.filter((tip) => tip.tone !== 'good');
  const top = open[0];
  if (review.tips.length === 0) return null;
  return (
    <Link className={styles.nudge} data-tone={top?.tone ?? 'good'} to="/analytics/mix">
      <span aria-hidden="true" className={styles.nudgeIcon}>
        <Scale size={18} />
      </span>
      <span className={styles.nudgeText}>
        <strong>
          {open.length === 0
            ? 'Your mix looks balanced'
            : `${open.length} tip${open.length === 1 ? '' : 's'} for your mix`}
        </strong>
        <span>{top ? tipText(top).title : 'See how it compares with a common guide'}</span>
      </span>
      <ChevronRight aria-hidden="true" size={18} />
    </Link>
  );
}
