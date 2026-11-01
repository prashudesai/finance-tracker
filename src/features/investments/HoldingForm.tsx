import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { addMonths, isValidDate } from '../../domain/calendar';
import { growthType } from '../../domain/holdings';
import { NPS_SCHEMES, optionLists } from '../../domain/options';
import type { Holding } from '../../schema/records';
import { useSettings, useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { localDate } from '../../ui/format';
import { MemberField, useDefaultMember } from '../../ui/MemberField';
import { Select } from '../../ui/Select';
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
  notes: z.string().max(500),
});
type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

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
  const today = localDate();
  const fixedType = kind === 'investment' ? '' : kind.toUpperCase();
  const { register, handleSubmit, watch, setError, formState } = useForm<
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
    },
  });
  const { errors } = formState;
  const type = watch('type');
  const auto = watch('autoContribute');
  const showsRate =
    kind === 'pf' ||
    kind === 'ppf' ||
    (kind === 'investment' && growthType(type, settings) === 'fixed');

  const save = ({ autoStart, uan, scheme, name, notes, ...values }: FormValues) => {
    const account = kind === 'pf' ? uan : name;
    if (kind === 'investment' && !name) {
      setError('name', { message: 'This field is required.' });
      return;
    }
    const id = initial?.id ?? crypto.randomUUID();
    const value = {
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
    };
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

  return (
    <form className={ui.form} onSubmit={(event) => void handleSubmit(save)(event)}>
      <MemberField error={errors.member?.message} {...register('member')} />
      {kind === 'investment' ? (
        <>
          <Field label="Investment Type" error={errors.type?.message}>
            <Select
              addTo="investmentTypes"
              options={options.investmentTypes}
              {...register('type')}
            />
          </Field>
          <Field label="Investment Name" error={errors.name?.message}>
            <input {...register('name')} />
          </Field>
        </>
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
      {kind === 'nps' ? (
        <Field label="Scheme Type">
          <Select options={NPS_SCHEMES} placeholder="-- Select scheme --" {...register('scheme')} />
        </Field>
      ) : null}
      {showsRate ? number('Interest Rate (% p.a.)', 'rate', errors.rate?.message) : null}
      {kind === 'pf'
        ? null
        : number('Monthly Contribution (₹)', 'monthly', errors.monthly?.message)}
      <label className={ui.check}>
        <input type="checkbox" {...register('autoContribute')} /> Add contributions automatically
      </label>
      {auto ? (
        <Field label="First Monthly Contribution Date">
          <input type="date" {...register('autoStart')} />
        </Field>
      ) : null}
      {kind === 'investment' ? (
        <Field label="Notes">
          <input {...register('notes')} />
        </Field>
      ) : null}
      <div className={ui.formActions}>
        <button className={ui.button} type="submit">
          Save {SAVE_LABELS[kind]}
        </button>
      </div>
    </form>
  );
}
