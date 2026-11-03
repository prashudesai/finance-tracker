import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Repeat, Square } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { addDays, isValidMonth } from '../../domain/calendar';
import { optionLists } from '../../domain/options';
import {
  amountAt,
  applyOccurrences,
  pendingOccurrences,
  stopSchedules,
  upcomingCommitments,
  withAmountChange,
  type OccurrenceRequest,
  type RecurringData,
} from '../../domain/recurring';
import { recordId, type RecordWrite, type TrackerData } from '../../data/repository';
import { EMI_CATEGORY, type RecurringRule } from '../../schema/records';
import { useSettings, useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { MemberField, useDefaultMember } from '../../ui/MemberField';
import { formatDay, formatMoney, localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { Select } from '../../ui/Select';
import ui from '../../ui/ui.module.css';

const COMMITMENT_DAYS = 30;

const toRecurring = (data: TrackerData): RecurringData => ({
  rules: data.recurringRules,
  occurrences: data.recurringOccurrences,
  income: data.income,
  expenses: data.expenses,
  loans: data.loans,
});

/** The records a recurring run added, as writes. Loans are derived, so they never change. */
function newRecordWrites(before: TrackerData, after: RecurringData) {
  const known = new Set([...before.income, ...before.expenses].map((row) => row.id));
  const writes: RecordWrite[] = [];
  for (const row of after.income) {
    if (!known.has(row.id)) {
      writes.push({ type: 'set', collection: 'income', id: row.id, value: row });
    }
  }
  for (const row of after.expenses) {
    if (!known.has(row.id)) {
      writes.push({ type: 'set', collection: 'expenses', id: row.id, value: row });
    }
  }
  for (const row of after.occurrences.slice(before.recurringOccurrences.length)) {
    writes.push({
      type: 'set',
      collection: 'recurringOccurrences',
      id: recordId.occurrence(row),
      value: row,
    });
  }
  return writes;
}

const ruleForm = z.object({
  kind: z.enum(['income', 'expense', 'emi']),
  name: z.string().trim().min(1, 'This field is required.').max(100),
  amount: z.number({ error: 'Enter a number.' }).positive('Enter an amount above zero.').optional(),
  label: z.string().max(100),
  member: z.string().max(100),
  loanId: z.string(),
  day: z.number({ error: 'Enter a day.' }).int().min(0).max(31),
  startMonth: z.string().refine(isValidMonth, 'Enter a valid month.'),
});
type RuleValues = z.infer<typeof ruleForm>;

function RuleForm({ initial, onDone }: { initial?: RecurringRule; onDone: () => void }) {
  const commit = useTracker((state) => state.commit);
  const report = useTracker((state) => state.report);
  const loans = useTracker((state) => state.data.loans);
  const settings = useSettings();
  const options = optionLists(settings);
  const defaultMember = useDefaultMember();
  const { register, handleSubmit, watch, formState } = useForm<RuleValues>({
    resolver: zodResolver(ruleForm),
    defaultValues: initial
      ? {
          kind: initial.kind,
          name: initial.name,
          amount: amountAt(initial, localDate().slice(0, 7)),
          label:
            initial.kind === 'income'
              ? initial.source
              : initial.kind === 'expense'
                ? initial.category
                : '',
          member: initial.kind === 'income' ? initial.member : '',
          loanId: initial.kind === 'emi' ? initial.loanId : '',
          day: initial.day,
          startMonth: initial.startMonth,
        }
      : {
          kind: 'expense',
          name: '',
          label: '',
          member: defaultMember,
          loanId: '',
          day: 1,
          startMonth: localDate().slice(0, 7),
        },
  });
  const { errors } = formState;
  const kind = watch('kind');

  const save = (values: RuleValues) => {
    if (initial) {
      const month = localDate().slice(0, 7);
      const changed =
        initial.kind === 'emi'
          ? initial
          : withAmountChange(initial, values.amount ?? initial.amount, month);
      const details =
        initial.kind === 'income'
          ? {
              source: values.label || initial.source,
              member: values.member || initial.member,
            }
          : initial.kind === 'expense'
            ? { category: values.label || initial.category }
            : {};
      const value = { ...changed, ...details, name: values.name, day: values.day };
      commit([{ type: 'set', collection: 'recurringRules', id: initial.id, value }]);
      onDone();
      return;
    }
    const id = crypto.randomUUID();
    const { name, day, startMonth } = values;
    const base = { id, name, day, startMonth, paused: false };
    let value: RecurringRule;
    if (values.kind === 'emi') {
      if (!values.loanId) {
        report('Choose the loan this EMI repays.');
        return;
      }
      value = { ...base, kind: 'emi', loanId: values.loanId };
    } else if (!values.amount) {
      report('Enter the monthly amount.');
      return;
    } else if (values.kind === 'income') {
      value = {
        ...base,
        kind: 'income',
        member: values.member || 'Household',
        source: values.label || 'Salary',
        amount: values.amount,
        amountChanges: [],
      };
    } else {
      value = {
        ...base,
        kind: 'expense',
        category: values.label || 'Other',
        subcategory: '',
        isAnnual: false,
        amount: values.amount,
        amountChanges: [],
      };
    }
    commit([{ type: 'set', collection: 'recurringRules', id, value }]);
    onDone();
  };

  return (
    <form className={ui.form} onSubmit={(event) => void handleSubmit(save)(event)}>
      <Field label="Type">
        <select disabled={initial !== undefined} {...register('kind')}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="emi">Loan EMI</option>
        </select>
      </Field>
      <Field label="Name" error={errors.name?.message}>
        <input {...register('name')} />
      </Field>
      {kind === 'emi' ? (
        <Field label="Loan">
          <select {...register('loanId')}>
            <option value="">-- Select loan --</option>
            {loans.map((loan) => (
              <option key={loan.id} value={loan.id}>
                {loan.type} · {loan.member}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <>
          <Field label={kind === 'income' ? 'Source' : 'Category'}>
            <Select
              addTo={kind === 'income' ? 'incomeSources' : 'expenseCategories'}
              options={
                kind === 'income'
                  ? options.incomeSources
                  : options.expenseCategories.filter((item) => item !== EMI_CATEGORY)
              }
              {...register('label')}
            />
          </Field>
          <Field label="Monthly amount (₹)" error={errors.amount?.message}>
            <input
              inputMode="decimal"
              type="number"
              {...register('amount', {
                setValueAs: (value) => (value === '' ? undefined : Number(value)),
              })}
            />
          </Field>
        </>
      )}
      {kind === 'income' ? <MemberField {...register('member')} /> : null}
      <Field label="Day of month (0 = last day)" error={errors.day?.message}>
        <input type="number" {...register('day', { valueAsNumber: true })} />
      </Field>
      <Field label="Starts" error={errors.startMonth?.message}>
        <input disabled={initial !== undefined} type="month" {...register('startMonth')} />
      </Field>
      <div className={ui.formActions}>
        <button className={ui.button} type="submit">
          Save recurring item
        </button>
      </div>
    </form>
  );
}

export function Commitments({ open = false }: { open?: boolean }) {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const report = useTracker((state) => state.report);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const today = localDate();
  const month = today.slice(0, 7);
  const recurring = toRecurring(data);
  const pending = pendingOccurrences(recurring, today);
  const upcoming = upcomingCommitments(recurring, today, addDays(today, COMMITMENT_DAYS));
  const ruleName = (id: string) => data.recurringRules.find((rule) => rule.id === id)?.name ?? id;
  const active = data.recurringRules.filter((rule) => !rule.paused);

  const run = (request: OccurrenceRequest) => {
    let result: ReturnType<typeof applyOccurrences>;
    try {
      result = applyOccurrences(recurring, [request], today);
    } catch {
      report(
        'This could not be saved, because a recurring entry no longer matches its schedule. If one was moved to another month, move it back and try again.',
      );
      return;
    }
    const writes = newRecordWrites(data, result.data);
    if (writes.length > 0) commit(writes);
    if (result.errors.length > 0) report(result.errors.join(' '));
  };

  const stop = (rule: RecurringRule) => {
    const after = stopSchedules(recurring, (row) => row.id === rule.id, month);
    const kept = after.rules.find((row) => row.id === rule.id);
    commit(
      kept
        ? [{ type: 'set', collection: 'recurringRules', id: rule.id, value: kept }]
        : [{ type: 'delete', collection: 'recurringRules', id: rule.id }],
    );
  };

  return (
    <details className={`${ui.card} ${ui.fold}`} id="commitments" open={open}>
      <summary className={ui.split}>
        <span>Upcoming commitments</span>
        <span className={ui.caption} style={{ color: 'var(--accent)' }}>
          <Repeat size={12} /> Recurring · {pending.length} due
        </span>
      </summary>
      {pending.length === 0 ? (
        <p className={ui.empty}>Nothing is due.</p>
      ) : (
        <ul className={ui.list}>
          {pending.map(({ ruleId, month: dueMonth, date, amount, missed }) => (
            <li className={ui.row} key={`${ruleId}-${dueMonth}`}>
              <div className={ui.rowMain}>
                <div className={ui.rowTitle}>{ruleName(ruleId)}</div>
                <div className={ui.rowDetail}>
                  {missed ? 'Missed' : 'Due'} {formatDay(date)}
                  {amount === undefined ? '' : ` · ${formatMoney(amount)}`}
                </div>
              </div>
              <div className={ui.actions}>
                <button
                  className={ui.button}
                  onClick={() => run({ ruleId, month: dueMonth })}
                  type="button"
                >
                  Post
                </button>
                <button
                  className={ui.quiet}
                  onClick={() => run({ ruleId, month: dueMonth, skip: true })}
                  type="button"
                >
                  Skip
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className={ui.groupLabel}>Next 30 days</div>
      {upcoming.length === 0 ? (
        <p className={ui.empty}>No scheduled payments in the next 30 days.</p>
      ) : (
        <ul className={ui.list}>
          {upcoming.map((row) => (
            <li className={ui.row} key={`${row.ruleId}-${row.date}`}>
              <div className={ui.rowMain}>
                <div className={ui.rowTitle}>{row.name}</div>
                <div className={ui.rowDetail}>
                  {formatDay(row.date)}
                  {row.kind === 'income' ? ' · Income' : ''}
                </div>
              </div>
              <span className={ui.amount}>{formatMoney(row.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <details className={ui.fold}>
        <summary>Manage recurring items</summary>
        {active.length === 0 ? (
          <p className={ui.empty}>No recurring items yet.</p>
        ) : (
          <ul className={ui.list}>
            {active.map((rule) => (
              <li className={ui.row} key={rule.id}>
                <div className={ui.rowMain}>
                  <div className={ui.rowTitle}>{rule.name}</div>
                  <div className={ui.rowDetail}>
                    {rule.kind === 'emi' ? 'Loan EMI' : formatMoney(amountAt(rule, month) ?? 0)} ·
                    monthly
                  </div>
                </div>
                <button
                  aria-label={`Edit ${rule.name}`}
                  className={ui.smallIcon}
                  onClick={() => setEditing(rule)}
                  type="button"
                  data-tip="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  aria-label={`Stop ${rule.name}`}
                  className={ui.smallIcon}
                  onClick={() => stop(rule)}
                  type="button"
                  data-tip="Stop"
                >
                  <Square size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={ui.formActions}>
          <button className={ui.quiet} onClick={() => setAdding(true)} type="button">
            <Plus size={16} /> Add recurring item
          </button>
        </div>
      </details>
      {editing ? (
        <Modal onClose={() => setEditing(null)} title={`Edit ${editing.name}`}>
          <RuleForm initial={editing} onDone={() => setEditing(null)} />
        </Modal>
      ) : null}
      {adding ? (
        <Modal onClose={() => setAdding(false)} title="Add recurring item">
          <RuleForm onDone={() => setAdding(false)} />
        </Modal>
      ) : null}
    </details>
  );
}
