import { useState } from 'react';
import type { Holding } from '../../schema/records';
import { useSaveSettings, useSettings, useTracker } from '../../store/tracker';
import { AppearanceChoice } from '../../ui/AppearanceChoice';
import { Field } from '../../ui/Field';
import { localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import ui from '../../ui/ui.module.css';
import { ExpenseForm, IncomeForm } from '../cashflow/EntryForms';
import { BalanceForm } from '../cashflow/MonthlyBalances';
import { LoanForm } from '../debts/LoanForm';
import { HoldingForm } from '../investments/HoldingForm';

type StepKey = 'appearance' | 'balance' | 'income' | 'expense' | 'loan' | 'investment';

const STEPS: { key: StepKey; title: string; text: string; action?: string }[] = [
  {
    key: 'appearance',
    title: 'Choose how it looks',
    text: 'Pick light or dark mode and a colour theme. You can change it later in Settings.',
  },
  {
    key: 'balance',
    title: 'Set your opening balance',
    text: 'Record what is in the bank this month.',
    action: 'Set bank balance',
  },
  {
    key: 'income',
    title: 'Add your income',
    text: 'Log a salary, rental receipt or other income.',
    action: 'Add income',
  },
  {
    key: 'expense',
    title: 'Add an expense',
    text: 'Record what the household spends.',
    action: 'Add expense',
  },
  {
    key: 'loan',
    title: 'Add a loan',
    text: 'Skip this if you have no loans.',
    action: 'Add loan',
  },
  {
    key: 'investment',
    title: 'Add your investments',
    text: 'Add one here, and the rest from the Investments page after setup.',
    action: 'Add investment',
  },
];

const KINDS: [Holding['kind'], string][] = [
  ['investment', 'Investment'],
  ['pf', 'PF'],
  ['ppf', 'PPF'],
  ['nps', 'NPS'],
];

const TOTAL_STEPS = STEPS.length + 1;

/** Shown until setup is finished or skipped. Each step opens the same form as its page. */
export function GettingStarted() {
  const data = useTracker((state) => state.data);
  const canEdit = useTracker((state) => state.canEdit);
  const settings = useSettings();
  const save = useSaveSettings();
  const setTourOpen = useTracker((state) => state.setTourOpen);
  const [step, setStep] = useState(settings.familyMembers.length > 0 ? 1 : 0);
  const [name, setName] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<Holding['kind']>('investment');

  const hasRecords = [data.income, data.expenses, data.holdings, data.loans].some(
    (rows) => rows.length > 0,
  );
  if (!canEdit || settings.onboardingDone) return null;
  if (hasRecords && settings.familyMembers.length > 0 && step === 0) return null;

  const firstName = name.trim();
  const current = STEPS[step - 1];
  // The tour follows however setup ends, and has its own Skip button.
  const finish = () => {
    save({ onboardingDone: true });
    setTourOpen(true);
  };
  const next = () => {
    if (step < STEPS.length) setStep(step + 1);
    else finish();
  };
  // A saved form moves setup on. Closing it without saving stays on the step.
  const saved = () => {
    setFormOpen(false);
    next();
  };

  const form = (key: StepKey) => {
    if (key === 'balance') return <BalanceForm month={localDate().slice(0, 7)} onDone={saved} />;
    if (key === 'income') return <IncomeForm onDone={saved} />;
    if (key === 'expense') return <ExpenseForm onDone={saved} />;
    if (key === 'loan') return <LoanForm onDone={saved} />;
    if (key === 'investment') return <HoldingForm kind={kind} onDone={saved} />;
    return null;
  };

  return (
    <section aria-label="Set up your finances" className={ui.card}>
      <div className={ui.split}>
        <span className={ui.caption}>Set up your finances</span>
        <span className={ui.caption}>
          Step {step + 1} of {TOTAL_STEPS}
        </span>
      </div>
      <div className={ui.meter} style={{ height: 5 }}>
        <span className={ui.meterFill} style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
      </div>
      {step === 0 ? (
        <form
          className={ui.page}
          onSubmit={(event) => {
            event.preventDefault();
            if (!firstName) return;
            save({ familyMembers: [...settings.familyMembers, firstName] });
            setStep(1);
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.4rem' }}>What's your first name?</h2>
            <p className={ui.subtitle}>A name to make this space yours.</p>
          </div>
          <Field label="First name">
            <input maxLength={60} onChange={(event) => setName(event.target.value)} value={name} />
          </Field>
          <div className={ui.actions} style={{ justifyContent: 'space-between' }}>
            <button className={ui.quiet} onClick={finish} type="button">
              Skip setup
            </button>
            <button className={ui.button} disabled={!firstName} type="submit">
              Continue
            </button>
          </div>
        </form>
      ) : current ? (
        <>
          <div>
            <h2 style={{ fontSize: '1.4rem' }}>{current.title}</h2>
            <p className={ui.subtitle}>{current.text}</p>
          </div>
          {current.key === 'appearance' ? <AppearanceChoice /> : null}
          {current.key === 'investment' ? (
            <div aria-label="Account type" className={ui.segmented} role="group">
              {KINDS.map(([key, label]) => (
                <button
                  aria-pressed={kind === key}
                  className={kind === key ? ui.segmentActive : ui.segment}
                  key={key}
                  onClick={() => setKind(key)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          {current.action ? (
            <button className={ui.button} onClick={() => setFormOpen(true)} type="button">
              {current.action}
            </button>
          ) : null}
          <div className={ui.actions} style={{ justifyContent: 'space-between' }}>
            <button className={ui.quiet} onClick={() => setStep(step - 1)} type="button">
              Back
            </button>
            <div className={ui.actions}>
              <button className={ui.quiet} onClick={finish} type="button">
                Skip setup
              </button>
              <button
                className={current.action ? ui.quiet : ui.button}
                onClick={next}
                type="button"
              >
                {step === STEPS.length ? 'Finish' : current.action ? 'Skip step' : 'Continue'}
              </button>
            </div>
          </div>
          {formOpen && current.action ? (
            <Modal fullScreenOnPhone onClose={() => setFormOpen(false)} title={current.action}>
              {form(current.key)}
            </Modal>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
