import { useState } from 'react';
import { Link } from 'react-router';
import { useSaveSettings, useSettings, useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import ui from '../../ui/ui.module.css';

const STEPS = [
  {
    title: 'Set your opening balance',
    text: 'Record what is in the bank this month.',
    to: '/cash-flow',
    link: 'Set bank balance',
  },
  {
    title: 'Add your income',
    text: 'Log a salary, rental receipt or other income.',
    to: '/cash-flow',
    link: 'Add income',
  },
  {
    title: 'Add an expense',
    text: 'Record what the household spends.',
    to: '/cash-flow',
    link: 'Add expense',
  },
  { title: 'Add a loan', text: 'Skip this if you have no loans.', to: '/debts', link: 'Add loan' },
  {
    title: 'Add your investments',
    text: 'Funds, deposits, PF, PPF, NPS and gratuity.',
    to: '/investments',
    link: 'Add investment',
  },
];

const TOTAL_STEPS = STEPS.length + 1;

/** Shown until setup is finished or skipped. Records are never created here. */
export function GettingStarted() {
  const data = useTracker((state) => state.data);
  const canEdit = useTracker((state) => state.canEdit);
  const settings = useSettings();
  const save = useSaveSettings();
  const setTourOpen = useTracker((state) => state.setTourOpen);
  const [step, setStep] = useState(settings.familyMembers.length > 0 ? 1 : 0);
  const [name, setName] = useState('');

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
          <Link className={ui.quiet} to={current.to}>
            {current.link}
          </Link>
          <div className={ui.actions} style={{ justifyContent: 'space-between' }}>
            <button className={ui.quiet} onClick={() => setStep(step - 1)} type="button">
              Back
            </button>
            <div className={ui.actions}>
              <button className={ui.quiet} onClick={finish} type="button">
                Skip setup
              </button>
              <button
                className={ui.button}
                onClick={() => {
                  if (step < STEPS.length) {
                    setStep(step + 1);
                    return;
                  }
                  finish();
                }}
                type="button"
              >
                {step === STEPS.length ? 'Finish' : 'Continue'}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
