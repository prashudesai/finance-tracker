import { useState } from 'react';
import { roundMoney } from '../../domain/calendar';
import { Field } from '../../ui/Field';
import { formatMoney } from '../../ui/format';
import ui from '../../ui/ui.module.css';

/** The income planned for the year, entered for a month or for the year, and saved yearly. */
export function BudgetIncomeForm({
  income,
  onSave,
  onCancel,
}: {
  income: number;
  onSave: (yearly: number) => void;
  onCancel: () => void;
}) {
  const [perYear, setPerYear] = useState(false);
  const [amount, setAmount] = useState(income > 0 ? String(roundMoney(income / 12)) : '');
  const entered = Number(amount || 0);
  const valid = amount.trim() !== '' && Number.isFinite(entered) && entered > 0;
  const yearly = roundMoney(perYear ? entered : entered * 12);
  const [tried, setTried] = useState(false);

  return (
    <form
      className={ui.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (valid) onSave(yearly);
      }}
    >
      <p className={`${ui.caption} ${ui.formWide}`}>
        Take-home income you expect this financial year, such as salary after tax and other regular
        income. It's only used for this plan.
      </p>
      <div className={ui.formWide}>
        <span className={ui.label}>Enter the amount</span>
        <div aria-label="Enter the amount" className={ui.segmented} role="radiogroup">
          {[false, true].map((year) => (
            <button
              aria-checked={perYear === year}
              className={perYear === year ? ui.segmentActive : ui.segment}
              key={String(year)}
              onClick={() => {
                if (year !== perYear && entered > 0) {
                  setAmount(String(year ? roundMoney(entered * 12) : roundMoney(entered / 12)));
                }
                setPerYear(year);
              }}
              role="radio"
              type="button"
            >
              {year ? 'For the year' : 'For a month'}
            </button>
          ))}
        </div>
      </div>
      <Field
        error={tried && !valid ? 'Enter the income in rupees.' : undefined}
        label={perYear ? 'Income for the year' : 'Income a month'}
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
      {valid ? (
        <p className={`${ui.caption} ${ui.formWide}`}>
          {perYear
            ? `About ${formatMoney(roundMoney(yearly / 12))} a month.`
            : `${formatMoney(yearly)} over the year.`}
        </p>
      ) : null}
      <div className={`${ui.actions} ${ui.formWide}`}>
        {income > 0 ? (
          <button className={ui.quiet} onClick={() => onSave(0)} type="button">
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
