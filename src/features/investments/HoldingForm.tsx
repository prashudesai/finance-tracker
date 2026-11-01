import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { addMonths, isValidDate } from '../../domain/calendar';
import { growthType } from '../../domain/holdings';
import { optionLists } from '../../domain/options';
import type { Holding } from '../../schema/records';
import { useSettings, useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { localDate } from '../../ui/format';
import { Select } from '../../ui/Select';
import ui from '../../ui/ui.module.css';

const LABELS: Record<Holding['kind'], string> = {
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
  name: z.string().trim().min(1, 'This field is required.').max(100),
  member: z.string().trim().min(1, 'This field is required.').max(100),
  date: z.string().refine(isValidDate, 'Enter a valid date.'),
  openingInvested: amount,
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
});
type FormInput = z.input<typeof formSchema>;
type FormValues = z.output<typeof formSchema>;

const nextMonthStart = (today: string) => `${addMonths(today, 1).slice(0, 7)}-01`;

export function HoldingForm({
  kind,
  initial,
  onDone,
}: {
  kind: Holding['kind'];
  initial?: Holding;
  onDone: () => void;
}) {
  const commit = useTracker((state) => state.commit);
  const settings = useSettings();
  const options = optionLists(settings);
  const today = localDate();
  const fixedLabel = kind === 'investment' ? '' : kind.toUpperCase();
  const { register, handleSubmit, watch, formState } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: initial?.type ?? (fixedLabel || 'Mutual Funds'),
      name: initial?.name ?? '',
      member: initial?.member ?? '',
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
    },
  });
  const { errors } = formState;
  const type = watch('type');
  const auto = watch('autoContribute');
  const showsRate =
    kind === 'pf' ||
    kind === 'ppf' ||
    (kind === 'investment' && growthType(type, settings) === 'fixed');

  const save = ({ autoStart, uan, scheme, ...values }: FormValues) => {
    const id = initial?.id ?? crypto.randomUUID();
    const value = {
      ...values,
      id,
      kind,
      monthly: values.monthly ?? 0,
      ...(values.autoContribute ? { autoStart } : {}),
      ...(kind === 'pf' && uan ? { uan } : {}),
      ...(kind === 'nps' && scheme ? { scheme } : {}),
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
      {kind === 'investment' ? (
        <Field label="Type" error={errors.type?.message}>
          <Select options={options.investmentTypes} {...register('type')} />
        </Field>
      ) : null}
      <Field label={`${LABELS[kind]} name`} error={errors.name?.message}>
        <input {...register('name')} />
      </Field>
      <Field label="Family member" error={errors.member?.message}>
        {options.familyMembers.length > 0 ? (
          <Select
            options={options.familyMembers}
            placeholder="-- Select family member --"
            {...register('member')}
          />
        ) : (
          <input {...register('member')} />
        )}
      </Field>
      {kind === 'pf' ? (
        <Field label="UAN (optional)">
          <input {...register('uan')} />
        </Field>
      ) : null}
      {kind === 'nps' ? (
        <Field label="Scheme (optional)">
          <input placeholder="e.g., Active Choice" {...register('scheme')} />
        </Field>
      ) : null}
      <Field label="Start date" error={errors.date?.message}>
        <input type="date" {...register('date')} />
      </Field>
      {number('Invested so far (₹)', 'openingInvested', errors.openingInvested?.message)}
      {number('Current value (₹)', 'openingValue', errors.openingValue?.message)}
      {showsRate ? number('Interest rate (% a year)', 'rate', errors.rate?.message) : null}
      {kind === 'pf' ? (
        <>
          {number('Employee monthly (₹)', 'employee', errors.employee?.message)}
          {number('Employer monthly (₹)', 'employer', errors.employer?.message)}
          {number('EPS monthly (₹)', 'epsMonthly', errors.epsMonthly?.message)}
          {number('EPS balance (₹)', 'epsOpening', errors.epsOpening?.message)}
        </>
      ) : (
        number('Monthly contribution (₹)', 'monthly', errors.monthly?.message)
      )}
      <label className={ui.check}>
        <input type="checkbox" {...register('autoContribute')} /> Add contributions automatically
      </label>
      {auto ? (
        <Field label="First contribution date">
          <input type="date" {...register('autoStart')} />
        </Field>
      ) : null}
      <div className={ui.formActions}>
        <button className={ui.button} type="submit">
          Save {LABELS[kind]}
        </button>
      </div>
    </form>
  );
}
