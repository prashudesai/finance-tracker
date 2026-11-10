import { AlertTriangle, CheckCircle2, FileText, Lock, ShieldCheck, Upload } from 'lucide-react';
import { useMemo, useState, type ChangeEvent } from 'react';
import { isAnyHouseExpense } from '../../domain/analytics';
import { ANNUAL_BY_DEFAULT, optionLists } from '../../domain/options';
import {
  alreadyRecorded,
  learnPayees,
  parseCsv,
  payeeOf,
  readStatement,
  suggest,
  type ParsedStatement,
  type SkipReason,
  type StatementLine,
} from '../../domain/statement';
import type { RecordWrite } from '../../data/repository';
import { expenseSchema, incomeSchema, type Expense, type Income } from '../../schema/records';
import { useSettings, useTracker } from '../../store/tracker';
import { formatDay, formatMoney } from '../../ui/format';
import { useDefaultMember } from '../../ui/MemberField';
import ui from '../../ui/ui.module.css';
import styles from './ImportStatement.module.css';
import { PdfPasswordError, pdfRows } from './statementPdf';

/** Files larger than this are rarely a statement, and slow a phone down. */
const MAX_BYTES = 15 * 1024 * 1024;
/** The list shows this many at a time, so a year's statement stays quick. */
const PAGE = 100;

const SKIP_TEXT: Record<SkipReason, string> = {
  cardBill: 'Credit card bill: record the purchases instead, so nothing counts twice',
  refund: "Refund: it lowers spending, so it isn't income",
  ownTransfer: 'Between your own accounts or deposits',
  investment: 'Investment: add it on Wealth as a contribution',
  loan: 'Loan EMI: mark it paid from Debts so the loan stays right',
  cash: 'Cash withdrawal: record what the cash is spent on, or let the month’s review count it',
};

interface Row {
  line: StatementLine;
  include: boolean;
  kind: 'income' | 'expense';
  category: string;
  payee: string;
  skip?: SkipReason;
  /** The record this line seems to be already. */
  recorded?: Income | Expense;
  /** Chosen by hand, so later choices for the same payee leave it alone. */
  edited: boolean;
}

type Filter = 'add' | 'recorded' | 'skipped' | 'all';

type Stage =
  | { kind: 'pick'; error?: string }
  | { kind: 'password'; file: File; wrong: boolean }
  | { kind: 'reading'; name: string }
  | { kind: 'review'; name: string; parsed: ParsedStatement }
  | { kind: 'done'; income: number; expenses: number };

/**
 * Money › Import statement: read a CSV or PDF statement on the device, check it, and choose
 * what to add as income and spending. Nothing is saved until Add is pressed, and the saved
 * records are ordinary ones, each with the statement's narration as its notes.
 */
export function ImportStatement({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState<Stage>({ kind: 'pick' });
  const [password, setPassword] = useState('');

  const open = async (file: File, pass?: string) => {
    if (file.size > MAX_BYTES) {
      setStage({ kind: 'pick', error: 'That file is over 15 MB. Download a shorter period.' });
      return;
    }
    const name = file.name;
    const lower = name.toLowerCase();
    if (/\.(xlsx?|ods|numbers)$/.test(lower)) {
      setStage({
        kind: 'pick',
        error:
          'Spreadsheet files can’t be read yet. Download the statement as CSV, or open it and save as CSV.',
      });
      return;
    }
    setStage({ kind: 'reading', name });
    try {
      const isPdf = lower.endsWith('.pdf') || file.type === 'application/pdf';
      const rows = isPdf
        ? await pdfRows(await file.arrayBuffer(), pass)
        : parseCsv(await file.text());
      const parsed = readStatement(rows);
      if ('error' in parsed) {
        setStage({
          kind: 'pick',
          error: isPdf
            ? `${parsed.error} Scanned PDFs, which are pictures of pages, can’t be read.`
            : parsed.error,
        });
        return;
      }
      if (parsed.lines.length === 0) {
        setStage({ kind: 'pick', error: 'No transactions were found in this statement.' });
        return;
      }
      setPassword('');
      setStage({ kind: 'review', name, parsed });
    } catch (error) {
      if (error instanceof PdfPasswordError) {
        setStage({ kind: 'password', file, wrong: error.wrong });
        return;
      }
      setStage({
        kind: 'pick',
        error: 'This file couldn’t be opened. Check it’s a CSV or PDF statement and try again.',
      });
    }
  };

  if (stage.kind === 'done') {
    return (
      <div className={styles.done}>
        <CheckCircle2 aria-hidden="true" className={styles.doneIcon} size={40} />
        <strong>
          Added {stage.income + stage.expenses} entr
          {stage.income + stage.expenses === 1 ? 'y' : 'ies'}
        </strong>
        <span className={ui.caption}>
          {stage.income} to income and {stage.expenses} to spending. Undo from the message at the
          bottom, or from Settings › Change log.
        </span>
        <button className={ui.button} onClick={onDone} type="button">
          Done
        </button>
      </div>
    );
  }

  if (stage.kind === 'review') {
    return (
      <Review
        name={stage.name}
        onAdded={(counts) => setStage({ kind: 'done', ...counts })}
        onBack={() => setStage({ kind: 'pick' })}
        parsed={stage.parsed}
      />
    );
  }

  if (stage.kind === 'reading') {
    return (
      <div aria-live="polite" className={styles.done}>
        <FileText aria-hidden="true" className={styles.doneIcon} size={36} />
        <strong>Reading {stage.name}…</strong>
      </div>
    );
  }

  if (stage.kind === 'password') {
    return (
      <form
        className={ui.form}
        onSubmit={(event) => {
          event.preventDefault();
          void open(stage.file, password);
        }}
      >
        <div className={styles.lockNote}>
          <Lock aria-hidden="true" size={18} />
          <p>
            {stage.wrong
              ? 'That password didn’t open it. Banks often use part of your name with your date of birth, or your customer ID; the email that came with it says which.'
              : 'This statement is locked with a password. It’s used only to open the file on this device, and isn’t saved.'}
          </p>
        </div>
        <label className={ui.field}>
          <span className={ui.label}>Statement password</span>
          <input
            autoComplete="off"
            // The field shows what's typed only on request; banks' formats are easy to mistype.
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        <div className={ui.formActions}>
          <button className={ui.quiet} onClick={() => setStage({ kind: 'pick' })} type="button">
            Choose another file
          </button>
          <button className={ui.button} disabled={!password} type="submit">
            Open
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={styles.pick}>
      <label className={styles.drop}>
        <Upload aria-hidden="true" size={26} />
        <strong>Choose a statement</strong>
        <span>CSV or PDF, downloaded from net banking</span>
        <input
          accept=".csv,.txt,.pdf,text/csv,application/pdf"
          className={ui.visuallyHidden}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void open(file);
          }}
          type="file"
        />
      </label>
      {stage.error ? (
        <p className={styles.error} role="alert">
          <AlertTriangle aria-hidden="true" size={16} /> {stage.error}
        </p>
      ) : null}
      <div className={styles.lockNote}>
        <ShieldCheck aria-hidden="true" size={18} />
        <p>
          The file is read on this device and isn’t uploaded or kept. Only the entries you choose
          are saved, locked like everything else.
        </p>
      </div>
      <details className={ui.fold}>
        <summary>What gets checked</summary>
        <ul className={styles.checks}>
          <li>
            Every row is read or listed as a problem with its line number, never dropped quietly.
          </li>
          <li>Each amount is checked against the statement’s running balance.</li>
          <li>Anything already recorded, the same amount within three days, is left out.</li>
          <li>
            Card bills, loan EMIs, investments, transfers between your own accounts, cash
            withdrawals and refunds are left out to begin with, as each is recorded elsewhere or
            would count twice. You can still add any of them.
          </li>
          <li>Categories follow what you chose for the same payee before.</li>
        </ul>
      </details>
      <details className={ui.fold}>
        <summary>Where to download a statement</summary>
        <p className={ui.caption}>
          In net banking or your bank’s app, open Accounts › Statement, pick the period, and
          download as CSV, or as PDF if CSV isn’t offered. Some banks call CSV “delimited” or
          “text”. Excel downloads can be opened and saved as CSV.
        </p>
      </details>
    </div>
  );
}

function Review({
  name,
  parsed,
  onBack,
  onAdded,
}: {
  name: string;
  parsed: ParsedStatement;
  onBack: () => void;
  onAdded: (counts: { income: number; expenses: number }) => void;
}) {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const settings = useSettings();
  const options = optionLists(settings);
  const defaultMember = useDefaultMember();
  const [member, setMember] = useState(defaultMember);
  const [personal, setPersonal] = useState(false);
  const [filter, setFilter] = useState<Filter>('add');
  const [shown, setShown] = useState(PAGE);
  const [note, setNote] = useState('');

  const [rows, setRows] = useState<Row[]>(() => {
    const learned = learnPayees({ income: data.income, expenses: data.expenses });
    const expenses = data.expenses.filter((row) => !isAnyHouseExpense(row));
    const recorded = alreadyRecorded(parsed.lines, { income: data.income, expenses });
    const byId = new Map<string, Income | Expense>(
      [...data.income, ...expenses].map((row) => [row.id, row]),
    );
    return parsed.lines.map((line) => {
      const suggestion = suggest(line, {
        incomeSources: options.incomeSources,
        expenseCategories: options.expenseCategories,
        learned,
      });
      const match = recorded.get(line.line);
      return {
        line,
        kind: line.direction === 'in' ? 'income' : 'expense',
        category: suggestion.category,
        include: suggestion.action !== 'skip' && !match,
        payee: payeeOf(line.description),
        ...(suggestion.skip ? { skip: suggestion.skip } : {}),
        ...(match ? { recorded: byId.get(match) } : {}),
        edited: false,
      } satisfies Row;
    });
  });

  const counts = useMemo(
    () => ({
      add: rows.filter((row) => row.include).length,
      recorded: rows.filter((row) => row.recorded).length,
      skipped: rows.filter((row) => !row.include && !row.recorded).length,
      all: rows.length,
    }),
    [rows],
  );
  const chosen = rows.filter((row) => row.include);
  const totalIn = chosen
    .filter((row) => row.kind === 'income')
    .reduce((sum, row) => sum + row.line.amount, 0);
  const totalOut = chosen
    .filter((row) => row.kind === 'expense')
    .reduce((sum, row) => sum + row.line.amount, 0);
  const visible = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) =>
      filter === 'add'
        ? row.include
        : filter === 'recorded'
          ? row.recorded
          : filter === 'skipped'
            ? !row.include && !row.recorded
            : true,
    );

  const update = (index: number, change: Partial<Row>) =>
    setRows((list) => list.map((row, at) => (at === index ? { ...row, ...change } : row)));

  // A category chosen for one payee goes to the rest from that payee that weren't set by hand.
  const choose = (index: number, category: string) => {
    const target = rows[index];
    if (!target) return;
    let others = 0;
    setRows((list) =>
      list.map((row, at) => {
        if (at === index) return { ...row, category, edited: true };
        if (target.payee && row.payee === target.payee && row.kind === target.kind && !row.edited) {
          others += 1;
          return { ...row, category };
        }
        return row;
      }),
    );
    setNote(others > 0 ? `${category} set for ${others} more from ${target.payee}.` : '');
  };

  const add = () => {
    const owner = member || defaultMember || 'Household';
    const writes: RecordWrite[] = [];
    let failed = 0;
    for (const row of chosen) {
      const notes = row.line.description.slice(0, 500);
      const id = crypto.randomUUID();
      if (row.kind === 'income') {
        const parsedRow = incomeSchema.safeParse({
          id,
          date: row.line.date,
          member: owner,
          source: row.category,
          amount: row.line.amount,
          notes,
        });
        if (parsedRow.success)
          writes.push({ type: 'set', collection: 'income', id, value: parsedRow.data });
        else failed += 1;
      } else {
        const parsedRow = expenseSchema.safeParse({
          id,
          date: row.line.date,
          category: row.category,
          subcategory: '',
          amount: row.line.amount,
          isAnnual: ANNUAL_BY_DEFAULT.includes(row.category),
          notes,
          ...(personal && owner !== 'Household' ? { member: owner } : {}),
        });
        if (parsedRow.success)
          writes.push({ type: 'set', collection: 'expenses', id, value: parsedRow.data });
        else failed += 1;
      }
    }
    if (failed > 0) {
      setNote(
        `${failed} entr${failed === 1 ? 'y' : 'ies'} couldn’t be saved as they are. Nothing was added.`,
      );
      return;
    }
    commit(writes);
    onAdded({
      income: writes.filter((write) => write.collection === 'income').length,
      expenses: writes.filter((write) => write.collection === 'expenses').length,
    });
  };

  const balance = parsed.balance;
  return (
    <div className={styles.review}>
      <section aria-label="Statement" className={styles.summary}>
        <div className={styles.summaryHead}>
          <FileText aria-hidden="true" size={18} />
          <div>
            <strong>{name}</strong>
            <span className={ui.caption}>
              {parsed.from && parsed.to
                ? `${formatDay(parsed.from)} ${parsed.from.slice(0, 4)} to ${formatDay(parsed.to)} ${parsed.to.slice(0, 4)}`
                : ''}{' '}
              · {parsed.lines.length} transactions
            </span>
          </div>
          <button className={ui.textButton} onClick={onBack} type="button">
            Change file
          </button>
        </div>
        <ul className={styles.checklist}>
          <li
            data-tone={
              balance === null ? 'neutral' : balance.mismatches.length === 0 ? 'good' : 'watch'
            }
          >
            {balance === null
              ? 'This statement has no running balance to check amounts against.'
              : balance.mismatches.length === 0
                ? `Every amount agrees with the statement’s running balance.`
                : `${balance.mismatches.length} line${balance.mismatches.length === 1 ? '' : 's'} (${balance.mismatches.slice(0, 5).join(', ')}${balance.mismatches.length > 5 ? '…' : ''}) don’t follow from the balance before. A row may be missing or misread: compare with the statement before adding.`}
          </li>
          <li data-tone={parsed.problems.length === 0 ? 'good' : 'watch'}>
            {parsed.problems.length === 0 ? (
              'Every row was read.'
            ) : (
              <details>
                <summary>
                  {parsed.problems.length} row{parsed.problems.length === 1 ? '' : 's'} couldn’t be
                  read
                </summary>
                <ul className={styles.problems}>
                  {parsed.problems.slice(0, 50).map((problem) => (
                    <li key={problem.line}>
                      <strong>Line {problem.line}:</strong> {problem.reason}
                      <span>{problem.text}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
          {counts.recorded > 0 ? (
            <li data-tone="neutral">
              {counts.recorded} already recorded, left out so they don’t count twice.
            </li>
          ) : null}
        </ul>
      </section>

      {settings.familyMembers.length > 1 ? (
        <div className={styles.owner}>
          <label className={ui.field}>
            <span className={ui.label}>Whose account is this?</span>
            <select
              className={ui.fieldSelect}
              onChange={(event) => setMember(event.target.value)}
              value={member}
            >
              <option value="">Household</option>
              {settings.familyMembers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {member ? (
            <label className={ui.check}>
              <input
                checked={personal}
                onChange={(event) => setPersonal(event.target.checked)}
                type="checkbox"
              />
              Count the spending as {member}’s, not the household’s
            </label>
          ) : null}
        </div>
      ) : null}

      <div aria-label="Show" className={ui.segmented} role="tablist">
        {(
          [
            ['add', `To add · ${counts.add}`],
            ['skipped', `Left out · ${counts.skipped}`],
            ...(counts.recorded > 0
              ? [['recorded', `Recorded · ${counts.recorded}`] as const]
              : []),
            ['all', `All · ${counts.all}`],
          ] as const
        ).map(([key, label]) => (
          <button
            aria-selected={filter === key}
            className={filter === key ? ui.segmentActive : ui.segment}
            key={key}
            onClick={() => {
              setFilter(key);
              setShown(PAGE);
            }}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {note ? (
        <p aria-live="polite" className={styles.note}>
          {note}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className={ui.empty}>Nothing here.</p>
      ) : (
        <ul className={styles.rows}>
          {visible.slice(0, shown).map(({ row, index }) => {
            const list = row.kind === 'income' ? options.incomeSources : options.expenseCategories;
            const choices = list.includes(row.category) ? list : [...list, row.category];
            return (
              <li className={styles.row} data-included={row.include} key={row.line.line}>
                <input
                  aria-label={`Add ${row.line.description}, ${formatMoney(row.line.amount)}`}
                  checked={row.include}
                  className={styles.tick}
                  onChange={(event) => update(index, { include: event.target.checked })}
                  type="checkbox"
                />
                <div className={styles.rowMain}>
                  <span className={styles.desc} title={row.line.description}>
                    {row.line.description}
                  </span>
                  <span className={styles.meta}>
                    {formatDay(row.line.date)} · line {row.line.line}
                    {row.payee ? ` · ${row.payee}` : ''}
                  </span>
                  {row.recorded ? (
                    <span className={styles.reason}>
                      Already recorded:{' '}
                      {'source' in row.recorded ? row.recorded.source : row.recorded.category} on{' '}
                      {formatDay(row.recorded.date)}
                    </span>
                  ) : row.skip && !row.include ? (
                    <span className={styles.reason}>{SKIP_TEXT[row.skip]}</span>
                  ) : null}
                  <select
                    aria-label={row.kind === 'income' ? 'Income source' : 'Expense category'}
                    className={`${ui.fieldSelect} ${styles.category}`}
                    onChange={(event) => choose(index, event.target.value)}
                    value={row.category}
                  >
                    {choices.map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}
                      </option>
                    ))}
                  </select>
                </div>
                <strong
                  className={row.kind === 'income' ? `${styles.amount} ${ui.gain}` : styles.amount}
                >
                  {row.kind === 'income' ? '+' : '−'}
                  {formatMoney(row.line.amount)}
                </strong>
              </li>
            );
          })}
        </ul>
      )}
      {visible.length > shown ? (
        <button
          className={ui.quiet}
          onClick={() => setShown((count) => count + PAGE)}
          type="button"
        >
          Show {Math.min(PAGE, visible.length - shown)} more of {visible.length - shown}
        </button>
      ) : null}

      <div className={styles.footer}>
        <span>
          <span>
            <strong>{chosen.length}</strong> to add
          </span>
          <span className={styles.footerTotals}>
            <span className={ui.gain}>+{formatMoney(totalIn)}</span> ·{' '}
            <span>−{formatMoney(totalOut)}</span>
          </span>
        </span>
        <button className={ui.button} disabled={chosen.length === 0} onClick={add} type="button">
          Add {chosen.length}
        </button>
      </div>
    </div>
  );
}
