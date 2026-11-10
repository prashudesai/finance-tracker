import { ChevronRight, PiggyBank, Target, type LucideIcon } from 'lucide-react';
import { Component, type ReactNode } from 'react';
import { Link } from 'react-router';
import { reportError } from '../../ui/errorSink';
import { budgetProgress } from '../../domain/budget';
import { financialYearLabel, financialYearStart } from '../../domain/calendar';
import { useRetirementSummary } from '../goals/useRetirementSummary';
import { goalPlan } from '../../domain/goals';
import { useSpendingHousehold } from '../../store/tracker';
import { formatAmount, formatMoney, formatPercent, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import { GOAL_ICONS, STATUS_LABELS, STATUS_TONES } from '../goals/goalText';
import styles from './PlanOverview.module.css';
import { useProjection } from './useProjection';
import type { ProjectionResult } from '../../domain/projection';
import type { Goal } from '../../schema/records';
import type { GoalPlan } from '../../domain/goals';

/** One part of the overview that fails leaves the rest showing, and the problem is reported. */
class Part extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    reportError(error);
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

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
  const planned = data.goals.map((goal) => ({ goal, plan: goalPlan(goal, data, today) }));
  // Retirement leads the page on its own, so the tiles show the rest.
  const retirement = planned.find(({ goal }) => goal.kind === 'retirement');
  const goals = planned
    .filter((row) => row !== retirement)
    .sort((a, b) => a.plan.progress - b.plan.progress);
  const projection = useProjection();
  const planner = useRetirementSummary();
  const fy = financialYearStart(today);
  const budget = data.budgets.find((row) => row.fy === fy);
  const progress = budget ? budgetProgress(budget, data, today) : null;
  const pace = progress ? progress.spent - progress.due : 0;

  return (
    <>
      <Part>
        <RetirementCard planner={planner} retirement={retirement} />
      </Part>

      <section aria-labelledby="plan-goals" className={styles.section}>
        <div className={styles.head}>
          <h2 id="plan-goals">Goals</h2>
          <Link className={ui.textLink} to="/analytics/goals">
            {planned.length > 0 ? `All ${planned.length} ›` : 'Set a goal ›'}
          </Link>
        </div>
        {goals.length === 0 && !retirement ? (
          <p className={ui.caption}>
            Save for college, a house or retirement, and see whether you're on track.
          </p>
        ) : goals.length === 0 ? null : (
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
          <Link className={styles.setup} to="/analytics/budget">
            <span aria-hidden="true" className={styles.setupIcon}>
              <PiggyBank size={18} />
            </span>
            <span className={styles.setupText}>
              <strong>Set up this year's budget</strong>
              <span>From rent to school fees, filled in from your last 12 months</span>
            </span>
            <ChevronRight aria-hidden="true" size={18} />
          </Link>
        )}
      </section>

      {projection.results ? (
        <Part>
          <GrowthPreview results={projection.results} years={projection.years} />
        </Part>
      ) : null}

      <section aria-label="More plans" className={`${ui.card} ${styles.shortcuts}`}>
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

/** Retirement as a ring: what the plan as it stands reaches, against what's needed. */
function RetirementCard({
  retirement,
  planner,
}: {
  retirement: { goal: Goal; plan: GoalPlan } | undefined;
  planner: { needed: number; onCourse: number; gap: number; year: string } | null;
}) {
  if (planner) {
    const share = planner.needed > 0 ? planner.onCourse / planner.needed : 1;
    const onCourse = planner.gap <= 0;
    return (
      <RetirementRing
        label={`Retirement${planner.year ? ` in ${planner.year}` : ''}`}
        share={share}
        status={onCourse ? 'On course' : `${formatAmount(planner.gap)} short`}
        sub={`${formatAmount(planner.onCourse)} on course · needs ${formatAmount(planner.needed)}`}
        tone={onCourse ? 'good' : 'watch'}
      />
    );
  }
  if (!retirement) {
    return (
      <Link className={`${ui.hero} ${styles.retire}`} to="/analytics/goals">
        <span className={styles.retireText}>
          <span className={styles.retireLabel}>Retirement</span>
          <strong className={styles.retireStatus}>Plan it</strong>
          <span className={styles.retireSub}>When you can stop working, and what it takes</span>
        </span>
        <ChevronRight aria-hidden="true" size={22} />
      </Link>
    );
  }
  const { goal, plan } = retirement;
  const share = plan.needed > 0 ? plan.projected / plan.needed : 1;
  const onCourse = plan.status === 'reached' || plan.status === 'onTrack';
  return (
    <RetirementRing
      label={`Retirement${goal.targetDate ? ` by ${goal.targetDate.slice(0, 4)}` : ''}`}
      share={share}
      status={onCourse ? 'On course' : STATUS_LABELS[plan.status]}
      sub={`${formatAmount(plan.projected)} projected · needs ${formatAmount(plan.needed)}`}
      tone={STATUS_TONES[plan.status]}
    />
  );
}

/** Retirement as a ring of what's on course against what's needed. */
function RetirementRing({
  label,
  status,
  sub,
  share,
  tone,
}: {
  label: string;
  status: string;
  sub: string;
  share: number;
  tone: 'good' | 'neutral' | 'watch';
}) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <Link
      aria-label={`${label}: ${status}, ${Math.round(share * 100)}% of what's needed. Open the retirement planner`}
      className={`${ui.hero} ${styles.retire}`}
      data-tone={tone}
      to="/analytics/goals?view=retirement"
    >
      <span className={styles.retireText}>
        <span className={styles.retireLabel}>{label}</span>
        <strong className={styles.retireStatus}>{status}</strong>
        <span className={styles.retireSub}>{sub}</span>
      </span>
      <svg aria-hidden="true" className={styles.retireRing} viewBox="0 0 84 84">
        <circle className={styles.retireTrack} cx="42" cy="42" r={r} />
        <circle
          className={styles.retireArc}
          cx="42"
          cy="42"
          r={r}
          style={{ strokeDasharray: `${Math.min(share, 1) * c} ${c}` }}
        />
        <text className={styles.retirePercent} x="42" y="47">
          {Math.round(share * 100)}%
        </text>
      </svg>
    </Link>
  );
}

const PATHS = [
  { key: 'optimistic', label: 'Good' },
  { key: 'base', label: 'Expected' },
  { key: 'stress', label: 'Tough' },
] as const;

/** Where investments could be, in good years, as expected and in tough ones. */
function GrowthPreview({
  results,
  years,
}: {
  results: Record<'stress' | 'base' | 'optimistic', ProjectionResult>;
  years: number;
}) {
  const W = 320;
  const H = 90;
  const lines = PATHS.map((path) => ({
    ...path,
    values: [
      results[path.key].rows[0]?.opening ?? 0,
      ...results[path.key].rows.map((row) => row.closing),
    ],
  }));
  const all = lines.flatMap((line) => line.values);
  const peak = Math.max(1, ...all);
  // Scaled from just under the lowest value, not zero, so the spread between paths shows.
  const low = Math.min(...all);
  const floor = Math.max(0, low - (peak - low) * 0.15);
  const span = Math.max(1, peak - floor);
  const xy = (values: number[]) =>
    values.map(
      (value, index) =>
        `${(index / Math.max(1, values.length - 1)) * W},${H - 4 - ((value - floor) / span) * (H - 8)}`,
    );
  const [good, base, tough] = lines;
  const band = good && tough ? [...xy(good.values), ...xy(tough.values).reverse()].join(' ') : '';
  const last = (key: 'optimistic' | 'base' | 'stress') =>
    formatAmount(lines.find((line) => line.key === key)?.values.at(-1) ?? 0);
  return (
    <section aria-labelledby="plan-growth" className={styles.section}>
      <div className={styles.head}>
        <h2 id="plan-growth">Growth projection</h2>
        <Link className={ui.textLink} to="/analytics/projection">
          {years} years ›
        </Link>
      </div>
      <Link className={`${ui.card} ${styles.growth}`} to="/analytics/projection">
        <svg
          aria-hidden="true"
          className={styles.growthChart}
          preserveAspectRatio="none"
          viewBox={`0 0 ${W} ${H}`}
        >
          {band ? <polygon className={styles.band} points={band} /> : null}
          {base ? (
            <polyline className={styles.pathBase} points={xy(base.values).join(' ')} />
          ) : null}
        </svg>
        <ul className={styles.paths}>
          <li>
            <i className={styles.pathBaseDot} />
            Expected {last('base')}
          </li>
          <li>
            <i className={styles.bandDot} />
            Tough to good {last('stress')} – {last('optimistic')}
          </li>
        </ul>
      </Link>
    </section>
  );
}
