import { ChevronRight, Target } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { goalDate, goalPlan } from '../../domain/goals';
import { useTracker, useView } from '../../store/tracker';
import { localDate } from '../../ui/format';
import { Nudge } from '../../ui/Nudge';
import ui from '../../ui/ui.module.css';
import { GoalRing } from './GoalRing';
import { STATUS_LABELS, STATUS_TONES } from './goalText';
import styles from './Goals.module.css';

const SHOWN = 4;
const NUDGE_KEY = 'goalsNudgeDismissed';

function nudgeDismissed() {
  try {
    return localStorage.getItem(NUDGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Goals at a glance on the dashboard, or a one-time offer to set the first. */
export function GoalsTile() {
  const data = useView();
  const household = useTracker((state) => state.data);
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(nudgeDismissed);
  const today = localDate();

  if (data.goals.length === 0) {
    if (dismissed || household.holdings.length === 0) return null;
    return (
      <Nudge
        action={
          <button
            aria-label="Set a goal"
            className={ui.button}
            onClick={() => navigate('/analytics/goals')}
            type="button"
          >
            Set
          </button>
        }
        closeLabel="Not now"
        detail="See if you're on track for it"
        icon={Target}
        label="Set a goal"
        onClose={() => {
          setDismissed(true);
          try {
            localStorage.setItem(NUDGE_KEY, '1');
          } catch {
            // Shown again next visit.
          }
        }}
        title="Saving for something?"
      />
    );
  }

  const goals = data.goals
    .map((goal) => ({ goal, plan: goalPlan(goal, household, today) }))
    .sort((a, b) =>
      (goalDate(a.goal, a.plan) ?? '9999').localeCompare(goalDate(b.goal, b.plan) ?? '9999'),
    );
  const onTrack = goals.filter(
    ({ plan }) => plan.status === 'onTrack' || plan.status === 'reached',
  );

  return (
    <section aria-label="Goals" className={ui.card}>
      <Link
        className={ui.split}
        style={{ color: 'inherit', textDecoration: 'none' }}
        to="/analytics/goals"
      >
        <span>
          <h2 style={{ fontSize: '1.05rem' }}>Goals · {goals.length}</h2>
          <span className={ui.caption}>
            {onTrack.length} of {goals.length} on track
          </span>
        </span>
        <ChevronRight aria-hidden="true" size={18} />
      </Link>
      <div className={styles.tileGoals}>
        {goals.slice(0, SHOWN).map(({ goal, plan }) => (
          <Link
            aria-label={`${goal.name}, ${Math.round(Math.min(plan.progress, 1) * 100)}% saved, ${STATUS_LABELS[plan.status]}`}
            className={styles.tileGoal}
            key={goal.id}
            to="/analytics/goals"
          >
            <GoalRing
              kind={goal.kind}
              progress={plan.progress}
              small
              tone={STATUS_TONES[plan.status]}
            />
            <span>{goal.name}</span>
            <span className={ui.caption}>{Math.round(Math.min(plan.progress, 1) * 100)}%</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
