import {
  CalendarClock,
  Pencil,
  PiggyBank,
  Plus,
  RotateCcw,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import {
  defaultReturn,
  goalFunds,
  goalPlan,
  monthsUntil,
  overAssigned,
  planGoal,
  unassignedValue,
  type GoalPlan,
} from '../../domain/goals';
import { holdingValue } from '../../domain/holdings';
import { addMonths } from '../../domain/calendar';
import type { Goal } from '../../schema/records';
import { useTracker, useView } from '../../store/tracker';
import { EmptyState } from '../../ui/EmptyState';
import { formatMoney, formatShortMonthYear, localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import ui from '../../ui/ui.module.css';
import { GoalForm } from './GoalForm';
import { GoalRing } from './GoalRing';
import { STATUS_LABELS, STATUS_TONES } from './goalText';
import styles from './Goals.module.css';

const monthOf = (date: string) => formatShortMonthYear(date.slice(0, 7));
const percent = (share: number) => `${Math.round(Math.min(share, 9.99) * 100)}%`;

function StatusChip({ status }: { status: GoalPlan['status'] }) {
  return (
    <span className={styles.status} data-tone={STATUS_TONES[status]}>
      {STATUS_LABELS[status]}
    </span>
  );
}

/** One line that says what to do, or that nothing needs doing. */
function nextStep(plan: GoalPlan, date: string) {
  if (plan.status === 'reached') return 'Fully funded. Keep it where it is until you need it.';
  if (plan.extraMonthly === null)
    return 'The date has passed. Move it, or mark it done by deleting it.';
  if (plan.extraMonthly <= 0) {
    return plan.reachedBy && plan.reachedBy < date.slice(0, 7)
      ? `On track, and could be ready by ${formatShortMonthYear(plan.reachedBy)}.`
      : 'On track at your current pace.';
  }
  const later = plan.reachedBy
    ? ` As it stands, it gets there by ${formatShortMonthYear(plan.reachedBy)}.`
    : '';
  return `Add ${formatMoney(plan.extraMonthly)} a month to reach it on time.${later}`;
}

function GoalDetail({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const today = localDate();
  const plan = goalPlan(goal, data, today);
  const funds = goalFunds(goal, data, today);
  const months = monthsUntil(today, goal.targetDate);
  const baseReturn = goal.expectedReturn ?? defaultReturn(goal.kind, months);

  // What-if: change the monthly amount, the date or the return, without saving anything.
  const [monthly, setMonthly] = useState(Math.round(funds.monthly));
  const [shift, setShift] = useState(0);
  const [rate, setRate] = useState(baseReturn);
  const changed = monthly !== Math.round(funds.monthly) || shift !== 0 || rate !== baseReturn;
  const whatIfDate = addMonths(goal.targetDate, shift * 12);
  const whatIf = planGoal(
    {
      saved: funds.saved,
      monthly,
      expectedReturn: rate,
      target: goal.target,
      inflation: goal.inflation,
      months: monthsUntil(today, whatIfDate),
    },
    today,
  );
  const sliderTop = Math.max(
    50_000,
    Math.ceil(((plan.monthly + (plan.extraMonthly ?? 0)) * 2) / 5_000) * 5_000,
  );

  const remove = () => {
    if (!window.confirm(`Delete the goal ${goal.name}? Your investments stay as they are.`)) return;
    commit([{ type: 'delete', collection: 'goals', id: goal.id }]);
  };
  const tone = STATUS_TONES[plan.status];

  return (
    <div className={ui.page}>
      <div className={styles.detailHead}>
        <GoalRing kind={goal.kind} progress={plan.progress} tone={tone} />
        <div>
          <div className={styles.percent}>{percent(plan.progress)}</div>
          <div className={ui.caption}>of {formatMoney(plan.needed)} set aside</div>
          <StatusChip status={plan.status} />
        </div>
      </div>

      <ul className={styles.story}>
        <li>
          <CalendarClock aria-hidden="true" size={18} />
          <span>
            {formatMoney(goal.target)} today is <strong>{formatMoney(plan.needed)}</strong> by{' '}
            {monthOf(goal.targetDate)}
            <small>Prices rising {goal.inflation}% a year</small>
          </span>
        </li>
        <li>
          <Wallet aria-hidden="true" size={18} />
          <span>
            <strong>{formatMoney(plan.saved)}</strong> set aside, plus {formatMoney(plan.monthly)} a
            month
            <small>
              From {goal.funding.length} investment{goal.funding.length === 1 ? '' : 's'}
            </small>
          </span>
        </li>
        <li>
          <TrendingUp aria-hidden="true" size={18} />
          <span>
            Heading for <strong>{formatMoney(plan.projected)}</strong>
            {plan.projected >= plan.needed
              ? `, ${formatMoney(plan.projected - plan.needed)} to spare`
              : `, ${formatMoney(plan.needed - plan.projected)} short`}
            <small>
              At {plan.expectedReturn}% a year
              {goal.expectedReturn === undefined ? ', automatic for the time left' : ''}
            </small>
          </span>
        </li>
      </ul>
      <p className={styles.fix} data-tone={tone}>
        {nextStep(plan, goal.targetDate)}
      </p>

      <section aria-label="What if" className={styles.whatIf}>
        <div className={ui.split}>
          <strong>What if…</strong>
          {changed ? (
            <button
              className={styles.reset}
              onClick={() => {
                setMonthly(Math.round(funds.monthly));
                setShift(0);
                setRate(baseReturn);
              }}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={13} /> Reset
            </button>
          ) : null}
        </div>
        <label className={styles.slider}>
          <span>
            Each month <b>{formatMoney(monthly)}</b>
          </span>
          <input
            max={sliderTop}
            min={0}
            onChange={(event) => setMonthly(Number(event.target.value))}
            step={500}
            type="range"
            value={Math.min(monthly, sliderTop)}
          />
        </label>
        <label className={styles.slider}>
          <span>
            Needed by <b>{monthOf(whatIfDate)}</b>
          </span>
          <input
            max={10}
            min={-Math.min(5, Math.floor(months / 12))}
            onChange={(event) => setShift(Number(event.target.value))}
            step={1}
            type="range"
            value={shift}
          />
        </label>
        <label className={styles.slider}>
          <span>
            Return each year <b>{rate}%</b>
          </span>
          <input
            max={15}
            min={4}
            onChange={(event) => setRate(Number(event.target.value))}
            step={0.5}
            type="range"
            value={rate}
          />
        </label>
        <p aria-live="polite" className={ui.caption} style={{ margin: 0 }}>
          {changed ? (
            <>
              <StatusChip status={whatIf.status} /> Heading for {formatMoney(whatIf.projected)} of{' '}
              {formatMoney(whatIf.needed)}.{' '}
              {whatIf.extraMonthly
                ? `Still ${formatMoney(whatIf.extraMonthly)} a month short.`
                : ''}
            </>
          ) : (
            'Move a slider to see how the plan changes. Nothing is saved.'
          )}
        </p>
      </section>

      {goal.funding.length > 0 ? (
        <section>
          <h3 className={ui.label}>Funded from</h3>
          <ul className={ui.list}>
            {goal.funding.map(({ holdingId, share }) => {
              const holding = data.holdings.find((row) => row.id === holdingId);
              return (
                <li className={ui.row} key={holdingId}>
                  <div className={ui.rowMain}>
                    <div className={ui.rowTitle}>{holding?.name ?? 'A removed investment'}</div>
                    <div className={ui.rowDetail}>{Math.round(share * 1000) / 10}% of it</div>
                  </div>
                  <span className={ui.amount}>
                    {holding ? formatMoney(holdingValue(holding, data, today) * share) : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className={ui.actions}>
        <button className={ui.quiet} onClick={onEdit} type="button">
          <Pencil aria-hidden="true" size={15} /> Edit
        </button>
        <button className={ui.quiet} onClick={remove} type="button">
          <Trash2 aria-hidden="true" size={15} /> Delete
        </button>
      </div>
      <p className={ui.caption}>
        Projections assume a steady return each year, which markets never give. Review your goals
        when your plans change.
      </p>
    </div>
  );
}

/** Saved goals, each funded from a share of real investments. */
export function GoalsSection() {
  const data = useView();
  const household = useTracker((state) => state.data);
  const today = localDate();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Goal | null>(null);
  const goals = data.goals
    .map((goal) => ({ goal, plan: goalPlan(goal, household, today) }))
    .sort((a, b) => a.goal.targetDate.localeCompare(b.goal.targetDate));
  const open = household.goals.find((goal) => goal.id === openId);
  const onTrack = goals.filter(
    ({ plan }) => plan.status === 'onTrack' || plan.status === 'reached',
  );
  const over = overAssigned(household.goals);
  const free = unassignedValue(household, today);

  return (
    <section aria-label="Goals" className={ui.card} id="goals">
      <div className={ui.cardHeader}>
        <div className={ui.cardHeader} style={{ justifyContent: 'flex-start' }}>
          <span aria-hidden="true" className={ui.tileIcon}>
            <Target size={20} />
          </span>
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>Goals</h2>
            <div className={ui.caption}>
              {goals.length === 0
                ? 'Save for what matters, from your real investments'
                : `${onTrack.length} of ${goals.length} on track`}
            </div>
          </div>
        </div>
        <button className={ui.button} onClick={() => setAdding(true)} type="button">
          <Plus size={16} /> Add goal
        </button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          action={
            <button className={ui.quiet} onClick={() => setAdding(true)} type="button">
              Set your first goal
            </button>
          }
          icon={PiggyBank}
          title="No goals yet"
          text="A child's education, a house, retirement or an emergency fund. Set part of your investments aside, and see whether you're on track."
        />
      ) : (
        <ul className={styles.list}>
          {goals.map(({ goal, plan }) => (
            <li key={goal.id}>
              <button
                aria-label={`${goal.name}: ${percent(plan.progress)} saved, ${STATUS_LABELS[plan.status]}`}
                className={styles.goal}
                onClick={() => setOpenId(goal.id)}
                type="button"
              >
                <GoalRing
                  kind={goal.kind}
                  progress={plan.progress}
                  tone={STATUS_TONES[plan.status]}
                />
                <span className={styles.goalBody}>
                  <span className={styles.goalTop}>
                    <strong>{goal.name}</strong>
                    <StatusChip status={plan.status} />
                  </span>
                  <span className={styles.goalLine}>
                    {formatMoney(plan.saved)} of {formatMoney(plan.needed)} ·{' '}
                    {monthOf(goal.targetDate)}
                  </span>
                  <span className={styles.goalLine}>
                    {plan.extraMonthly
                      ? `Add ${formatMoney(plan.extraMonthly)} a month`
                      : plan.status === 'reached'
                        ? 'Fully funded'
                        : `${formatMoney(plan.monthly)} a month keeps it on track`}
                    {goal.member ? ` · ${goal.member}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {over.length > 0 ? (
        <p className={styles.warning} role="alert">
          {household.holdings
            .filter((row) => over.includes(row.id))
            .map((row) => row.name)
            .join(', ')}{' '}
          {over.length === 1 ? 'is' : 'are'} set aside for more than its whole value across goals.
          Lower a share so progress isn't counted twice.
        </p>
      ) : null}
      {goals.length > 0 && free > 0 ? (
        <p className={ui.caption} style={{ margin: 0 }}>
          {formatMoney(free)} of your investments isn't set aside for any goal yet.
        </p>
      ) : null}

      {adding ? (
        <Modal fullScreenOnPhone onClose={() => setAdding(false)} title="Add a goal">
          <GoalForm onDone={() => setAdding(false)} />
        </Modal>
      ) : null}
      {editing ? (
        <Modal fullScreenOnPhone onClose={() => setEditing(null)} title={`Edit ${editing.name}`}>
          <GoalForm goal={editing} onDone={() => setEditing(null)} />
        </Modal>
      ) : null}
      {open && !editing ? (
        <Modal onClose={() => setOpenId(null)} title={open.name}>
          <GoalDetail
            goal={open}
            onEdit={() => {
              setEditing(open);
              setOpenId(null);
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}
