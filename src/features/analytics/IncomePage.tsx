import { useState } from 'react';
import { financialYearsWithData } from '../../domain/analytics';
import { financialYearLabel, financialYearStart } from '../../domain/calendar';
import { useSpendingView } from '../../store/tracker';
import { localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import { IncomeSection } from './IncomeSection';

/** Planning › Income: where money comes from, how it's changing, and where it goes. */
export function IncomePage() {
  const data = useSpendingView();
  const today = localDate();
  const [year, setYear] = useState(financialYearStart(today));
  return (
    <div className={ui.page}>
      <div className={ui.split}>
        <span />
        <label className={`${ui.caption} ${ui.inlineSort}`}>
          Financial year
          <select
            className={ui.fieldSelect}
            onChange={(event) => setYear(Number(event.target.value))}
            value={year}
          >
            {financialYearsWithData(data, today).map((value) => (
              <option key={value} value={value}>
                {financialYearLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <IncomeSection year={year} />
    </div>
  );
}
