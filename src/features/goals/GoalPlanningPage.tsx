import { Sunset, Target } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { goalPlan } from '../../domain/goals';
import { useSpendingHousehold, useView } from '../../store/tracker';
import { formatAmount, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './Goals.module.css';
import { GoalsSection } from './GoalsSection';
import { RetirementPlanner } from './RetirementPlanner';
import { useRetirementSummary } from './useRetirementSummary';

type View = 'goals' | 'retirement';
const VIEW_KEY = 'goalPlanningView';

function savedView(): View | null {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    return saved === 'goals' || saved === 'retirement' ? saved : null;
  } catch {
    return null;
  }
}

/**
 * Planning › Goal planning: where every plan stands, then either the family's goals or the
 * retirement planner, one at a time, so neither is buried under the other.
 */
export function GoalPlanningPage() {
  const view = useView();
  const household = useSpendingHousehold();
  const today = localDate();
  const retirement = useRetirementSummary();
  const [params, setParams] = useSearchParams();
  const goals = view.goals
    .filter((goal) => goal.kind !== 'retirement' || !retirement)
    .map((goal) => goalPlan(goal, household, today));
  const asked = params.get('view');
  const [chosen, setChosen] = useState<View>(
    asked === 'goals' || asked === 'retirement' ? asked : (savedView() ?? 'goals'),
  );
  const choose = (next: View) => {
    setChosen(next);
    if (asked) setParams({}, { replace: true });
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Remembered for this visit only.
    }
  };

  const onTrack = goals.filter((plan) => plan.status === 'onTrack' || plan.status === 'reached');
  const extra = goals.reduce((sum, plan) => sum + Math.max(0, plan.extraMonthly ?? 0), 0);
  const saved = goals.reduce((sum, plan) => sum + plan.saved, 0);
  const needed = goals.reduce((sum, plan) => sum + plan.needed, 0);
  const retireOk = retirement ? retirement.gap <= 0 : null;
  const headline =
    goals.length === 0 && !retirement
      ? 'Plan what matters'
      : extra > 0
        ? `${formatAmount(extra)} more a month`
        : retireOk === false
          ? 'Retirement needs a look'
          : 'Everything is on track';
  const sub =
    goals.length === 0 && !retirement
      ? 'Set a goal, or see how long your money lasts after you stop working.'
      : extra > 0
        ? `keeps all ${goals.length} goal${goals.length === 1 ? '' : 's'} on time`
        : retireOk === false
          ? 'Your goals are on time; retirement is short of what it needs.'
          : 'Keep investing as you are.';

  return (
    <div className={ui.page}>
      <section aria-label="Your plan" className={`${ui.hero} ${styles.planHero}`}>
        <span className={styles.planLabel}>Your plan</span>
        <strong className={styles.planHeadline}>{headline}</strong>
        <span className={styles.planSub}>{sub}</span>
        <dl className={styles.planFacts}>
          <div>
            <dt>Goals on track</dt>
            <dd>{goals.length === 0 ? '—' : `${onTrack.length} of ${goals.length}`}</dd>
          </div>
          <div>
            <dt>Set aside</dt>
            <dd>
              {goals.length === 0 ? '—' : `${formatAmount(saved)} of ${formatAmount(needed)}`}
            </dd>
          </div>
          <div>
            <dt>Retirement{retirement?.year ? ` in ${retirement.year}` : ''}</dt>
            <dd data-tone={retireOk === null ? undefined : retireOk ? 'good' : 'watch'}>
              {retirement
                ? retireOk
                  ? 'On course'
                  : `${formatAmount(retirement.gap)} short`
                : 'Not planned'}
            </dd>
          </div>
        </dl>
      </section>

      <div aria-label="Plans" className={ui.segmented} role="tablist">
        {(
          [
            ['goals', `Goals${view.goals.length > 0 ? ` · ${view.goals.length}` : ''}`, Target],
            ['retirement', 'Retirement', Sunset],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            aria-selected={chosen === key}
            className={chosen === key ? ui.segmentActive : ui.segment}
            key={key}
            onClick={() => choose(key)}
            role="tab"
            type="button"
          >
            <Icon aria-hidden="true" className={styles.tabIcon} size={15} /> {label}
          </button>
        ))}
      </div>

      <div role="tabpanel">{chosen === 'goals' ? <GoalsSection /> : <RetirementPlanner />}</div>
    </div>
  );
}
