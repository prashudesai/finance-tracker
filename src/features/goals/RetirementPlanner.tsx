import { Sunset } from 'lucide-react';
import { Fragment, useState } from 'react';
import { averageContributions, netWorth } from '../../domain/analytics';
import {
  addMonths,
  ageOn,
  financialYearLabel,
  financialYearStart,
  lastDayOfMonth,
} from '../../domain/calendar';
import { monthlyAverages, monthsUntil } from '../../domain/goals';
import { holdingValue } from '../../domain/holdings';
import {
  planRetirement,
  REALISTIC,
  retirementFixes,
  retirementNeed,
} from '../../domain/retirement';
import type { TrackerSettings } from '../../schema/records';
import { useSaveSettings, useSettings, useTracker } from '../../store/tracker';
import { LineChart } from '../../ui/charts';
import { Field } from '../../ui/Field';
import { formatAmount, formatShortMonthYear, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import { useIsPhone } from '../../ui/useIsPhone';
import styles from './Goals.module.css';

type Assumptions = NonNullable<TrackerSettings['retirement']>;

/** Ages come from the dates, which only the person can give. */
/** Retirement is the 60th birthday unless another date is picked. */
const RETIRE_AT = 60;

const DEFAULTS: Omit<Assumptions, 'birthDate' | 'retireDate'> = {
  untilAge: 85,
  inflation: 6,
  growthBefore: 10,
  growthAfter: 10,
  stepUp: 5,
  contributions: true,
  fund: 'all',
};

/** A number field that keeps what's typed, even mid-edit, and reports a number. */
function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: number;
}) {
  return (
    <Field label={label}>
      <input
        inputMode="decimal"
        onChange={(event) => onChange(event.target.value)}
        step={step}
        type="number"
        value={value}
      />
    </Field>
  );
}

/**
 * Follows the fund year by year: growing with savings contributions until retirement, then
 * paying expenses that rise with inflation, while what's left keeps growing.
 */
export function RetirementPlanner() {
  const data = useTracker((state) => state.data);
  const settings = useSettings();
  const save = useSaveSettings();
  const phone = useIsPhone();
  const today = localDate();
  const saved = settings.retirement ?? DEFAULTS;

  const retirementIds = new Set(
    data.holdings.filter((row) => row.kind !== 'investment').map((row) => row.id),
  );
  const allFund = netWorth(data, today).assets;
  const retirementFund = data.holdings
    .filter((row) => retirementIds.has(row.id) && row.date <= today)
    .reduce((sum, row) => sum + holdingValue(row, data, today), 0);
  const allContributions = averageContributions(data, today.slice(0, 7));
  const retirementContributions = averageContributions(
    {
      ...data,
      contributions: data.contributions.filter((row) => retirementIds.has(row.holdingId)),
    },
    today.slice(0, 7),
  );
  const recordedSpend = monthlyAverages(data, today)?.expenses ?? 0;

  const [birthDate, setBirthDate] = useState(settings.retirement?.birthDate ?? '');
  const [retireDate, setRetireDate] = useState(settings.retirement?.retireDate ?? '');
  const [values, setValues] = useState(() => ({
    untilAge: String(saved.untilAge),
    inflation: String(saved.inflation),
    growthBefore: String(saved.growthBefore),
    growthAfter: String(saved.growthAfter),
    stepUp: String(saved.stepUp),
    monthlyExpense: String(Math.round(saved.monthlyExpense ?? recordedSpend)),
  }));
  const [contributions, setContributions] = useState(saved.contributions);
  const [fundKind, setFundKind] = useState(saved.fund);
  const [picked, setPicked] = useState<number | null>(null);
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const number = (key: keyof typeof values) => Number(values[key]);
  // Unless a date is chosen, retirement is the 60th birthday.
  const retireOn = retireDate || (birthDate ? addMonths(birthDate, RETIRE_AT * 12) : '');
  const age = birthDate ? ageOn(birthDate, today) : NaN;
  const retireAge = birthDate && retireOn ? ageOn(birthDate, retireOn) : NaN;
  const untilAge = number('untilAge');
  const error = !birthDate
    ? 'Enter your date of birth to see your plan.'
    : age < 18 || age > 100
      ? 'Check your date of birth: the planner is for ages 18 to 100.'
      : !(retireAge >= 18 && retireAge <= 100)
        ? 'Pick a retirement date between ages 18 and 100.'
        : !Number.isInteger(untilAge) || untilAge <= Math.max(age, retireAge) || untilAge > 110
          ? 'Plan until an age after you retire, up to 110.'
          : (['inflation', 'growthBefore', 'growthAfter'] as const).some(
                (key) => !(number(key) >= 0 && number(key) <= 30),
              )
            ? 'Enter inflation and growth between 0% and 30%.'
            : !(number('stepUp') >= 0 && number('stepUp') <= 50)
              ? 'Enter a yearly step-up between 0% and 50%.'
              : !(number('monthlyExpense') > 0)
                ? 'Enter what your household spends in a month.'
                : null;
  /** The first day of the month `months` from now. */
  const monthFromNow = (months: number) => addMonths(`${today.slice(0, 7)}-01`, months);
  const monthLabel = (months: number) => formatShortMonthYear(monthFromNow(months).slice(0, 7));
  /** "Nov 2026 – Oct 2027", the months a stretch of the plan covers. */
  const span = (row: { start: number; months: number }) =>
    row.months === 1
      ? monthLabel(row.start)
      : `${monthLabel(row.start)} – ${monthLabel(row.start + row.months - 1)}`;
  // The age reached in a stretch's first month: today for this one, so it agrees with
  // "You're 40", and that month's end for later ones, so a birthday that month counts.
  const ageAt = (months: number) =>
    ageOn(birthDate, months === 0 ? today : lastDayOfMonth(monthFromNow(months).slice(0, 7)));
  /**
   * The financial year a stretch falls in. A whole year is just "FY 2028-29"; part of one,
   * such as the year you retire in, adds its months: "FY 2027-28 · Apr 2027 – May 2027".
   */
  const fySpan = (row: { start: number; months: number }) => {
    const fy = financialYearLabel(financialYearStart(monthFromNow(row.start)));
    const whole = row.months === 12 && monthFromNow(row.start).slice(5, 7) === '04';
    return whole ? fy : `${fy} · ${span(row)}`;
  };
  /** The month someone turns an age, for showing next to it. */
  const turns = (years: number) =>
    birthDate ? formatShortMonthYear(addMonths(birthDate, years * 12).slice(0, 7)) : '';

  const fund = fundKind === 'retirement' ? retirementFund : allFund;
  const monthlyContribution = contributions
    ? fundKind === 'retirement'
      ? retirementContributions
      : allContributions
    : 0;
  const inputs = {
    fund,
    monthlyExpense: number('monthlyExpense'),
    monthlyContribution,
    stepUp: number('stepUp'),
    age,
    retireAge,
    untilAge,
    inflation: number('inflation'),
    growthBefore: number('growthBefore'),
    growthAfter: number('growthAfter'),
    // Counted from today to the dates, so retiring mid-year retires in that month.
    monthsToRetire: retireOn ? monthsUntil(today, retireOn) : 0,
    months: birthDate ? monthsUntil(today, addMonths(birthDate, (untilAge + 1) * 12)) : 0,
    // Rows follow financial years: the rest of this one, then April to March.
    firstStretch: (16 - Number(today.slice(5, 7))) % 12 || 12,
  };
  const plan = error ? null : planRetirement(inputs);
  const fixes = error ? null : retirementFixes(inputs);
  // A sober check at long-run rates, whatever rates are typed in.
  const need = error ? null : retirementNeed(inputs);
  const usesRosierRates =
    inputs.inflation < REALISTIC.inflation ||
    inputs.growthBefore > REALISTIC.growthBefore ||
    inputs.growthAfter > REALISTIC.growthAfter;

  const next: Assumptions = {
    birthDate,
    retireDate: retireOn,
    untilAge,
    inflation: number('inflation'),
    growthBefore: number('growthBefore'),
    growthAfter: number('growthAfter'),
    stepUp: number('stepUp'),
    contributions,
    fund: fundKind,
    ...(Math.round(number('monthlyExpense')) === Math.round(recordedSpend)
      ? {}
      : { monthlyExpense: number('monthlyExpense') }),
  };
  // Nothing saved yet means the dates are new, so the button shows once they're entered.
  const changed = JSON.stringify(next) !== JSON.stringify(settings.retirement ?? null);
  const retireIndex = plan ? plan.years.findIndex((row) => row.retired) : -1;
  const shown = plan?.years[picked ?? retireIndex];

  return (
    <section aria-label="Retirement planner" className={ui.card}>
      <div className={ui.cardHeader} style={{ justifyContent: 'flex-start' }}>
        <span aria-hidden="true" className={ui.tileIcon}>
          <Sunset size={20} />
        </span>
        <div>
          <h2 style={{ fontSize: '1.2rem' }}>Retirement planner</h2>
          <div className={ui.caption}>How long your money lasts once you stop working</div>
        </div>
      </div>

      {plan ? (
        <div className={styles.retireHead}>
          <div>
            <span className={ui.caption}>
              At {retireAge}, in {formatShortMonthYear(retireOn.slice(0, 7))}
            </span>
            <strong className={styles.percent}>{formatAmount(plan.fundAtRetirement)}</strong>
          </div>
          <div>
            <span className={ui.caption}>Spending a month then</span>
            <strong className={styles.percent}>{formatAmount(plan.monthlyAtRetirement)}</strong>
          </div>
        </div>
      ) : null}
      {plan ? (
        <p className={styles.fix} data-tone={plan.runsOutAt === null ? 'good' : 'watch'}>
          {plan.runsOutMonth === null
            ? `Your money lasts past ${untilAge}, with ${formatAmount(plan.leftOver)} left.`
            : `Your money runs out in ${monthLabel(plan.runsOutMonth)}, at ${ageAt(plan.runsOutMonth)}, ${Math.max(0, untilAge - ageAt(plan.runsOutMonth))} year${untilAge - ageAt(plan.runsOutMonth) === 1 ? '' : 's'} short of ${untilAge}.`}
          <small className={styles.sooner}>
            {formatAmount(inputs.monthlyExpense)} a month today, rising {inputs.inflation}% a year,
            is {formatAmount(plan.monthlyAtRetirement)} a month by {retireAge}.
          </small>
        </p>
      ) : null}
      {fixes ? (
        <div>
          <h3 className={ui.label}>To make it last until {untilAge}</h3>
          <ul className={styles.story}>
            {fixes.extraMonthly !== null ? (
              <li>
                <span aria-hidden="true">•</span>
                <span>
                  Invest <strong>{formatAmount(fixes.extraMonthly)}</strong> more a month until you
                  retire
                </span>
              </li>
            ) : null}
            {fixes.retireAt !== null ? (
              <li>
                <span aria-hidden="true">•</span>
                <span>
                  Or retire at <strong>{fixes.retireAt}</strong>, in {turns(fixes.retireAt)}
                </span>
              </li>
            ) : null}
            {fixes.affordableMonthly !== null ? (
              <li>
                <span aria-hidden="true">•</span>
                <span>
                  Or plan to spend <strong>{formatAmount(fixes.affordableMonthly)}</strong> a month
                  in today's rupees
                </span>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {need ? (
        <section aria-label="What you'll need" className={styles.need}>
          <div className={ui.split}>
            <strong>What you'll need, realistically</strong>
            <span className={ui.chip}>
              {REALISTIC.inflation}% inflation ·{' '}
              {REALISTIC.growthBefore === REALISTIC.growthAfter
                ? `${REALISTIC.growthBefore}% growth`
                : `${REALISTIC.growthBefore}% then ${REALISTIC.growthAfter}% growth`}
            </span>
          </div>
          <div className={styles.needFigures}>
            <div>
              <span className={ui.caption}>Needed at {retireAge}</span>
              <strong>{formatAmount(need.needed)}</strong>
              <small>
                About {Math.round(need.yearsOfSpending)} years of spending then, to last until{' '}
                {untilAge}
              </small>
            </div>
            <div>
              <span className={ui.caption}>On course for</span>
              <strong>{formatAmount(need.onCourse)}</strong>
              <small>
                {need.gap > 0
                  ? `${formatAmount(need.gap)} short`
                  : `${formatAmount(need.onCourse - need.needed)} to spare`}
              </small>
            </div>
          </div>
          <p className={ui.caption} style={{ margin: 0 }}>
            {need.monthlyInvesting === null
              ? `To keep spending ${formatAmount(inputs.monthlyExpense)} a month in today's rupees, the fund has to last ${untilAge - retireAge} years.`
              : need.gap > 0
                ? `Invest about ${formatAmount(need.monthlyInvesting)} a month from now, rising ${inputs.stepUp}% a year, to retire at ${retireAge} on today's ${formatAmount(inputs.monthlyExpense)} a month. You invest ${formatAmount(monthlyContribution)} a month now.`
                : `Your current ${formatAmount(monthlyContribution)} a month, rising ${inputs.stepUp}% a year, gets there. About ${formatAmount(need.monthlyInvesting)} a month would be enough.`}
          </p>
          {usesRosierRates ? (
            <p className={ui.caption} style={{ margin: 0 }}>
              Your assumptions above are more hopeful than these.{' '}
              <button
                className={styles.reset}
                onClick={() => {
                  setValues((current) => ({
                    ...current,
                    inflation: String(REALISTIC.inflation),
                    growthBefore: String(REALISTIC.growthBefore),
                    growthAfter: String(REALISTIC.growthAfter),
                  }));
                }}
                type="button"
              >
                Use these rates
              </button>
            </p>
          ) : null}
        </section>
      ) : null}

      {plan ? (
        <div className={styles.retireChart}>
          <LineChart
            fromZero
            narrow={phone}
            onPick={setPicked}
            picked={picked ?? retireIndex}
            plain
            series={[
              {
                name: 'Fund value',
                points: plan.years.map((row) => ({
                  label: String(ageAt(row.start)),
                  value: row.fundEnd,
                })),
              },
              {
                name: 'Yearly expenses',
                color: 'var(--series-expense)',
                dash: '6 4',
                // A short stretch shows a full year's rate, so the line doesn't dip.
                points: plan.years.map((row) => ({
                  label: String(ageAt(row.start)),
                  value: (row.expenses * 12) / Math.max(row.months, 1),
                })),
              },
            ]}
            title="Fund value and yearly expenses by age"
          />
          <p className={styles.milestoneNote}>
            <span aria-hidden="true">┃</span> The line marks retirement in{' '}
            {monthLabel(plan.monthsToRetire)}, at {ageAt(plan.monthsToRetire)}, with{' '}
            {formatAmount(plan.fundAtRetirement)}.
          </p>
          {shown ? (
            <p aria-live="polite" className={ui.caption} style={{ margin: 0 }}>
              <strong>
                {fySpan(shown)}, age {ageAt(shown.start)}
                {shown.retired ? ', retired' : ''}
              </strong>
              : fund {formatAmount(shown.fundEnd)} at the end, expenses{' '}
              {formatAmount(shown.expenses)}
              {shown.unpaid > 0 ? `, ${formatAmount(shown.unpaid)} not covered` : ''}. Tap the chart
              to see another stretch.
            </p>
          ) : null}
        </div>
      ) : null}

      {plan ? (
        <details className={ui.fold}>
          <summary>Year by year</summary>
          <p className={ui.caption}>
            From this month on. Your fund today already includes everything put in so far.
          </p>
          {phone ? (
            <ul className={ui.list}>
              {plan.years.map((row) => (
                <Fragment key={row.start}>
                  {row.start === plan.monthsToRetire && row.retired ? (
                    <li className={styles.milestone}>
                      Retire in {monthLabel(row.start)} at {ageAt(row.start)}, with{' '}
                      {formatAmount(plan.fundAtRetirement)}
                    </li>
                  ) : null}
                  <li className={ui.row}>
                    <div className={ui.rowMain}>
                      <div className={ui.rowTitle}>
                        {fySpan(row)}
                        <span className={ui.caption}> · age {ageAt(row.start)}</span>
                      </div>
                      <div className={ui.rowDetail}>
                        {row.retired
                          ? `Takes ${formatAmount(row.withdrawn)} · grows ${formatAmount(row.growth)}`
                          : `Adds ${formatAmount(row.added)} · grows ${formatAmount(row.growth)}`}
                        {row.unpaid > 0 ? ` · ${formatAmount(row.unpaid)} not covered` : ''}
                      </div>
                    </div>
                    <span className={ui.amount}>{formatAmount(row.fundEnd)}</span>
                  </li>
                </Fragment>
              ))}
            </ul>
          ) : (
            <div aria-label="Scrollable table" className={ui.tableWrap} role="group" tabIndex={0}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Financial year · age</th>
                    <th className={ui.numeric}>Fund at start</th>
                    <th className={ui.numeric}>Added</th>
                    <th className={ui.numeric}>Growth</th>
                    <th className={ui.numeric}>Taken out</th>
                    <th className={ui.numeric}>Fund at end</th>
                    <th className={ui.numeric}>Expenses</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.years.map((row) => (
                    <Fragment key={row.start}>
                      {row.start === plan.monthsToRetire && row.retired ? (
                        <tr className={styles.milestoneRow}>
                          <td colSpan={7}>
                            Retire in {monthLabel(row.start)} at {ageAt(row.start)}, with{' '}
                            {formatAmount(plan.fundAtRetirement)}
                          </td>
                        </tr>
                      ) : null}
                      <tr>
                        <td>
                          {fySpan(row)} · age {ageAt(row.start)}
                        </td>
                        <td className={ui.numeric}>{formatAmount(row.fundStart)}</td>
                        <td className={ui.numeric}>{formatAmount(row.added)}</td>
                        <td className={ui.numeric}>{formatAmount(row.growth)}</td>
                        <td className={ui.numeric}>{formatAmount(row.withdrawn)}</td>
                        <td className={ui.numeric}>{formatAmount(row.fundEnd)}</td>
                        <td className={ui.numeric}>
                          {formatAmount(row.expenses)}
                          {row.unpaid > 0 ? ` (${formatAmount(row.unpaid)} not covered)` : ''}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      ) : null}

      <details className={ui.fold} open={Boolean(error) || undefined}>
        <summary>Your assumptions</summary>
        <div className={ui.page}>
          <div aria-label="Fund" className={styles.kinds} role="radiogroup">
            {(
              [
                ['all', 'All investments', allFund],
                ['retirement', 'Retirement accounts', retirementFund],
              ] as const
            ).map(([key, label, value]) => (
              <button
                aria-checked={fundKind === key}
                className={styles.kind}
                key={key}
                onClick={() => setFundKind(key)}
                role="radio"
                type="button"
              >
                {label}
                <span>{formatAmount(Math.round(value))} today</span>
              </button>
            ))}
          </div>
          <div className={ui.form}>
            <NumberField
              label="Monthly spending today (₹)"
              onChange={set('monthlyExpense')}
              value={values.monthlyExpense}
            />
            <Field label="Date of birth">
              <input
                max={today}
                onChange={(event) => {
                  // A retirement date that was simply the 60th birthday moves with the birth date.
                  if (birthDate && retireDate === addMonths(birthDate, RETIRE_AT * 12)) {
                    setRetireDate('');
                  }
                  setBirthDate(event.target.value);
                }}
                type="date"
                value={birthDate}
              />
              <span className={ui.caption}>
                {birthDate && age >= 0 ? `You're ${age}` : 'Your age comes from this'}
              </span>
            </Field>
            <Field label="Retire on">
              <input
                min={birthDate || undefined}
                onChange={(event) => setRetireDate(event.target.value)}
                type="date"
                value={retireOn}
              />
              <span className={ui.caption}>
                {retireOn && retireAge >= 0
                  ? `You'll be ${retireAge}`
                  : 'Your 60th birthday, unless you pick a date'}
              </span>
            </Field>
            <NumberField
              label="Plan until age"
              onChange={set('untilAge')}
              value={values.untilAge}
            />
            <NumberField
              label="Prices rise each year (%)"
              onChange={set('inflation')}
              step={0.5}
              value={values.inflation}
            />
            <NumberField
              label="Growth before retiring (%)"
              onChange={set('growthBefore')}
              step={0.5}
              value={values.growthBefore}
            />
            <NumberField
              label="Growth after retiring (%)"
              onChange={set('growthAfter')}
              step={0.5}
              value={values.growthAfter}
            />
            <NumberField
              label="Contributions rise each year (%)"
              onChange={set('stepUp')}
              step={1}
              value={values.stepUp}
            />
          </div>
          <label className={ui.check}>
            <input
              checked={contributions}
              onChange={(event) => setContributions(event.target.checked)}
              type="checkbox"
            />
            Keep investing{' '}
            {formatAmount(
              Math.round(fundKind === 'retirement' ? retirementContributions : allContributions),
            )}{' '}
            a month until I retire
          </label>
          <span className={ui.caption}>
            Spending starts from your recorded average of {formatAmount(recordedSpend)} a month.
            Contributions are your savings contributions average, and stop when you retire.
          </span>
        </div>
      </details>

      {error ? (
        <p className={ui.fieldError} role="alert">
          {error}
        </p>
      ) : null}
      {changed && !error ? (
        <div className={ui.actions}>
          <button className={ui.button} onClick={() => save({ retirement: next })} type="button">
            Save these assumptions
          </button>
        </div>
      ) : null}
      <p className={ui.caption} style={{ margin: 0 }}>
        Assumes steady growth and inflation every year, which real life never gives. Treat it as a
        guide, and revisit it each year.
      </p>
    </section>
  );
}
