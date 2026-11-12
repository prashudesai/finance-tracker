import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { addMonths, isValidDate } from '../../domain/calendar';
import {
  growthType,
  hasBuiltInGrowth,
  suggestedPayout,
  type GrowthType,
} from '../../domain/holdings';
import { NPS_SCHEMES, optionLists } from '../../domain/options';
import { PAYOUT_EVERY, TRACKER_SETTINGS_ID, type Holding } from '../../schema/records';
import { useSettings, useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { localDate } from '../../ui/format';
import { useState } from 'react';
import { Choices } from '../../ui/Choices';
import { useDefaultMember } from '../../ui/MemberField';
import { AddValueDialog } from '../../ui/Select';
import { iconFor } from '../wealth/HoldingList';
import styles from './HoldingForm.module.css';
import ui from '../../ui/ui.module.css';

const SAVE_LABELS: Record<Holding['kind'], string> = {
  investment: 'investment',
  pf: 'PF account',
  ppf: 'PPF account',
  nps: 'NPS account',
};

const amount = z.number({ error: 'Enter a number.' }).nonnegative('Enter zero or more.');
const optionalAmount = z.preprocess(
  (value) => (value === '' || Number.isNaN(value) ? undefined : value),
  amount.optional(),
);

const formSchema = z.object({
  type: z.string().trim().min(1, 'This field is required.'),
  name: z.string().trim().max(100),
  member: z.string().trim().min(1, 'This field is required.').max(100),
  date: z.string().refine(isValidDate, 'Enter a valid date.'),
  openingInvested: optionalAmount,
  openingValue: amount,
  rate: optionalAmount,
  monthly: optionalAmount,
  employee: optionalAmount,
  employer: optionalAmount,
  epsMonthly: optionalAmount,
  epsOpening: optionalAmount,
  autoContribute: z.boolean(),
  autoStart: z.string(),
  uan: z.string().max(40),
  scheme: z.string().max(60),
  notes: z.string().max(500, 'Use 500 characters or fewer.'),
  payoutEvery: z.enum(['none', ...PAYOUT_EVERY]),
  payoutAmount: optionalAmount,
  payoutVaries: z.boolean(),
  payoutStart: z.string(),
  payoutRise: z.preprocess(
    (value) => (value === '' || Number.isNaN(value) ? undefined : value),
    z
      .number({ error: 'Enter a number.' })
      .gt(0, 'Enter more than zero, or leave it blank.')
      .max(50, 'Enter 50 or less.')
      .optional(),
  ),
  maturity: z.string().refine((value) => value === '' || isValidDate(value), 'Enter a valid date.'),
});
type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

const PAYOUT_LABELS = {
  none: 'No, it stays invested',
  month: 'Monthly',
  quarter: 'Quarterly',
  'half-year': 'Half-yearly',
  year: 'Yearly',
} as const;

const nextMonthStart = (today: string) => `${addMonths(today, 1).slice(0, 7)}-01`;

const DATE_LABELS: Record<Holding['kind'], string> = {
  investment: 'Purchase Date',
  pf: 'Last Updated',
  ppf: 'Opening Date',
  nps: 'Start Date',
};

const KINDS: [Holding['kind'], string][] = [
  ['investment', 'Investments'],
  ['pf', 'PF'],
  ['ppf', 'PPF'],
  ['nps', 'NPS'],
];

export function HoldingForm({
  kind: startKind,
  initial,
  type: chosenType,
  onDone,
}: {
  kind: Holding['kind'];
  initial?: Holding;
  /** Starts the Investment Type dropdown on this value. */
  type?: string;
  onDone: () => void;
}) {
  const commit = useTracker((state) => state.commit);
  const settings = useSettings();
  const options = optionLists(settings);
  const defaultMember = useDefaultMember();
  const members = settings.familyMembers;
  const canEdit = useTracker((state) => state.canEdit);
  const [addingType, setAddingType] = useState(false);
  // An existing holding can move between kinds, such as one saved under Investments that is
  // really a PPF account; its history comes with it.
  const [kind, setKind] = useState<Holding['kind']>(initial?.kind ?? startKind);
  // A custom type's growth, changeable here; it applies to every holding of that type.
  const [growthChoice, setGrowthChoice] = useState<GrowthType | null>(null);
  const today = localDate();
  const fixedType = kind === 'investment' ? '' : kind.toUpperCase();
  const { register, handleSubmit, watch, setError, setValue, formState } = useForm<
    FormInput,
    unknown,
    FormValues
  >({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: initial?.type ?? (fixedType || chosenType || 'Mutual Funds'),
      name: initial?.name ?? '',
      member: initial?.member ?? (defaultMember || 'Household'),
      date: initial?.date ?? today,
      openingInvested: initial?.openingInvested,
      openingValue: initial?.openingValue,
      rate: initial?.rate,
      monthly: initial?.monthly,
      employee: initial?.employee,
      employer: initial?.employer,
      epsMonthly: initial?.epsMonthly,
      epsOpening: initial?.epsOpening,
      autoContribute: initial?.autoContribute ?? false,
      autoStart: initial?.autoStart ?? nextMonthStart(today),
      uan: initial?.uan ?? '',
      scheme: initial?.scheme ?? '',
      notes: initial?.notes ?? '',
      payoutEvery: initial?.payout?.every ?? 'none',
      payoutAmount: initial?.payout?.amount,
      payoutVaries: Boolean(initial?.payout && initial.payout.amount === undefined),
      payoutStart: initial?.payout?.start ?? nextMonthStart(today),
      payoutRise: initial?.payout?.rise,
      maturity: initial?.maturity ?? '',
    },
  });
  const { errors } = formState;
  const type = watch('type');
  const auto = watch('autoContribute');
  const payoutEvery = watch('payoutEvery');
  // Deposits and bonds pay interest; others a dividend or profit share.
  const paysInterest = kind === 'investment';
  const varies = watch('payoutVaries');
  // Interest is paid on what was put in, the principal.
  const watchedValue = watch('openingInvested') || watch('openingValue');
  const watchedRate = watch('rate');
  const suggestion =
    payoutEvery !== 'none' && Number(watchedRate) > 0 && Number(watchedValue) > 0
      ? suggestedPayout(Number(watchedValue), Number(watchedRate), payoutEvery)
      : null;
  // A custom type's growth can be changed here; built-in types keep theirs.
  const customType = kind === 'investment' && Boolean(type) && !hasBuiltInGrowth(type);
  const growth = (customType ? growthChoice : null) ?? growthType(type, settings);
  const showsRate =
    kind === 'pf' || kind === 'ppf' || (kind === 'investment' && growth === 'fixed');

  const save = ({
    autoStart,
    uan,
    scheme,
    name,
    notes,
    payoutEvery: every,
    payoutAmount,
    payoutVaries,
    payoutStart,
    payoutRise,
    maturity,
    ...values
  }: FormValues) => {
    const account = kind === 'pf' ? uan : name;
    if (kind === 'investment' && !name) {
      setError('name', { message: 'This field is required.' });
      return;
    }
    const paidOut = paysInterest && every !== 'none';
    const perPayout = payoutVaries ? null : (payoutAmount ?? (paidOut ? suggestion : null));
    if (paidOut && !payoutVaries && !(perPayout && perPayout > 0)) {
      setError('payoutAmount', { message: 'Enter the amount paid each time.' });
      return;
    }
    if (paidOut && !isValidDate(payoutStart)) {
      setError('payoutStart', { message: 'Enter a valid date.' });
      return;
    }
    if (maturity && maturity <= values.date) {
      setError('maturity', { message: 'Pick a date after it started.' });
      return;
    }
    const id = initial?.id ?? crypto.randomUUID();
    const value: Partial<Holding> = {
      ...initial,
      ...values,
      id,
      kind,
      // PF, PPF and NPS are their own type; an investment keeps the one chosen.
      type: kind === 'investment' ? values.type : fixedType,
      // Retirement accounts are known by their number, or by their kind without one.
      name: account || initial?.name || `${fixedType} Account`,
      // PF records one balance, so it starts as both invested and current.
      openingInvested: values.openingInvested ?? initial?.openingInvested ?? values.openingValue,
      monthly: values.monthly ?? 0,
      ...(values.autoContribute ? { autoStart } : {}),
      ...(kind === 'pf' && uan ? { uan } : {}),
      ...(kind === 'nps' && scheme ? { scheme } : {}),
      ...(notes ? { notes } : {}),
      ...(kind === 'investment' && maturity ? { maturity } : {}),
      ...(paidOut
        ? {
            payout: {
              every,
              start: payoutStart,
              ...(perPayout ? { amount: perPayout } : {}),
              ...(perPayout && payoutRise ? { rise: payoutRise } : {}),
            },
          }
        : {}),
    };
    if (!paidOut) delete value.payout;
    // `initial` must not bring back what was just cleared. A leftover start date kept a PF
    // account's pension share posting each month after its schedule was turned off.
    if (!values.autoContribute) delete value.autoStart;
    if (!notes) delete value.notes;
    if (kind !== 'investment' || !maturity) delete value.maturity;
    if (!uan || kind !== 'pf') delete value.uan;
    if (!scheme || kind !== 'nps') delete value.scheme;
    // A holding moved away from PF leaves its employee, employer and pension shares behind.
    if (kind !== 'pf') {
      delete value.employee;
      delete value.employer;
      delete value.epsMonthly;
      delete value.epsOpening;
    }
    // A changed growth is saved for the type, in the same change as the holding.
    const growthChanged =
      customType && growthChoice !== null && growthChoice !== growthType(type, settings);
    commit([
      { type: 'set', collection: 'holdings', id, value },
      ...(growthChanged
        ? [
            {
              type: 'set' as const,
              collection: 'settings' as const,
              id: TRACKER_SETTINGS_ID,
              value: {
                ...settings,
                id: TRACKER_SETTINGS_ID,
                growthTypes: { ...settings.growthTypes, [type]: growthChoice },
              },
            },
          ]
        : []),
    ]);
    onDone();
  };

  const number = (label: string, field: keyof FormInput, error?: string) => (
    <Field error={error} label={label}>
      <input
        inputMode="decimal"
        step="0.01"
        type="number"
        {...register(field, { valueAsNumber: true })}
      />
    </Field>
  );
  const choose = (field: 'type' | 'member' | 'payoutEvery' | 'scheme', value: string) =>
    setValue(field, value as never, { shouldDirty: true, shouldValidate: formState.isSubmitted });
  const member = watch('member');
  const scheme = watch('scheme');
  const growthHint = { market: 'Market-linked', fixed: 'Fixed return', 'no-return': 'No return' };

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(save)(event)}>
      {initial ? (
        <section className={styles.step}>
          <Choices
            label="Where does it belong?"
            onChange={(next) => {
              setKind(next);
              // Back to an investment, it starts on its old type, or the first one listed.
              const back =
                initial.kind === 'investment' ? initial.type : (options.investmentTypes[0] ?? '');
              setValue('type', next === 'investment' ? back : next.toUpperCase(), {
                shouldDirty: true,
              });
            }}
            options={KINDS.map(([value, label]) => ({ value, label }))}
            value={kind}
          />
          {kind !== initial.kind ? (
            <p className={ui.caption}>
              Its contributions, values and withdrawals move with it.
              {initial.payout && kind !== 'investment'
                ? ' Its payout schedule stops, as only investments pay out.'
                : ''}
            </p>
          ) : null}
        </section>
      ) : null}
      {kind === 'investment' ? (
        <section className={styles.step}>
          <Choices
            error={errors.type?.message}
            extra={
              canEdit ? { label: '+ New type', onClick: () => setAddingType(true) } : undefined
            }
            label="What kind of investment?"
            large
            onChange={(value) => {
              choose('type', value);
              setGrowthChoice(null);
            }}
            options={options.investmentTypes.map((option) => ({
              value: option,
              label: option,
              hint: growthHint[growthType(option, settings)],
              icon: iconFor(option),
            }))}
            value={type}
          />
          {customType ? (
            <div className={styles.growth}>
              <Choices
                label={`How ${type} grows`}
                onChange={(next) => setGrowthChoice(next)}
                options={(['market', 'fixed', 'no-return'] as const).map((value) => ({
                  value,
                  label: growthHint[value],
                }))}
                value={growth}
              />
              <p className={ui.caption}>
                {growth === 'market'
                  ? 'Its value moves with the market: update it from time to time, and returns show as XIRR.'
                  : growth === 'fixed'
                    ? 'It earns a set rate a year, entered below; returns show as that rate.'
                    : 'It holds its value, like cash; returns show as plain gain.'}{' '}
                Applies to every {type} investment.
              </p>
            </div>
          ) : null}
          <Field label="Investment Name" error={errors.name?.message}>
            <input placeholder="For example, HDFC FD 2027" {...register('name')} />
          </Field>
        </section>
      ) : null}
      {kind === 'pf' ? (
        <Field label="Account Number (UAN)">
          <input {...register('uan')} />
        </Field>
      ) : null}
      {kind === 'ppf' || kind === 'nps' ? (
        <Field label="Account Number">
          <input {...register('name')} />
        </Field>
      ) : null}
      {members.length > 1 ? (
        <Choices
          error={errors.member?.message}
          label="Whose is it?"
          onChange={(value) => choose('member', value)}
          options={[...members, ...(members.includes('Household') ? [] : ['Household'])].map(
            (name) => ({ value: name, label: name }),
          )}
          value={member}
        />
      ) : null}

      <section className={styles.step}>
        <h3 className={styles.stepTitle}>Amounts</h3>
        <div className={styles.pair}>
          {kind === 'pf' ? (
            <>
              {number('Employee Contribution (₹)', 'employee', errors.employee?.message)}
              {number('Employer Contribution — total (₹)', 'employer', errors.employer?.message)}
              {number(
                'Employer portion to EPS per month (₹)',
                'epsMonthly',
                errors.epsMonthly?.message,
              )}
              {number('Current EPS balance (₹)', 'epsOpening', errors.epsOpening?.message)}
              {number('Current PF Balance (₹)', 'openingValue', errors.openingValue?.message)}
            </>
          ) : null}
          {kind === 'ppf' ? (
            <>
              {number('Total Invested (₹)', 'openingInvested', errors.openingInvested?.message)}
              {number('Current Balance (₹)', 'openingValue', errors.openingValue?.message)}
            </>
          ) : null}
          {kind === 'investment' || kind === 'nps' ? (
            <>
              {number('Invested Amount (₹)', 'openingInvested', errors.openingInvested?.message)}
              {number('Current Value (₹)', 'openingValue', errors.openingValue?.message)}
            </>
          ) : null}
          <Field label={DATE_LABELS[kind]} error={errors.date?.message}>
            <input type="date" {...register('date')} />
          </Field>
          {showsRate ? number('Interest Rate (% p.a.)', 'rate', errors.rate?.message) : null}
        </div>
      </section>

      {kind === 'nps' ? (
        <Choices
          label="Scheme Type"
          onChange={(value) => choose('scheme', value)}
          options={NPS_SCHEMES.map((option) => ({ value: option, label: option }))}
          value={scheme}
        />
      ) : null}

      <section className={styles.step}>
        <h3 className={styles.stepTitle}>{kind === 'pf' ? 'Monthly PF' : 'Regular investing'}</h3>
        <div className={styles.pair}>
          {kind === 'pf'
            ? null
            : number('Monthly Contribution (₹)', 'monthly', errors.monthly?.message)}
          {auto ? (
            <Field label="Contribution starts on">
              <input type="date" {...register('autoStart')} />
            </Field>
          ) : null}
        </div>
        <label className={styles.toggle}>
          <input type="checkbox" {...register('autoContribute')} />
          <span>
            Add contributions automatically
            <small>
              {auto ? 'Repeats on this day every month.' : 'Each month, on the same day.'}
            </small>
          </span>
        </label>
      </section>

      {paysInterest ? (
        <section className={styles.step}>
          <Choices
            label="Pays out to your bank? Interest, dividends or a profit share"
            onChange={(value) => choose('payoutEvery', value)}
            options={(['none', ...PAYOUT_EVERY] as const).map((key) => ({
              value: key,
              label: PAYOUT_LABELS[key],
            }))}
            value={payoutEvery}
          />
          {payoutEvery !== 'none' ? (
            <>
              <Choices
                label="How much each time?"
                onChange={(value) =>
                  setValue('payoutVaries', value === 'varies', { shouldDirty: true })
                }
                options={[
                  { value: 'fixed', label: 'Same amount', hint: 'Interest, coupons' },
                  { value: 'varies', label: 'Varies', hint: 'Profit share, dividends' },
                ]}
                value={varies ? 'varies' : 'fixed'}
              />
              <div className={styles.pair}>
                {varies ? null : (
                  <Field error={errors.payoutAmount?.message} label="Amount each time (₹)">
                    <input
                      inputMode="decimal"
                      placeholder={suggestion ? String(suggestion) : ''}
                      step="0.01"
                      type="number"
                      {...register('payoutAmount', { valueAsNumber: true })}
                    />
                  </Field>
                )}
                <Field error={errors.payoutStart?.message} label="First payout on">
                  <input type="date" {...register('payoutStart')} />
                </Field>
                {varies ? null : (
                  <Field error={errors.payoutRise?.message} label="Rises each year (%)">
                    <input
                      inputMode="decimal"
                      placeholder="Optional, such as 5"
                      step="0.1"
                      type="number"
                      {...register('payoutRise', { valueAsNumber: true })}
                    />
                  </Field>
                )}
              </div>
              <p className={ui.caption}>
                {!varies && suggestion
                  ? `Left blank, it's ₹${suggestion.toLocaleString('en-IN')} from the rate and amount invested. `
                  : ''}
                {varies
                  ? 'Each payout shows on Home to enter what you got, and is added to your income.'
                  : 'Each payout shows on Home to confirm, and is added to your income.'}
              </p>
            </>
          ) : null}
        </section>
      ) : null}

      {kind === 'investment' ? (
        <Field error={errors.maturity?.message} label="Matures on (optional)">
          <input type="date" {...register('maturity')} />
        </Field>
      ) : null}
      {kind === 'investment' && watch('maturity') ? (
        <p className={ui.caption}>
          Payouts stop after it, and Home reminds you a month before to record the principal coming
          back.
        </p>
      ) : null}
      {kind === 'investment' ? (
        <Field label="Notes" error={errors.notes?.message}>
          <input placeholder="Optional" {...register('notes')} />
        </Field>
      ) : null}
      <div className={styles.actions}>
        <button className={ui.button} type="submit">
          Save {SAVE_LABELS[kind]}
        </button>
      </div>
      {addingType ? (
        <AddValueDialog
          existing={options.investmentTypes}
          list="investmentTypes"
          onCancel={() => setAddingType(false)}
          onSaved={(value) => {
            setAddingType(false);
            choose('type', value);
          }}
        />
      ) : null}
    </form>
  );
}
