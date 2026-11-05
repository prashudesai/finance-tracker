import { useState } from 'react';
import {
  assignedShares,
  defaultReturn,
  emergencyTarget,
  GOAL_DEFAULTS,
  PORTFOLIO_RETURN,
  goalPlan,
  monthsUntil,
  retirementFunding,
  retirementTarget,
} from '../../domain/goals';
import { netWorth } from '../../domain/analytics';
import { holdingValue } from '../../domain/holdings';
import { addMonths } from '../../domain/calendar';
import { GOAL_KINDS, goalSchema, type Goal, type GoalKind } from '../../schema/records';
import { useSettings, useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatCompactMoney, formatAmount, formatShortMonthYear, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import { GOAL_ICONS, STATUS_LABELS } from './goalText';
import styles from './Goals.module.css';

const percentText = (share: number) => String(Math.round(share * 1000) / 10);

/** Adds or edits a goal. Only the plan is saved; progress is always worked out. */
export function GoalForm({ goal, onDone }: { goal?: Goal; onDone: () => void }) {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const { familyMembers } = useSettings();
  const today = localDate();
  const spending = emergencyTarget(data, today);

  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? 'education');
  const [name, setName] = useState(goal?.name ?? GOAL_DEFAULTS.education.label);
  const [nameEdited, setNameEdited] = useState(Boolean(goal));
  const [target, setTarget] = useState(goal ? String(goal.target) : '');
  const [targetEdited, setTargetEdited] = useState(Boolean(goal));
  const yearsAhead = (years: number) => addMonths(today, years * 12);
  const [targetDate, setTargetDate] = useState(goal ? (goal.targetDate ?? '') : yearsAhead(10));
  const [measure, setMeasure] = useState<'netWorth' | 'investments'>(goal?.measure ?? 'netWorth');
  const worth = netWorth(data, today);
  const [member, setMember] = useState(goal?.member ?? '');
  const [inflation, setInflation] = useState(String(goal?.inflation ?? 10));
  const [expectedReturn, setExpectedReturn] = useState(
    goal?.expectedReturn === undefined ? '' : String(goal.expectedReturn),
  );
  const [shares, setShares] = useState<Record<string, string>>(() =>
    Object.fromEntries((goal?.funding ?? []).map((row) => [row.holdingId, percentText(row.share)])),
  );
  // Helpers that suggest a target, for retirement and an emergency fund.
  const [monthlySpend, setMonthlySpend] = useState(
    spending ? String(Math.round(spending.average)) : '',
  );
  const [retiredYears, setRetiredYears] = useState('25');
  const [cover, setCover] = useState('6');

  const chooseKind = (next: GoalKind) => {
    setKind(next);
    const defaults = GOAL_DEFAULTS[next];
    if (!nameEdited) setName(next === 'custom' ? '' : defaults.label);
    if (!goal) {
      setInflation(String(defaults.inflation));
      // A portfolio target asks when, so it starts without a date.
      setTargetDate(next === 'portfolio' ? '' : yearsAhead(defaults.years));
      setTargetEdited(false);
      if (next === 'retirement' && Object.keys(shares).length === 0) {
        setShares(
          Object.fromEntries(
            retirementFunding(data).map((row) => [row.holdingId, percentText(row.share)]),
          ),
        );
      }
    }
  };

  const suggested =
    kind === 'retirement' && Number(monthlySpend) > 0
      ? retirementTarget(Number(monthlySpend), { years: Number(retiredYears) || 25 })
      : kind === 'emergency' && Number(monthlySpend) > 0
        ? Math.round(Number(monthlySpend) * (Number(cover) || 6))
        : null;
  const shownTarget = !targetEdited && suggested !== null ? String(Math.round(suggested)) : target;

  const others = assignedShares(data.goals, goal?.id);
  const holdings = data.holdings
    .filter((holding) => holding.date <= today)
    .map((holding) => ({
      holding,
      value: holdingValue(holding, data, today),
      free: Math.max(0, 1 - (others.get(holding.id) ?? 0)),
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);

  const funding = Object.entries(shares)
    .filter(([, text]) => text.trim() !== '' && Number(text) > 0)
    .map(([holdingId, text]) => ({ holdingId, share: Number(text) / 100 }));
  const portfolio = kind === 'portfolio';
  const months = monthsUntil(today, targetDate || today);
  const draft = {
    id: goal?.id ?? 'draft',
    kind,
    name,
    target: Number(shownTarget),
    ...(targetDate ? { targetDate } : {}),
    ...(portfolio ? { measure } : {}),
    member,
    inflation: Number(inflation),
    ...(expectedReturn.trim() === '' ? {} : { expectedReturn: Number(expectedReturn) }),
    funding: portfolio ? [] : funding,
    ...(goal?.notes ? { notes: goal.notes } : {}),
  };
  const parsed = goalSchema.safeParse(draft);
  const tooMuch = holdings.find(
    ({ holding, free }) =>
      (funding.find((row) => row.holdingId === holding.id)?.share ?? 0) > free + 1e-9,
  );
  const targetError =
    shownTarget.trim() === '' || !(Number(shownTarget) > 0)
      ? portfolio
        ? 'Enter the amount you’re aiming for.'
        : 'Enter how much it costs in today’s rupees.'
      : null;
  const dateError = targetDate
    ? targetDate <= today
      ? 'Pick a date in the future.'
      : null
    : portfolio
      ? null
      : 'Pick the date you need it by.';
  const fundingError =
    !portfolio && tooMuch
      ? `Only ${percentText(tooMuch.free)}% of ${tooMuch.holding.name} is free. The rest is set aside for other goals.`
      : null;
  const error =
    targetError ??
    dateError ??
    fundingError ??
    (parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Check the details.'));
  const plan = parsed.success && !error ? goalPlan(parsed.data, data, today) : null;

  return (
    <form
      className={ui.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (error || !parsed.success) return;
        const id = goal?.id ?? crypto.randomUUID();
        commit([{ type: 'set', collection: 'goals', id, value: { ...parsed.data, id } }]);
        onDone();
      }}
    >
      <div className={ui.formWide}>
        <span className={ui.label}>What are you saving for?</span>
        <div aria-label="Goal type" className={styles.kinds} role="radiogroup">
          {GOAL_KINDS.map((key) => {
            const Icon = GOAL_ICONS[key];
            return (
              <button
                aria-checked={kind === key}
                className={styles.kind}
                key={key}
                onClick={() => chooseKind(key)}
                role="radio"
                type="button"
              >
                <Icon aria-hidden="true" size={20} />
                {GOAL_DEFAULTS[key].label}
              </button>
            );
          })}
        </div>
      </div>
      <Field label="Name">
        <input
          maxLength={100}
          onChange={(event) => {
            setNameEdited(true);
            setName(event.target.value);
          }}
          placeholder="For example, Riya's college"
          value={name}
        />
      </Field>
      {familyMembers.length > 1 ? (
        <Field label="For">
          <select onChange={(event) => setMember(event.target.value)} value={member}>
            <option value="">The whole household</option>
            {familyMembers.map((person) => (
              <option key={person} value={person}>
                {person}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {kind === 'retirement' || kind === 'emergency' ? (
        <div className={`${ui.formWide} ${styles.helper}`}>
          <strong>
            {kind === 'retirement' ? 'Work out what retirement needs' : 'Cover your spending'}
          </strong>
          <div className={ui.form}>
            <Field label="Monthly spending today (₹)">
              <input
                inputMode="decimal"
                onChange={(event) => {
                  setTargetEdited(false);
                  setMonthlySpend(event.target.value);
                }}
                type="number"
                value={monthlySpend}
              />
            </Field>
            {kind === 'retirement' ? (
              <Field label="Years it should last">
                <input
                  inputMode="numeric"
                  onChange={(event) => {
                    setTargetEdited(false);
                    setRetiredYears(event.target.value);
                  }}
                  type="number"
                  value={retiredYears}
                />
              </Field>
            ) : (
              <Field label="Months to cover">
                <input
                  inputMode="numeric"
                  onChange={(event) => {
                    setTargetEdited(false);
                    setCover(event.target.value);
                  }}
                  type="number"
                  value={cover}
                />
              </Field>
            )}
          </div>
          <span className={ui.caption}>
            {spending
              ? `Your recorded spending averages ${formatAmount(spending.average)} a month over the last ${spending.months} month${spending.months === 1 ? '' : 's'}.`
              : 'Enter what your household spends in a month.'}
            {kind === 'retirement'
              ? ' Assumes savings grow 10% a year after you retire, a mix of equity and safe debt, while prices rise 6%.'
              : ''}
          </span>
        </div>
      ) : null}

      {portfolio ? (
        <div className={ui.formWide}>
          <span className={ui.label}>Measure it by</span>
          <div aria-label="Measure it by" className={styles.kinds} role="radiogroup">
            {(
              [
                ['netWorth', 'Net worth', worth.netWorth],
                ['investments', 'Investments', worth.assets],
              ] as const
            ).map(([key, label, value]) => (
              <button
                aria-checked={measure === key}
                className={styles.kind}
                key={key}
                onClick={() => setMeasure(key)}
                role="radio"
                type="button"
              >
                {label}
                <span>{formatCompactMoney(value)} today</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <Field label={portfolio ? 'Target amount (₹)' : "Cost in today's rupees (₹)"}>
        <input
          inputMode="decimal"
          onChange={(event) => {
            setTargetEdited(true);
            setTarget(event.target.value);
          }}
          type="number"
          value={shownTarget}
        />
      </Field>
      <Field label={portfolio ? 'By a date (optional)' : 'Needed by'}>
        <input
          min={today}
          onChange={(event) => setTargetDate(event.target.value)}
          type="date"
          value={targetDate}
        />
      </Field>
      {portfolio ? null : (
        <Field label="Prices rise each year (%)">
          <input
            inputMode="decimal"
            onChange={(event) => setInflation(event.target.value)}
            step="0.5"
            type="number"
            value={inflation}
          />
        </Field>
      )}
      <Field label="Expected return each year (%)">
        <input
          inputMode="decimal"
          onChange={(event) => setExpectedReturn(event.target.value)}
          placeholder={`Automatic: ${portfolio ? PORTFOLIO_RETURN : defaultReturn(kind, months)}%`}
          step="0.5"
          type="number"
          value={expectedReturn}
        />
      </Field>

      {portfolio ? (
        <p className={`${ui.caption} ${ui.formWide}`}>
          {targetDate
            ? 'Leave the date empty to see when you’ll get there instead.'
            : 'With no date, it works out when you’ll get there.'}{' '}
          It follows your whole {measure === 'netWorth' ? 'net worth' : 'portfolio'}, adding what
          your savings contributions add each month on average, with growth on what you have.
        </p>
      ) : (
        <div className={ui.formWide}>
          <span className={ui.label}>Fund it from your investments</span>
          <span className={ui.caption}>
            Set aside a share of each. Progress follows their value, so it stays up to date.
          </span>
          {holdings.length === 0 ? (
            <p className={ui.empty}>Add an investment first, then set part of it aside here.</p>
          ) : (
            <ul className={styles.funding}>
              {holdings.map(({ holding, value, free }) => (
                <li key={holding.id}>
                  <span>
                    <strong>{holding.name}</strong>
                    <span className={ui.caption} style={{ display: 'block' }}>
                      {formatCompactMoney(value)} · {percentText(free)}% free
                    </span>
                  </span>
                  <input
                    aria-label={`Share of ${holding.name} (%)`}
                    inputMode="decimal"
                    max={100}
                    min={0}
                    onChange={(event) =>
                      setShares((current) => ({ ...current, [holding.id]: event.target.value }))
                    }
                    placeholder="0%"
                    type="number"
                    value={shares[holding.id] ?? ''}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (targetEdited || shownTarget !== '' || funding.length > 0) ? (
        <p className={`${ui.fieldError} ${ui.formWide}`} role="alert">
          {error}
        </p>
      ) : null}
      {plan ? (
        <p className={`${ui.caption} ${ui.formWide}`}>
          {portfolio && !targetDate
            ? plan.reachedBy
              ? `At your current pace you'll reach it by ${formatShortMonthYear(plan.reachedBy)}.`
              : "At your current pace it won't get there."
            : `Needs ${formatAmount(plan.needed)} by ${formatShortMonthYear(targetDate.slice(0, 7))}${portfolio ? '' : ' after inflation'}. ${STATUS_LABELS[plan.status]}${plan.extraMonthly ? `: add ${formatAmount(plan.extraMonthly)} a month to reach it.` : '.'}`}
        </p>
      ) : null}
      <div className={`${ui.actions} ${ui.formWide}`}>
        <button className={ui.button} disabled={Boolean(error)} type="submit">
          {goal ? 'Save goal' : 'Add goal'}
        </button>
        <button className={ui.quiet} onClick={onDone} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}
