import {
  Banknote,
  CalendarClock,
  Landmark,
  Layers,
  Pencil,
  PiggyBank,
  SlidersHorizontal,
  Sunset,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Fragment, useMemo, useRef, useState } from 'react';
import { averageContributions, holdingGroups, netWorth } from '../../domain/analytics';
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
  type RetirementInputs,
  type RetirementPart,
} from '../../domain/retirement';
import { useSaveSettings, useSettings, useSpendingHousehold } from '../../store/tracker';
import { LineChart } from '../../ui/charts';
import { Field } from '../../ui/Field';
import { formatAmount, formatShortMonthYear, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import { useIsPhone } from '../../ui/useIsPhone';
import { useMedia } from '../../ui/useMedia';
import styles from './Goals.module.css';
import {
  afterOf,
  BEHAVIOURS,
  DEFAULTS,
  draftOf,
  EVERY,
  monthlyOf,
  MOVED,
  RETIRE_AT,
  type AfterDraft,
  type Assumptions,
} from './retirementInputs';

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
/** Life in three stretches: working, retired on the fund, and any years it doesn't cover. */
function Timeline({
  age,
  retireAge,
  endAge,
  untilAge,
}: {
  age: number;
  retireAge: number;
  endAge: number;
  untilAge: number;
}) {
  const span = Math.max(1, untilAge - age);
  const share = (years: number) => `${(Math.max(0, years) / span) * 100}%`;
  const funded = Math.min(endAge, untilAge) - retireAge;
  const short = untilAge - Math.max(endAge, retireAge);
  return (
    <div className={styles.timeline}>
      <div aria-hidden="true" className={styles.timelineBar}>
        <span className={styles.working} style={{ width: share(retireAge - age) }} />
        <span className={styles.funded} style={{ width: share(funded) }} />
        {short > 0 ? <span className={styles.short} style={{ width: share(short) }} /> : null}
      </div>
      <ul className={styles.timelineKey}>
        <li>
          <i className={styles.working} /> Working, {age} to {retireAge}
        </li>
        <li>
          <i className={styles.funded} /> Retired on your fund
          {short > 0 ? `, to ${endAge}` : `, past ${untilAge}`}
        </li>
        {short > 0 ? (
          <li>
            <i className={styles.short} /> Not covered, {endAge} to {untilAge}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

const BEHAVIOUR_HINTS = {
  growth: 'Keeps growing after you retire, and is sold bit by bit when spending needs it.',
  income: 'Pays you regularly, like an FD or SCSS, and its value stays the same.',
  both: 'Keeps growing and pays you as well, like a dividend fund or a rented flat.',
} as const;

export function RetirementPlanner() {
  const data = useSpendingHousehold();
  const settings = useSettings();
  const save = useSaveSettings();
  const phone = useIsPhone();
  // Wide enough for the two charts side by side, each drawn in its narrower form.
  const paired = useMedia('(min-width: 1000px)');
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
  const [chart, setChart] = useState<'fund' | 'spending'>('fund');
  // The investment open for editing after retiring; the rest show what they do.
  const [editingAfter, setEditingAfter] = useState<string | null>(null);
  const [spendPicked, setSpendPicked] = useState(0);
  // Opened by hand or by an error, the assumptions stay open until closed by hand.
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const [afterMode, setAfterMode] = useState(saved.afterMode ?? 'simple');
  const [drafts, setDrafts] = useState<Record<string, AfterDraft>>(() =>
    Object.fromEntries(
      Object.entries(saved.after ?? {}).map(([key, row]) => [key, draftOf(row, saved.growthAfter)]),
    ),
  );
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const number = (key: keyof typeof values) => Number(values[key]);
  const draftFor = (key: string) => drafts[key] ?? draftOf(undefined, number('growthAfter'));
  const setDraft = (key: string, change: Partial<AfterDraft>) =>
    setDrafts((current) => ({ ...current, [key]: { ...draftFor(key), ...change } }));

  // The fund's investments, PF, PPF and NPS as one each, with what goes into each a month.
  const groups = holdingGroups(
    data.holdings.filter(
      (row) => row.date <= today && (fundKind === 'all' || retirementIds.has(row.id)),
    ),
  )
    .map((group) => {
      const ids = new Set(group.holdings.map((row) => row.id));
      return {
        ...group,
        value: group.holdings.reduce((sum, row) => sum + holdingValue(row, data, today), 0),
        contributes: averageContributions(
          { ...data, contributions: data.contributions.filter((row) => ids.has(row.holdingId)) },
          today.slice(0, 7),
        ),
      };
    })
    .filter((group) => group.value > 0 || group.contributes > 0)
    .sort((a, b) => b.value - a.value);
  const each = afterMode === 'each' && groups.length > 0;
  const totalContributes = groups.reduce((sum, group) => sum + group.contributes, 0);
  const totalValue = groups.reduce((sum, group) => sum + group.value, 0);
  const parts: RetirementPart[] = groups.map((group) => {
    const after = afterOf(draftFor(group.key));
    return {
      name: group.key,
      value: group.value,
      // Contributions go where they go now, or by value when nothing goes in yet.
      share:
        totalContributes > 0
          ? group.contributes / totalContributes
          : totalValue > 0
            ? group.value / totalValue
            : 1 / groups.length,
      growth: after.growth,
      payout: after.payout,
      ...(after.payoutFixed ? { payoutMonthly: monthlyOf(after.payoutFixed) } : {}),
      sellable: after.sellable,
      ...(after.move ? { move: after.move } : {}),
    };
  });
  /** The first investment with a rate left blank or out of range, said in plain words. */
  const eachError = (() => {
    if (!each) return null;
    const inRange = (value: string) =>
      value.trim() !== '' && Number(value) >= 0 && Number(value) <= 30;
    for (const group of groups) {
      const draft = draftFor(group.key);
      if (draft.behaviour !== 'income' && !inRange(draft.growth))
        return `Enter how much ${group.label} grows a year, from 0% to 30%.`;
      if (draft.behaviour !== 'growth' && draft.payoutIn === 'percent' && !inRange(draft.payout))
        return `Enter how much ${group.label} pays a year, from 0% to 30%.`;
      if (
        draft.behaviour !== 'growth' &&
        draft.payoutIn === 'amount' &&
        !(Number(draft.payoutAmount) > 0 && Number(draft.payoutAmount) <= 1_00_00_000)
      )
        return `Enter how much ${group.label} pays each ${draft.payoutEvery}, in rupees.`;
      if (draft.behaviour !== 'income' && draft.moving) {
        const share = Number(draft.moveShare);
        if (draft.moveShare.trim() === '' || !(share > 0 && share <= 100))
          return `Enter a share of ${group.label} to move, from 1% to 100%.`;
        if (!inRange(draft.movePayout))
          return `Enter how much the money moved from ${group.label} pays a year, from 0% to 30%.`;
      }
    }
    return null;
  })();
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
                : eachError;
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
    ...(each ? { parts } : {}),
  };
  // Worked out again only when an input changes, not on every redraw, such as picking an age.
  const inputsKey = error ? '' : JSON.stringify(inputs);
  const worked = useMemo(() => {
    if (!inputsKey) return null;
    const given = JSON.parse(inputsKey) as RetirementInputs;
    return {
      plan: planRetirement(given),
      fixes: retirementFixes(given),
      // A sober check at long-run rates, or yours where they're more cautious.
      need: retirementNeed(given),
    };
  }, [inputsKey]);
  const plan = worked?.plan ?? null;
  const fixes = worked?.fixes ?? null;
  const need = worked?.need ?? null;
  const usesRosierRates =
    inputs.inflation < REALISTIC.inflation ||
    inputs.growthBefore > REALISTIC.growthBefore ||
    (!each && inputs.growthAfter > REALISTIC.growthAfter);

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
    ...(each
      ? {
          afterMode: 'each' as const,
          after: Object.fromEntries(
            groups.map((group) => [group.key, afterOf(draftFor(group.key))]),
          ),
        }
      : {}),
  };
  // Nothing saved yet means the dates are new, so the button shows once they're entered.
  const changed = JSON.stringify(next) !== JSON.stringify(settings.retirement ?? null);
  /**
   * The plan by year of age: the fund at the end of each, and, once retired, that year's
   * spending against what the fund makes, both at a yearly rate so a part year doesn't dip.
   */
  const ages: {
    age: number;
    fund: number;
    retired: boolean;
    spending: number;
    earned: number;
  }[] = [];
  if (plan) {
    let retiredMonths = 0;
    plan.monthly.forEach((month, index) => {
      const at = ageAt(index);
      let row = ages.at(-1);
      if (!row || row.age !== at) {
        retiredMonths = 0;
        row = { age: at, fund: 0, retired: false, spending: 0, earned: 0 };
        ages.push(row);
      }
      row.fund = month.fund;
      if (index >= plan.monthsToRetire) {
        retiredMonths += 1;
        row.retired = true;
        // Kept as a running yearly rate over the retired months so far.
        row.spending =
          (row.spending * (retiredMonths - 1)) / retiredMonths +
          (month.expense * 12) / retiredMonths;
        row.earned =
          (row.earned * (retiredMonths - 1)) / retiredMonths + (month.earned * 12) / retiredMonths;
      }
    });
  }
  const retireAgeIndex = ages.findIndex((row) => row.retired);
  const retiredAges = ages.filter((row) => row.retired);
  // The age picked on the spending chart, from the first year retired.
  const spendIndex = Math.min(spendPicked, retiredAges.length - 1);
  const spendRow = retiredAges[spendIndex];
  // The first year spending passes what the fund makes, when it starts to shrink.
  const shrinksFrom = retiredAges.find((row) => row.spending > row.earned);
  const shown = ages[picked ?? retireAgeIndex];

  return (
    <section aria-label="Retirement planner" className={ui.card} ref={sectionRef}>
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
        <div className={styles.journey} data-tone={plan.runsOutMonth === null ? 'good' : 'watch'}>
          <div className={styles.verdict}>
            <span>{plan.runsOutMonth === null ? 'Your money lasts' : 'Your money runs out'}</span>
            <strong>
              {plan.runsOutMonth === null ? `Past ${untilAge}` : `At ${ageAt(plan.runsOutMonth)}`}
            </strong>
          </div>
          {Number.isFinite(age) && Number.isFinite(retireAge) && untilAge > age ? (
            <Timeline
              age={age}
              endAge={plan.runsOutMonth === null ? untilAge : ageAt(plan.runsOutMonth)}
              retireAge={retireAge}
              untilAge={untilAge}
            />
          ) : null}
          <dl className={styles.journeyFacts}>
            <div>
              <dt>Fund at {retireAge}</dt>
              <dd>{formatAmount(plan.fundAtRetirement)}</dd>
            </div>
            <div>
              <dt>Spending then</dt>
              <dd>{formatAmount(plan.monthlyAtRetirement)} a month</dd>
            </div>
            <div>
              <dt>Retiring</dt>
              <dd>{formatShortMonthYear(retireOn.slice(0, 7))}</dd>
            </div>
          </dl>
        </div>
      ) : null}
      {plan ? (
        <p className={styles.journeyNote}>
          {plan.runsOutMonth === null
            ? `Your money lasts past ${untilAge}, with ${formatAmount(plan.leftOver)} left.`
            : `Your money runs out in ${monthLabel(plan.runsOutMonth)}, at ${ageAt(plan.runsOutMonth)}, ${Math.max(0, untilAge - ageAt(plan.runsOutMonth))} year${untilAge - ageAt(plan.runsOutMonth) === 1 ? '' : 's'} short of ${untilAge}.`}
          <small className={styles.sooner}>
            {formatAmount(inputs.monthlyExpense)} a month today, rising {inputs.inflation}% a year,
            is {formatAmount(plan.monthlyAtRetirement)} a month by {retireAge}.
            {each && plan.payoutAtRetirement > 0
              ? ` Payouts cover ${formatAmount(plan.payoutAtRetirement)} of it, so ${
                  plan.payoutAtRetirement >= plan.monthlyAtRetirement
                    ? 'nothing needs selling at first'
                    : `${formatAmount(plan.monthlyAtRetirement - plan.payoutAtRetirement)} a month comes from selling`
                }.`
              : ''}
          </small>
        </p>
      ) : null}
      {fixes ? (
        <div>
          <h3 className={ui.label}>To make it last until {untilAge}</h3>
          <ul className={styles.options}>
            {fixes.extraMonthly !== null ? (
              <li>
                <PiggyBank aria-hidden="true" size={18} />
                <span>
                  Invest <strong>{formatAmount(fixes.extraMonthly)}</strong> more a month until you
                  retire
                </span>
              </li>
            ) : null}
            {fixes.retireAt !== null ? (
              <li>
                <CalendarClock aria-hidden="true" size={18} />
                <span>
                  Or retire at <strong>{fixes.retireAt}</strong>, in {turns(fixes.retireAt)}
                </span>
              </li>
            ) : null}
            {fixes.affordableMonthly !== null ? (
              <li>
                <Wallet aria-hidden="true" size={18} />
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
              {need.rates.inflation}% inflation ·{' '}
              {each
                ? `${need.rates.growthBefore}% growth before retiring, then your rates`
                : need.rates.growthBefore === need.rates.growthAfter
                  ? `${need.rates.growthBefore}% growth`
                  : `${need.rates.growthBefore}% growth before retiring, ${need.rates.growthAfter}% after`}
            </span>
          </div>
          <div
            aria-hidden="true"
            className={styles.needMeter}
            data-tone={need.gap > 0 ? 'watch' : 'good'}
          >
            <i
              style={{
                width: `${Math.min(100, need.needed > 0 ? (need.onCourse / need.needed) * 100 : 100)}%`,
              }}
            />
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
                {plan && need.onCourse !== plan.fundAtRetirement
                  ? `. Your plan's ${inputs.growthBefore}% growth gives ${formatAmount(plan.fundAtRetirement)}`
                  : ''}
              </small>
            </div>
          </div>
          <p className={ui.caption} style={{ margin: 0 }}>
            {need.monthlyInvesting === null
              ? `To keep spending ${formatAmount(inputs.monthlyExpense)} a month in today's rupees, the fund has to last ${untilAge - retireAge} years.`
              : need.gap > 0
                ? `Invest about ${formatAmount(need.monthlyInvesting)} a month from now, rising ${inputs.stepUp}% a year, to retire at ${retireAge} on today's ${formatAmount(inputs.monthlyExpense)} a month. You invest ${formatAmount(monthlyContribution)} a month now.`
                : need.monthlyInvesting === 0
                  ? `Your fund today gets there on its own, even without investing more. You invest ${formatAmount(monthlyContribution)} a month now.`
                  : `Your current ${formatAmount(monthlyContribution)} a month, rising ${inputs.stepUp}% a year, gets there. About ${formatAmount(need.monthlyInvesting)} a month would be enough.`}
          </p>
          {usesRosierRates ? (
            <p className={ui.caption} style={{ margin: 0 }}>
              Your assumptions above are more hopeful than {REALISTIC.inflation}% inflation and{' '}
              {REALISTIC.growthBefore}% growth.{' '}
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

      {plan && retiredAges.length > 1 ? (
        <div aria-label="Chart" className={styles.chartTabs} role="group">
          {(
            [
              ['fund', 'Fund by age'],
              ['spending', 'Spending after retiring'],
            ] as const
          ).map(([key, label]) => (
            <button
              aria-pressed={chart === key}
              className={styles.chartTab}
              key={key}
              onClick={() => setChart(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <div className={styles.retireCharts}>
        {plan && ages.length > 1 && (chart === 'fund' || retiredAges.length <= 1) ? (
          <div className={styles.retireChart}>
            <LineChart
              fromZero
              narrow={phone || paired}
              onPick={setPicked}
              picked={picked ?? retireAgeIndex}
              plain
              series={[
                {
                  name: 'Fund value',
                  points: ages.map((row) => ({ label: String(row.age), value: row.fund })),
                },
              ]}
              title="Your fund at the end of each year of age"
            />
            <p className={styles.milestoneNote}>
              <span aria-hidden="true">┃</span> The line marks retirement in{' '}
              {monthLabel(plan.monthsToRetire)}, at {ageAt(plan.monthsToRetire)}, with{' '}
              {formatAmount(plan.fundAtRetirement)}.
            </p>
            {shown ? (
              <p aria-live="polite" className={ui.caption} style={{ margin: 0 }}>
                <strong>
                  Age {shown.age}
                  {shown.retired ? ', retired' : ''}
                </strong>
                : {formatAmount(shown.fund)} at the end of the year
                {shown.retired
                  ? `, spending ${formatAmount(shown.spending)} a year while the fund makes ${formatAmount(shown.earned)}`
                  : ''}
                . Tap the chart to see another age.
              </p>
            ) : null}
          </div>
        ) : null}

        {plan && retiredAges.length > 1 && chart === 'spending' ? (
          <div className={styles.retireChart}>
            <LineChart
              fromZero
              narrow={phone || paired}
              onPick={setSpendPicked}
              picked={spendIndex}
              plain
              series={[
                {
                  name: 'Spending a year',
                  color: 'var(--series-expense)',
                  points: retiredAges.map((row) => ({
                    label: String(row.age),
                    value: row.spending,
                  })),
                },
              ]}
              title="Yearly spending after you retire, by age"
            />
            <p className={ui.caption} style={{ margin: 0 }}>
              Rising {inputs.inflation}% a year with prices:{' '}
              {formatAmount(retiredAges[0]?.spending ?? 0)} a year at {retiredAges[0]?.age}, and{' '}
              {formatAmount(retiredAges.at(-1)?.spending ?? 0)} by {retiredAges.at(-1)?.age}.
              {shrinksFrom
                ? ` From ${shrinksFrom.age}, that's more than the fund makes, so it starts to shrink.`
                : ' The fund makes more than this every year, so it keeps growing.'}
            </p>
            {spendRow ? (
              <p aria-live="polite" className={ui.caption} style={{ margin: 0 }}>
                <strong>Age {spendRow.age}</strong>: spending {formatAmount(spendRow.spending)} a
                year, about {formatAmount(spendRow.spending / 12)} a month. Tap the chart to see
                another age.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

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
                          ? `${row.payouts > 0 ? `Pays ${formatAmount(row.payouts)} · ` : ''}Takes ${formatAmount(row.withdrawn)} · grows ${formatAmount(row.growth)}`
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
                    {each ? <th className={ui.numeric}>Payouts</th> : null}
                    <th className={ui.numeric}>{each ? 'Sold' : 'Taken out'}</th>
                    <th className={ui.numeric}>Fund at end</th>
                    <th className={ui.numeric}>Expenses</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.years.map((row) => (
                    <Fragment key={row.start}>
                      {row.start === plan.monthsToRetire && row.retired ? (
                        <tr className={styles.milestoneRow}>
                          <td colSpan={each ? 8 : 7}>
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
                        {each ? <td className={ui.numeric}>{formatAmount(row.payouts)}</td> : null}
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

      <details
        className={ui.fold}
        onToggle={(event) => setAssumptionsOpen(event.currentTarget.open)}
        open={assumptionsOpen || Boolean(error)}
      >
        <summary>
          Your assumptions
          <span className={styles.assumeSummary}>
            {values.inflation}% inflation · {values.growthBefore}% growth
            {Number.isFinite(retireAge) ? ` · retire at ${retireAge}` : ''}
          </span>
        </summary>
        <div className={ui.page}>
          <section className={styles.assumeGroup}>
            <h3>
              <CalendarClock aria-hidden="true" size={16} /> You
            </h3>
            <div className={styles.assumptions}>
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
            </div>
          </section>

          <section className={styles.assumeGroup}>
            <h3>
              <Wallet aria-hidden="true" size={16} /> Spending
            </h3>
            <div className={styles.assumptions}>
              <NumberField
                label="Monthly spending today (₹)"
                onChange={set('monthlyExpense')}
                value={values.monthlyExpense}
              />
              <NumberField
                label="Prices rise each year (%)"
                onChange={set('inflation')}
                step={0.5}
                value={values.inflation}
              />
            </div>
            <span className={ui.caption}>
              Spending starts from your recorded average of {formatAmount(recordedSpend)} a month.
              Contributions are your savings contributions average, and stop when you retire.
            </span>
          </section>

          <section className={styles.assumeGroup}>
            <h3>
              <PiggyBank aria-hidden="true" size={16} /> Investing until you retire
            </h3>
            <div className={styles.modeGroup}>
              <h4 className={styles.groupLabel}>Which money counts</h4>
              <div aria-label="Fund" className={styles.modes} role="radiogroup">
                {(
                  [
                    ['all', 'All investments', allFund, Wallet],
                    ['retirement', 'Retirement accounts', retirementFund, Landmark],
                  ] as const
                ).map(([key, label, value, Icon]) => (
                  <button
                    aria-checked={fundKind === key}
                    className={styles.mode}
                    key={key}
                    onClick={() => setFundKind(key)}
                    role="radio"
                    type="button"
                  >
                    <span aria-hidden="true" className={styles.modeIcon}>
                      <Icon size={18} />
                    </span>
                    <strong>{label}</strong>
                    <small>{formatAmount(Math.round(value))} today</small>
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.assumptions}>
              <NumberField
                label="Growth before retiring (%)"
                onChange={set('growthBefore')}
                step={0.5}
                value={values.growthBefore}
              />
              <NumberField
                label="Contributions rise a year (%)"
                onChange={set('stepUp')}
                step={1}
                value={values.stepUp}
              />
              {each ? null : (
                <NumberField
                  label="Growth after retiring (%)"
                  onChange={set('growthAfter')}
                  step={0.5}
                  value={values.growthAfter}
                />
              )}
            </div>
            <label className={styles.assumeToggle}>
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
          </section>

          <div className={`${styles.modeGroup} ${styles.assumeGroup}`}>
            <h3>
              <Sunset aria-hidden="true" size={16} /> After you retire
            </h3>
            <div aria-label="After you retire" className={styles.modes} role="radiogroup">
              {(
                [
                  ['simple', 'One growth rate', 'For the whole fund', TrendingUp],
                  ['each', 'Set each investment', 'Growth, income or both', SlidersHorizontal],
                ] as const
              ).map(([key, label, detail, Icon]) => (
                <button
                  aria-checked={afterMode === key}
                  className={styles.mode}
                  disabled={key === 'each' && groups.length === 0}
                  key={key}
                  onClick={() => setAfterMode(key)}
                  role="radio"
                  type="button"
                >
                  <span aria-hidden="true" className={styles.modeIcon}>
                    <Icon size={18} />
                  </span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </button>
              ))}
            </div>
          </div>
          {each ? (
            <ul aria-label="Each investment after retiring" className={styles.afterList}>
              {groups.map((group) => {
                const draft = draftFor(group.key);
                const after = afterOf(draft);
                const atRetirement = plan?.partsAtRetirement.find(
                  (part) => part.name === group.key,
                );
                const moved = plan?.partsAtRetirement.find(
                  (part) => part.name === `${group.key}${MOVED}`,
                );
                const monthly = (part: RetirementPart | undefined, payout: number) =>
                  formatAmount(Math.round(((part?.value ?? 0) * payout) / 1200));
                const pays =
                  draft.payoutIn === 'amount'
                    ? Number(draft.payoutAmount) > 0
                      ? `pays ${formatAmount(Number(draft.payoutAmount))} a ${draft.payoutEvery}`
                      : 'pays an amount not set yet'
                    : `pays ${draft.payout || 0}% of its value a year`;
                const does =
                  draft.behaviour === 'growth'
                    ? `Grows ${draft.growth || 0}% a year`
                    : draft.behaviour === 'income'
                      ? `Income: ${pays}`
                      : `Grows ${draft.growth || 0}% and ${pays}`;
                const extra = [
                  draft.behaviour !== 'income' && draft.moving
                    ? `moves ${draft.moveShare || 0}% into income`
                    : '',
                  draft.behaviour !== 'growth' && draft.sellable ? 'can be sold' : '',
                ].filter(Boolean);
                const open = editingAfter === group.key;
                const Icon =
                  draft.behaviour === 'growth'
                    ? TrendingUp
                    : draft.behaviour === 'income'
                      ? Banknote
                      : Layers;
                return (
                  <li className={styles.afterRow} data-open={open || undefined} key={group.key}>
                    <button
                      aria-expanded={open}
                      aria-label={`${group.label}: ${does}. ${open ? 'Close' : 'Edit'}`}
                      className={styles.afterTile}
                      onClick={() => setEditingAfter(open ? null : group.key)}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className={styles.afterIcon}
                        data-kind={draft.behaviour}
                      >
                        <Icon size={18} />
                      </span>
                      <span className={styles.afterText}>
                        <strong>{group.label}</strong>
                        <small>
                          {formatAmount(Math.round(group.value))} today
                          {group.holdings.length > 1 ? ` · ${group.holdings.length} accounts` : ''}
                        </small>
                        <span className={styles.afterDoes}>
                          {does}
                          {extra.length > 0 ? ` · ${extra.join(' · ')}` : ''}
                        </span>
                      </span>
                      <span className={styles.afterEdit}>
                        {open ? 'Done' : <Pencil aria-hidden="true" size={15} />}
                      </span>
                    </button>
                    {open ? (
                      <div className={styles.afterEditor}>
                        <div
                          aria-label={`${group.label} after retiring`}
                          className={styles.behaviours}
                          role="radiogroup"
                        >
                          {BEHAVIOURS.map(([key, label]) => (
                            <button
                              aria-checked={draft.behaviour === key}
                              className={styles.behaviour}
                              key={key}
                              onClick={() => setDraft(group.key, { behaviour: key })}
                              role="radio"
                              type="button"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className={styles.afterHint}>{BEHAVIOUR_HINTS[draft.behaviour]}</p>
                        {draft.behaviour !== 'income' ? (
                          <div className={styles.afterFields}>
                            <NumberField
                              label="Grows a year (%)"
                              onChange={(value) => setDraft(group.key, { growth: value })}
                              step={0.5}
                              value={draft.growth}
                            />
                          </div>
                        ) : null}
                        {draft.behaviour !== 'growth' ? (
                          <div className={styles.afterStep}>
                            <span className={styles.afterStepLabel}>How does it pay you?</span>
                            <div
                              aria-label={`How ${group.label} pays`}
                              className={styles.payIn}
                              role="radiogroup"
                            >
                              {(
                                [
                                  ['amount', '₹ amount'],
                                  ['percent', '% a year'],
                                ] as const
                              ).map(([key, label]) => (
                                <button
                                  aria-checked={draft.payoutIn === key}
                                  className={styles.behaviour}
                                  key={key}
                                  onClick={() => setDraft(group.key, { payoutIn: key })}
                                  role="radio"
                                  type="button"
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                            {draft.payoutIn === 'amount' ? (
                              <div
                                aria-label={`How often ${group.label} pays`}
                                className={styles.every}
                                role="radiogroup"
                              >
                                {EVERY.map(([key, label]) => (
                                  <button
                                    aria-checked={draft.payoutEvery === key}
                                    className={styles.behaviour}
                                    key={key}
                                    onClick={() => setDraft(group.key, { payoutEvery: key })}
                                    role="radio"
                                    type="button"
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            <div className={styles.afterFields}>
                              {draft.payoutIn === 'amount' ? (
                                <NumberField
                                  label={`Amount each ${draft.payoutEvery} (₹)`}
                                  onChange={(value) => setDraft(group.key, { payoutAmount: value })}
                                  step={500}
                                  value={draft.payoutAmount}
                                />
                              ) : (
                                <NumberField
                                  label="Share of its value paid a year (%)"
                                  onChange={(value) => setDraft(group.key, { payout: value })}
                                  step={0.1}
                                  value={draft.payout}
                                />
                              )}
                            </div>
                          </div>
                        ) : null}
                        {draft.behaviour !== 'growth' && atRetirement ? (
                          <span className={ui.caption}>
                            {after.payoutFixed
                              ? `${formatAmount(after.payoutFixed.amount)} a ${after.payoutFixed.every} from when you retire${after.payoutFixed.every === 'month' ? '' : `, about ${formatAmount(Math.round(monthlyOf(after.payoutFixed)))} a month`}${atRetirement.value > 0 ? `, or ${((monthlyOf(after.payoutFixed) * 1200) / atRetirement.value).toFixed(1)}% a year of ${formatAmount(atRetirement.value)}` : ''}`
                              : `About ${monthly(atRetirement, after.payout)} a month when you retire, on ${formatAmount(atRetirement.value)}`}
                            {draft.behaviour === 'income' ? ', which stays the same' : ''}.
                          </span>
                        ) : null}
                        {draft.behaviour !== 'growth' ? (
                          <label className={ui.check}>
                            <input
                              checked={draft.sellable}
                              onChange={(event) =>
                                setDraft(group.key, { sellable: event.target.checked })
                              }
                              type="checkbox"
                            />
                            If other money runs out, this can be sold too
                          </label>
                        ) : null}
                        {draft.behaviour !== 'income' ? (
                          <label className={ui.check}>
                            <input
                              checked={draft.moving}
                              onChange={(event) =>
                                setDraft(group.key, { moving: event.target.checked })
                              }
                              type="checkbox"
                            />
                            At retirement, move part of it into something that pays income
                          </label>
                        ) : null}
                        {draft.behaviour !== 'income' && draft.moving ? (
                          <>
                            <div className={styles.afterFields}>
                              <NumberField
                                label="Share to move (%)"
                                onChange={(value) => setDraft(group.key, { moveShare: value })}
                                step={5}
                                value={draft.moveShare}
                              />
                              <NumberField
                                label="It pays a year (%)"
                                onChange={(value) => setDraft(group.key, { movePayout: value })}
                                step={0.1}
                                value={draft.movePayout}
                              />
                            </div>
                            {moved && after.move ? (
                              <span className={ui.caption}>
                                {formatAmount(moved.value)} moved, such as into SCSS or an annuity,
                                paying about {monthly(moved, after.move.payout)} a month.
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {each ? (
            <span className={ui.caption}>
              Payouts pay your spending first. Anything short comes from selling what pays nothing,
              then what grows and pays, and what only pays income last. Payouts beyond your spending
              are reinvested in what grows.
            </span>
          ) : null}
          <div className={ui.actions}>
            <button
              className={changed ? ui.button : ui.quiet}
              disabled={Boolean(error)}
              onClick={() => {
                if (changed) save({ retirement: next });
                // Fold the settings away and go back up to the results they change.
                setAssumptionsOpen(false);
                sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              type="button"
            >
              {changed ? 'Save and close' : 'Close'}
            </button>
          </div>
        </div>
      </details>

      {error ? (
        <p className={ui.fieldError} role="alert">
          {error}
        </p>
      ) : null}
      {/* Changes left after closing the settings by hand can still be saved here. */}
      {changed && !error && !assumptionsOpen ? (
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
