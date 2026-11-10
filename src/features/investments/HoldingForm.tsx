import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { addMonths, isValidDate } from '../../domain/calendar';
import { growthType, suggestedPayout } from '../../domain/holdings';
import { NPS_SCHEMES, optionLists } from '../../domain/options';
import { PAYOUT_EVERY, type Holding } from '../../schema/records';
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

export function HoldingForm({
  kind,
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
  const showsRate =
    kind === 'pf' ||
    kind === 'ppf' ||
    (kind === 'investment' && growthType(type, settings) === 'fixed');

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
      setError('payoutAmount', { message: 'Enter the interest paid each time.' });
      return;
    }
    if (paidOut && !isValidDate(payoutStart)) {
      setError('payoutStart', { message: 'Enter a valid date.' });
      return;
    }
    const id = initial?.id ?? crypto.randomUUID();
    const value: Partial<Holding> = {
      ...initial,
      ...values,
      id,
      kind,
      // Retirement accounts are known by their number, or by their kind without one.
      name: account || initial?.name || `${fixedType} Account`,
      // PF records one balance, so it starts as both invested and current.
      openingInvested: values.openingInvested ?? initial?.openingInvested ?? values.openingValue,
      monthly: values.monthly ?? 0,
      ...(values.autoContribute ? { autoStart } : {}),
      ...(kind === 'pf' && uan ? { uan } : {}),
      ...(kind === 'nps' && scheme ? { scheme } : {}),
      ...(notes ? { notes } : {}),
      ...(paidOut
        ? {
            payout: {
              every,
              start: payoutStart,
              ...(perPayout ? { amount: perPayout } : {}),
            },
          }
        : {}),
    };
    if (!paidOut) delete value.payout;
    // `initial` must not bring back what was just cleared. A leftover start date kept a PF
    // account's pension share posting each month after its schedule was turned off.
    if (!values.autoContribute) delete value.autoStart;
    if (!notes) delete value.notes;
    if (!uan) delete value.uan;
    if (!scheme) delete value.scheme;
    commit([{ type: 'set', collection: 'holdings', id, value }]);
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
      {kind === 'investment' ? (
        <section className={styles.step}>
          <Choices
            error={errors.type?.message}
            extra={
              canEdit ? { label: '+ New type', onClick: () => setAddingType(true) } : undefined
            }
            label="What kind of investment?"
            large
            onChange={(value) => choose('type', value)}
            options={options.investmentTypes.map((option) => ({
              value: option,
              label: option,
              hint: growthHint[growthType(option, settings)],
              icon: iconFor(option),
            }))}
            value={type}
          />
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
                  <Field error={errors.payoutAmount?.message} label="Interest each time (₹)">
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
