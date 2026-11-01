import { ChevronRight, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import {
  holdingRows,
  isPms,
  portfolioCategories,
  valuationAge,
  type CategoryRow,
} from '../../domain/analytics';
import { estimateGratuity, totalGratuity } from '../../domain/gratuity';
import { groupXirr, growthType, monthlyContribution } from '../../domain/holdings';
import { cagr } from '../../domain/returns';
import {
  gratuityAccountSchema,
  PMS_TYPE,
  type GratuityAccount,
  type Holding,
} from '../../schema/records';
import { useSettings, useTracker, useView } from '../../store/tracker';
import { Donut } from '../../ui/charts';
import { Field } from '../../ui/Field';
import { formatMoney, formatPercent, localDate, signedMoney } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { Metric } from '../../ui/Stat';
import { useIsPhone } from '../../ui/useIsPhone';
import ui from '../../ui/ui.module.css';
import { CategoryDialog } from './HoldingActions';
import { HoldingForm } from './HoldingForm';

type Section = 'investments' | 'retirement';

const SECTION_KEY = 'investmentSection';

function savedSection(): Section {
  try {
    return localStorage.getItem(SECTION_KEY) === 'retirement' ? 'retirement' : 'investments';
  } catch {
    return 'investments';
  }
}

/** Phones show one section at a time. The choice is remembered on the device. */
function SectionTabs({
  section,
  onChange,
}: {
  section: Section;
  onChange: (next: Section) => void;
}) {
  const choose = (next: Section) => {
    onChange(next);
    try {
      localStorage.setItem(SECTION_KEY, next);
    } catch {
      // The choice still applies for this visit.
    }
  };
  return (
    <div aria-label="Investment sections" className={ui.segmented} role="tablist">
      {(['investments', 'retirement'] as const).map((key) => (
        <button
          aria-selected={section === key}
          className={section === key ? ui.segmentActive : ui.segment}
          key={key}
          onClick={() => choose(key)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              choose(section === 'investments' ? 'retirement' : 'investments');
            }
          }}
          role="tab"
          tabIndex={section === key ? 0 : -1}
          type="button"
        >
          {key === 'investments' ? 'Investments' : 'Retirement'}
        </button>
      ))}
    </div>
  );
}

function GratuityForm({ onDone }: { onDone: () => void }) {
  const commit = useTracker((state) => state.commit);
  const [member, setMember] = useState('');
  const [date, setDate] = useState('');
  const [salary, setSalary] = useState('');
  const id = crypto.randomUUID();
  const parsed = gratuityAccountSchema.safeParse({ id, member, date, basicSalary: Number(salary) });
  return (
    <form
      className={ui.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!parsed.success) return;
        commit([
          { type: 'set', collection: 'gratuityAccounts', id: parsed.data.id, value: parsed.data },
        ]);
        onDone();
      }}
    >
      <Field label="Family member">
        <input onChange={(event) => setMember(event.target.value)} value={member} />
      </Field>
      <Field label="Date of joining">
        <input onChange={(event) => setDate(event.target.value)} type="date" value={date} />
      </Field>
      <Field label="Monthly basic salary (₹)">
        <input
          inputMode="decimal"
          onChange={(event) => setSalary(event.target.value)}
          type="number"
          value={salary}
        />
      </Field>
      <div className={ui.formActions}>
        <button className={ui.button} disabled={!parsed.success} type="submit">
          Save gratuity estimate
        </button>
      </div>
    </form>
  );
}

function AddButton({
  onPick,
  kinds,
}: {
  onPick: (kind: Holding['kind'] | 'gratuity') => void;
  kinds: [string, string][];
}) {
  return (
    <details style={{ position: 'relative' }}>
      <summary className={ui.button} style={{ listStyle: 'none' }}>
        <Plus size={16} /> Add
      </summary>
      <div
        className={ui.card}
        style={{ position: 'absolute', right: 0, zIndex: 1, padding: 8, gap: 4, minWidth: 170 }}
      >
        {kinds.map(([value, label]) => (
          <button
            className={ui.quiet}
            key={value}
            onClick={(event) => {
              event.currentTarget.closest('details')?.removeAttribute('open');
              onPick(value as Holding['kind'] | 'gratuity');
            }}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
    </details>
  );
}

function CategoryCard({
  category,
  onOpen,
  primary,
  monthlyLabel = 'Monthly',
  extra,
}: {
  category: CategoryRow;
  onOpen: () => void;
  primary: { label: string; value: string };
  monthlyLabel?: string;
  extra?: { label: string; value: string };
}) {
  const monthly = category.rows.reduce((sum, row) => sum + monthlyContribution(row.holding), 0);
  const tone = category.gain < 0 ? ui.loss : ui.gain;
  return (
    <button className={ui.categoryCard} onClick={onOpen} type="button">
      <div className={ui.split}>
        <div>
          <div style={{ fontSize: '1.1rem' }}>{CARD_TITLES[category.name] ?? category.name}</div>
          <div className={ui.caption}>
            {category.count}{' '}
            {CARD_TITLES[category.name]
              ? category.count === 1
                ? 'account'
                : 'accounts'
              : category.count === 1
                ? 'holding'
                : 'holdings'}
          </div>
        </div>
        <ChevronRight aria-hidden="true" size={16} />
      </div>
      <div className={ui.metrics} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <Metric label="Current value" value={formatMoney(category.current)} />
        <Metric label={primary.label} value={primary.value} tone={ui.gain} />
        <Metric label="Invested" value={formatMoney(category.invested)} />
        <Metric label="Gain / loss" tone={tone} value={signedMoney(category.gain)} />
        {monthly > 0 ? <Metric label={monthlyLabel} value={formatMoney(monthly)} /> : null}
        {extra ? <Metric label={extra.label} value={extra.value} /> : null}
      </div>
    </button>
  );
}

const CARD_TITLES: Record<string, string> = {
  PF: 'PF Accounts',
  NPS: 'NPS Portfolio',
  PPF: 'PPF Accounts',
};

const rateSummary = (category: CategoryRow) => {
  const rates = [...new Set(category.rows.map((row) => row.holding.rate))];
  if (rates.length !== 1 || rates[0] === undefined) return 'Multiple rates';
  return `${rates[0].toFixed(2)}% p.a.`;
};

export function InvestmentsPage() {
  const data = useView();
  const settings = useSettings();
  const commit = useTracker((state) => state.commit);
  const today = localDate();
  const [adding, setAdding] = useState<Holding['kind'] | 'gratuity' | null>(null);
  const [openName, setOpenName] = useState<string | null>(null);
  const [section, setSection] = useState<Section>(savedSection);
  const phone = useIsPhone();
  const { state: quickAdd } = useLocation() as { state: { add?: 'investment' | 'pms' } | null };

  // The dashboard's add menu lands here with the entry to open.
  useEffect(() => {
    if (quickAdd?.add === 'investment') setAdding('investment');
    if (quickAdd?.add === 'pms') setOpenName(PMS_TYPE);
  }, [quickAdd]);
  const showInvestments = !phone || section === 'investments';
  const showRetirement = !phone || section === 'retirement';

  const rows = holdingRows(data, today);
  const categories = portfolioCategories(rows);
  const current = rows.reduce((sum, row) => sum + row.position.current, 0);
  const invested = rows.reduce((sum, row) => sum + row.position.invested, 0);
  const gain = current - invested;
  const monthly = rows.reduce((sum, row) => sum + monthlyContribution(row.holding), 0);
  const pms = rows.filter((row) => isPms(row.holding));
  const general = categories.filter(
    (row) => row.rows[0]?.holding.kind === 'investment' && !isPms(row.rows[0].holding),
  );
  const retirement = categories.filter((row) => row.rows[0]?.holding.kind !== 'investment');
  const open = categories.find((row) => row.name === openName) ?? null;
  const gratuity = totalGratuity(data.gratuityAccounts, today);

  const primaryFor = (category: CategoryRow) => {
    const growth = growthType(category.name, settings);
    const holdings = category.rows.map((row) => row.holding);
    if (growth === 'fixed' || category.name === 'PF' || category.name === 'PPF') {
      return { label: 'Interest rate', value: rateSummary(category) };
    }
    if (growth === 'no-return') {
      return { label: 'Absolute return', value: formatPercent(category.absolute, 2) };
    }
    return { label: 'XIRR', value: formatPercent(groupXirr(holdings, data, today), 2) };
  };

  return (
    <div className={ui.page}>
      <PageHeader
        eyebrow="Investment overview"
        subtitle="Track your portfolio, retirement accounts, contributions and returns."
        title="Investments"
      />
      <div className={ui.twoColumn}>
        <section aria-label="Portfolio value" className={ui.hero}>
          <div className={ui.split}>
            <span>Current portfolio value</span>
            <span className={ui.badgeDone}>
              {signedMoney(gain)} {formatPercent(invested > 0 ? gain / invested : null)} return
            </span>
          </div>
          <div className={ui.value}>{formatMoney(current)}</div>
          <div className={ui.caption}>Across investment and retirement accounts</div>
          <div className={ui.metrics}>
            <Metric label="Total invested" value={formatMoney(invested)} />
            <Metric label="Monthly savings" value={formatMoney(monthly)} />
          </div>
        </section>
        <section className={ui.card}>
          <div>
            <h2>Asset allocation</h2>
            <div className={ui.caption}>Current balances by asset type · excludes gratuity</div>
          </div>
          {categories.length === 0 ? (
            <p className={ui.empty}>No holdings yet.</p>
          ) : (
            <Donut
              centerLabel="Portfolio"
              centerValue={formatMoney(current)}
              segments={categories.map((row) => ({ label: row.name, value: row.current }))}
              title="Asset allocation"
            />
          )}
        </section>
      </div>

      {phone ? <SectionTabs onChange={setSection} section={section} /> : null}

      {showInvestments && pms.length > 0 ? (
        <section className={ui.card}>
          <h2 style={{ fontSize: '1.2rem' }}>Stallion PMS</h2>
          {pms.map(({ holding, position }) => (
            <div className={ui.metric} key={holding.id}>
              <button
                className={ui.split}
                onClick={() => setOpenName(holding.type)}
                style={{
                  width: '100%',
                  padding: 0,
                  color: 'inherit',
                  font: 'inherit',
                  background: 'none',
                  border: 0,
                  cursor: 'pointer',
                }}
                type="button"
              >
                <span style={{ textAlign: 'left' }}>
                  <strong style={{ fontSize: '1.15rem' }}>{holding.name}</strong>
                  <span className={ui.caption} style={{ display: 'block' }}>
                    {holding.member}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" size={16} />
              </button>
              <div className={ui.metrics} style={{ marginTop: 12 }}>
                <Metric label="Current value" value={formatMoney(position.current)} />
                <Metric label="Invested" value={formatMoney(position.invested)} />
                <Metric
                  label="Gain / loss"
                  tone={position.gain < 0 ? ui.loss : ui.gain}
                  value={signedMoney(position.gain)}
                />
                <Metric
                  label="Absolute return"
                  tone={ui.gain}
                  value={formatPercent(position.absolute, 2)}
                />
                <Metric
                  label="CAGR"
                  tone={ui.gain}
                  value={formatPercent(
                    cagr(position.invested, position.current, holding.date, today),
                    2,
                  )}
                />
                <Metric label="XIRR" tone={ui.gain} value={formatPercent(position.xirr, 2)} />
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {showInvestments ? (
        <section className={ui.card}>
          <div className={ui.cardHeader}>
            <div>
              <h2 style={{ fontSize: '1.2rem' }}>Investment Portfolio</h2>
              <div className={ui.caption}>Stocks, mutual funds, ETFs and other holdings</div>
            </div>
            <AddButton kinds={[['investment', 'Investment']]} onPick={setAdding} />
          </div>
          {general.length === 0 ? (
            <p className={ui.empty}>No investments recorded yet.</p>
          ) : (
            <div className={ui.threeColumn}>
              {general.map((category) => (
                <CategoryCard
                  category={category}
                  key={category.name}
                  onOpen={() => setOpenName(category.name)}
                  primary={primaryFor(category)}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {showRetirement ? (
        <section className={ui.card}>
          <div className={ui.cardHeader}>
            <div>
              <h2 style={{ fontSize: '1.2rem' }}>Retirement Accounts</h2>
              <div className={ui.caption}>PF, PPF, NPS and gratuity</div>
            </div>
            <AddButton
              kinds={[
                ['pf', 'PF account'],
                ['ppf', 'PPF account'],
                ['nps', 'NPS account'],
                ['gratuity', 'Gratuity estimate'],
              ]}
              onPick={setAdding}
            />
          </div>
          {retirement.length === 0 && data.gratuityAccounts.length === 0 ? (
            <div className={ui.metric}>
              <div className={ui.cardHeader} style={{ justifyContent: 'flex-start' }}>
                <span aria-hidden="true" className={ui.tileIcon}>
                  <PiggyBank size={20} />
                </span>
                <div>
                  <strong>No retirement accounts yet</strong>
                  <div className={ui.caption}>
                    Add a PF, PPF, NPS or gratuity account to get started.
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <div className={ui.threeColumn}>
            {retirement.map((category) => (
              <CategoryCard
                category={category}
                key={category.name}
                onOpen={() => setOpenName(category.name)}
                primary={primaryFor(category)}
                {...(category.name === 'PF'
                  ? {
                      monthlyLabel: 'Monthly PF',
                      extra: {
                        label: 'EPS balance',
                        value: formatMoney(
                          category.rows.reduce((sum, row) => sum + row.position.eps, 0),
                        ),
                      },
                    }
                  : {})}
              />
            ))}
            {data.gratuityAccounts.length > 0 ? (
              <div className={ui.categoryCard} style={{ cursor: 'default' }}>
                <div>
                  <div style={{ fontSize: '1.1rem' }}>Gratuity</div>
                  <div className={ui.caption}>
                    {data.gratuityAccounts.length}{' '}
                    {data.gratuityAccounts.length === 1 ? 'member' : 'members'}
                  </div>
                </div>
                <Metric label="Estimated value" value={formatMoney(gratuity)} />
                <ul className={ui.list}>
                  {data.gratuityAccounts.map((account: GratuityAccount) => {
                    const estimate = estimateGratuity(account, today);
                    return (
                      <li className={ui.row} key={account.id}>
                        <div className={ui.rowMain}>
                          <div className={ui.rowTitle}>{account.member}</div>
                          <div className={ui.rowDetail}>
                            {estimate.eligible
                              ? `${estimate.countedYears} years counted`
                              : `Eligible after 5 years · ${estimate.completedYears} served`}
                          </div>
                        </div>
                        <span className={ui.amount}>{formatMoney(estimate.amount)}</span>
                        <button
                          aria-label={`Delete gratuity for ${account.member}`}
                          className={ui.smallIcon}
                          onClick={() =>
                            commit([
                              { type: 'delete', collection: 'gratuityAccounts', id: account.id },
                            ])
                          }
                          type="button"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {rows.length > 0 ? (
        <details className={`${ui.card} ${ui.fold}`}>
          <summary>Record freshness</summary>
          <p className={ui.caption}>
            Confirming records today's value against your statement. It doesn't change the balance.
          </p>
          <ul className={ui.list}>
            {rows.map(({ holding, position }) => (
              <li className={ui.row} key={holding.id}>
                <div className={ui.rowMain}>
                  <div className={ui.rowTitle}>{holding.name}</div>
                  <div className={ui.rowDetail}>{valuationAge(holding.id, data, today)}</div>
                </div>
                <span className={ui.amount}>{formatMoney(position.current)}</span>
                <button
                  aria-label={`Confirm value of ${holding.name}`}
                  className={ui.quiet}
                  onClick={() => {
                    const id = crypto.randomUUID();
                    commit([
                      {
                        type: 'set',
                        collection: 'valuations',
                        id,
                        value: { id, holdingId: holding.id, date: today, value: position.current },
                      },
                    ]);
                  }}
                  type="button"
                >
                  Confirm
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {adding === 'gratuity' ? (
        <Modal onClose={() => setAdding(null)} title="Add gratuity estimate">
          <GratuityForm onDone={() => setAdding(null)} />
        </Modal>
      ) : null}
      {adding && adding !== 'gratuity' ? (
        <Modal
          onClose={() => setAdding(null)}
          title={`Add ${adding === 'investment' ? 'investment' : adding.toUpperCase()}`}
        >
          <HoldingForm kind={adding} onDone={() => setAdding(null)} />
        </Modal>
      ) : null}
      {open ? <CategoryDialog category={open} onClose={() => setOpenName(null)} /> : null}
    </div>
  );
}
