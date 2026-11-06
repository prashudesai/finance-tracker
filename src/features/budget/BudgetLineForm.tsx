import { useState } from 'react';
import { lineYearly } from '../../domain/budget';
import { roundMoney } from '../../domain/calendar';
import { BUDGET_GROUPS, budgetLineSchema, type BudgetLine } from '../../schema/records';
import { Field } from '../../ui/Field';
import { formatMoney } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import { FY_MONTHS, GROUP_LABELS, MONTH_NAMES } from './budgetText';
import styles from './Budget.module.css';

type Often = 'month' | 'year' | 'months' | 'once';

const OFTEN: { key: Often; label: string }[] = [
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Yearly' },
  { key: 'months', label: 'Some months' },
  { key: 'once', label: 'Once' },
];

const oftenOf = (line: BudgetLine | undefined): Often =>
  !line || line.every === 'month'
    ? 'month'
    : line.every === 'once'
      ? 'once'
      : line.months.length === 1
        ? 'year'
        : 'months';

/** Adds or edits one line of the plan. Monthly amounts can be entered for the month or the year. */
export function BudgetLineForm({
  line,
  categories,
  onSave,
  onRemove,
  onCancel,
}: {
  line?: BudgetLine;
  categories: string[];
  onSave: (line: BudgetLine) => void;
  onRemove?: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(line?.name ?? '');
  const [group, setGroup] = useState<BudgetLine['group']>(line?.group ?? 'other');
  const [often, setOften] = useState<Often>(oftenOf(line));
  const [perYear, setPerYear] = useState(false);
  const [amount, setAmount] = useState(line && line.amount > 0 ? String(line.amount) : '');
  const [months, setMonths] = useState<number[]>(line?.months.length ? line.months : [4]);
  const [category, setCategory] = useState(line?.category ?? '');

  const entered = Number(amount || 0);
  const stored = often === 'month' && perYear ? roundMoney(entered / 12) : roundMoney(entered);
  const chosen = often === 'months' ? months : months.slice(0, 1);
  const draft: BudgetLine = {
    id: line?.id ?? crypto.randomUUID(),
    name: name.trim(),
    group,
    amount: stored,
    every: often === 'month' ? 'month' : often === 'once' ? 'once' : 'months',
    months:
      often === 'month'
        ? []
        : [...chosen].sort((a, b) => FY_MONTHS.indexOf(a) - FY_MONTHS.indexOf(b)),
    category,
  };
  const nameError = draft.name ? null : 'Give it a name.';
  const amountError =
    amount.trim() !== '' && !(entered >= 0 && Number.isFinite(entered))
      ? 'Enter an amount in rupees.'
      : null;
  const monthsError = often === 'months' && months.length === 0 ? 'Pick at least one month.' : null;
  const parsed = budgetLineSchema.safeParse(draft);
  const error =
    nameError ??
    amountError ??
    monthsError ??
    (parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Check the details.'));
  const [tried, setTried] = useState(false);

  const toggleMonth = (month: number) =>
    setMonths((now) => (now.includes(month) ? now.filter((m) => m !== month) : [...now, month]));

  return (
    <form
      className={ui.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (error || !parsed.success) return;
        onSave(parsed.data);
      }}
    >
      <Field error={tried ? (nameError ?? undefined) : undefined} label="Name">
        <input
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          placeholder="For example, Swimming classes"
          value={name}
        />
      </Field>
      <Field label="Group">
        <select
          onChange={(event) => setGroup(event.target.value as BudgetLine['group'])}
          value={group}
        >
          {BUDGET_GROUPS.map((key) => (
            <option key={key} value={key}>
              {GROUP_LABELS[key]}
            </option>
          ))}
        </select>
      </Field>
      <div className={ui.formWide}>
        <span className={ui.label}>How often</span>
        <div aria-label="How often" className={ui.segmented} role="radiogroup">
          {OFTEN.map(({ key, label }) => (
            <button
              aria-checked={often === key}
              className={often === key ? ui.segmentActive : ui.segment}
              key={key}
              onClick={() => setOften(key)}
              role="radio"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {often === 'month' ? (
        <div className={ui.formWide}>
          <span className={ui.label}>Enter the amount</span>
          <div aria-label="Enter the amount" className={ui.segmented} role="radiogroup">
            {[false, true].map((yearly) => (
              <button
                aria-checked={perYear === yearly}
                className={perYear === yearly ? ui.segmentActive : ui.segment}
                key={String(yearly)}
                onClick={() => {
                  if (yearly !== perYear && entered > 0) {
                    setAmount(String(yearly ? roundMoney(entered * 12) : roundMoney(entered / 12)));
                  }
                  setPerYear(yearly);
                }}
                role="radio"
                type="button"
              >
                {yearly ? 'For the year' : 'For a month'}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <Field
        error={tried ? (amountError ?? undefined) : undefined}
        label={
          often === 'month'
            ? perYear
              ? 'Amount for the year'
              : 'Amount a month'
            : often === 'months'
              ? 'Each payment'
              : 'Amount'
        }
      >
        <input
          inputMode="decimal"
          min="0"
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0"
          type="number"
          value={amount}
        />
      </Field>
      {often === 'month' ? null : often === 'months' ? (
        <div className={ui.formWide}>
          <span className={ui.label}>Paid in</span>
          <div aria-label="Paid in" className={styles.monthsPicker} role="group">
            {FY_MONTHS.map((month) => (
              <button
                aria-pressed={months.includes(month)}
                className={styles.monthChip}
                key={month}
                onClick={() => toggleMonth(month)}
                type="button"
              >
                {MONTH_NAMES[month - 1]}
              </button>
            ))}
          </div>
          {tried && monthsError ? (
            <span className={ui.fieldError} role="alert">
              {monthsError}
            </span>
          ) : null}
        </div>
      ) : (
        <Field label={often === 'once' ? 'Month' : 'Paid in'}>
          <select
            onChange={(event) => setMonths([Number(event.target.value)])}
            value={months[0] ?? 4}
          >
            {FY_MONTHS.map((month) => (
              <option key={month} value={month}>
                {MONTH_NAMES[month - 1]}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Counts spending in">
        <select onChange={(event) => setCategory(event.target.value)} value={category}>
          <option value="">No category, plan only</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>
      <p className={`${ui.caption} ${ui.formWide}`}>
        {formatMoney(lineYearly(draft))} over the year.
        {category ? ` Spending in ${category} counts against it.` : ''}
      </p>
      {tried && error && !nameError && !amountError && !monthsError ? (
        <p className={`${ui.fieldError} ${ui.formWide}`} role="alert">
          {error}
        </p>
      ) : null}
      <div className={`${ui.actions} ${ui.formWide}`}>
        {onRemove ? (
          <button className={ui.quiet} onClick={onRemove} type="button">
            Remove
          </button>
        ) : null}
        <button className={ui.quiet} onClick={onCancel} type="button">
          Cancel
        </button>
        <button className={ui.button} type="submit">
          Save
        </button>
      </div>
    </form>
  );
}
