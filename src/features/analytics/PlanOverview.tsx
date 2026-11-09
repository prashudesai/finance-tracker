import { ChevronRight, LineChart, PiggyBank, Sunset, Target, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { budgetProgress } from '../../domain/budget';
import { financialYearLabel, financialYearStart } from '../../domain/calendar';
import { goalPlan } from '../../domain/goals';
import { useSpendingHousehold } from '../../store/tracker';
import { formatMoney, formatPercent, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import { GOAL_ICONS, STATUS_LABELS, STATUS_TONES } from '../goals/goalText';
import styles from './PlanOverview.module.css';

function Shortcut({
  to,
  icon: Icon,
  title,
  text,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <Link className={styles.shortcut} to={to}>
      <span aria-hidden="true" className={styles.shortcutIcon}>
        <Icon size={18} />
      </span>
      <span className={styles.shortcutText}>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <ChevronRight aria-hidden="true" size={18} />
    </Link>
  );
}

/**
 * Plan › Future › Overview: every plan at a glance, from goals to this year's budget, with a
 * way into each. Nothing here is saved.
 */
export function PlanOverview() {
  const data = useSpendingHousehold();
  const today = localDate();
  const goals = data.goals
    .map((goal) => ({ goal, plan: goalPlan(goal, data, today) }))
    .sort((a, b) => a.plan.progress - b.plan.progress);
  const fy = financialYearStart(today);
  const budget = data.budgets.find((row) => row.fy === fy);
  const progress = budget ? budgetProgress(budget, data, today) : null;
  const pace = progress ? progress.spent - progress.due : 0;

  return (
    <>
      <section aria-labelledby="plan-goals" className={styles.section}>
        <div className={styles.head}>
          <h2 id="plan-goals">Goals</h2>
          <Link className={ui.textLink} to="/analytics/goals">
            {goals.length > 0 ? `All ${goals.length} ›` : 'Set a goal ›'}
          </Link>
        </div>
        {goals.length === 0 ? (
          <p className={ui.caption}>
            Save for college, a house or retirement, and see whether you're on track.
          </p>
        ) : (
          <ul className={styles.tiles}>
            {goals.slice(0, 4).map(({ goal, plan }) => {
              const Icon = GOAL_ICONS[goal.kind];
              return (
                <li key={goal.id}>
                  <Link
                    className={styles.tile}
                    data-tone={STATUS_TONES[plan.status]}
                    to="/analytics/goals"
                  >
                    <span className={styles.tileName}>
                      <Icon aria-hidden="true" size={15} /> {goal.name}
                    </span>
                    <strong className={styles.tileValue}>
                      {formatPercent(Math.min(plan.progress, 1), 0)}
                    </strong>
                    <span className={styles.bar}>
                      <i style={{ width: `${Math.min(plan.progress, 1) * 100}%` }} />
                    </span>
                    <span className={styles.status}>
                      {STATUS_LABELS[plan.status]}
                      {plan.extraMonthly && plan.status !== 'reached' && plan.status !== 'onTrack'
                        ? ` · add ${formatMoney(plan.extraMonthly)}/mo`
                        : ''}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="plan-budget" className={styles.section}>
        <div className={styles.head}>
          <h2 id="plan-budget">Yearly budget</h2>
          <Link className={ui.textLink} to="/analytics/budget">
            {financialYearLabel(fy)} ›
          </Link>
        </div>
        {progress ? (
          <Link className={`${ui.card} ${styles.budget}`} to="/analytics/budget">
            <span className={styles.budgetLine}>
              <span>
                {formatMoney(progress.spent)} of {formatMoney(progress.due)} due so far
              </span>
              <strong data-over={pace > 0 || undefined}>
                {pace > 0 ? `${formatMoney(pace)} over` : pace < 0 ? 'Under plan' : 'On plan'}
              </strong>
            </span>
            <span className={styles.bar}>
              <i
                data-over={pace > 0 || undefined}
                style={{
                  width: `${progress.due > 0 ? Math.min(1, progress.spent / progress.due) * 100 : 0}%`,
                }}
              />
            </span>
            {progress.upcoming.length > 0 ? (
              <small className={ui.caption}>
                Next: {progress.upcoming.map((row) => row.line.name).join(', ')}
              </small>
            ) : null}
          </Link>
        ) : (
          <p className={ui.caption}>
            Plan the financial year's spending, from rent to school fees, and follow how it goes.
          </p>
        )}
      </section>

      <section aria-label="More plans" className={styles.shortcuts}>
        <Shortcut
          icon={Sunset}
          text="When you can stop working, and what it takes"
          title="Retirement planner"
          to="/analytics/goals"
        />
        <Shortcut
          icon={LineChart}
          text="Where your investments could be, in good years and tough ones"
          title="Growth projection"
          to="/analytics/projection"
        />
        <Shortcut
          icon={PiggyBank}
          text="This year's plan against what you actually spent"
          title="Budget vs actual"
          to="/analytics/budget-actual"
        />
        <Shortcut
          icon={Target}
          text="Analytics, income and date range reports"
          title="Insights"
          to="/analytics"
        />
      </section>
    </>
  );
}
