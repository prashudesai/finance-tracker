import { ChevronRight, Pencil, PiggyBank, Plus, Trash2, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { optionLists } from '../../domain/options';
import {
  holdingLabel,
  holdingRows,
  isPms,
  portfolioCategories,
  valuationAge,
  type CategoryRow,
} from '../../domain/analytics';
import { estimateGratuity, totalGratuity } from '../../domain/gratuity';
import { financialYearLabel } from '../../domain/calendar';
import {
  bookedProfitByYear,
  groupXirr,
  growthType,
  monthlyContribution,
} from '../../domain/holdings';
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
import { MemberField, useDefaultMember } from '../../ui/MemberField';
import { formatDay, formatMoney, formatPercent, localDate, signedMoney } from '../../ui/format';
import { EmptyState } from '../../ui/EmptyState';
import { Modal } from '../../ui/Modal';
import { AddValueDialog } from '../../ui/Select';
import { PageHeader } from '../../ui/PageHeader';
import { Metric } from '../../ui/Stat';
import { scrollToSection } from '../../ui/scroll';
import { useIsPhone } from '../../ui/useIsPhone';
import ui from '../../ui/ui.module.css';
import { CategoryDialog } from './HoldingActions';
import { HoldingForm } from './HoldingForm';

type Section = 'investments' | 'retirement';

const SECTIONS: Section[] = ['investments', 'retirement'];
const SECTION_NAMES: Record<Section, string> = {
  investments: 'Investments',
  retirement: 'Retirement',
};

const SECTION_KEY = 'investmentSection';

function savedSection(): Section {
  try {
    const saved = localStorage.getItem(SECTION_KEY);
    return SECTIONS.find((key) => key === saved) ?? 'investments';
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
      {SECTIONS.map((key, index) => (
        <button
          aria-selected={section === key}
          className={section === key ? ui.segmentActive : ui.segment}
          key={key}
          onClick={() => choose(key)}
          onKeyDown={(event) => {
            const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
            if (step) choose(SECTIONS[(index + step + SECTIONS.length) % SECTIONS.length] ?? key);
          }}
          role="tab"
          tabIndex={section === key ? 0 : -1}
          type="button"
        >
          {SECTION_NAMES[key]}
        </button>
      ))}
    </div>
  );
}

/** Adds a gratuity estimate, or edits one, as basic salary changes over the years. */
function GratuityForm({ onDone, initial }: { onDone: () => void; initial?: GratuityAccount }) {
  const commit = useTracker((state) => state.commit);
  const defaultMember = useDefaultMember();
  const [member, setMember] = useState(initial?.member ?? defaultMember);
  const [date, setDate] = useState(initial?.date ?? '');
  const [salary, setSalary] = useState(initial ? String(initial.basicSalary) : '');
  const [id] = useState(() => initial?.id ?? crypto.randomUUID());
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
      <MemberField
        name="member"
        onChange={(event) => setMember(event.target.value)}
        value={member}
      />
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
          {initial ? 'Save changes' : 'Save gratuity estimate'}
        </button>
      </div>
    </form>
  );
}

const ADD_NEW_TYPE = '__add_new__';

function AddButton({
  onPick,
  kinds,
}: {
  onPick: (value: string) => void;
  kinds: [string, string][];
}) {
  return (
    <details style={{ position: 'relative' }}>
      <summary className={ui.button} style={{ listStyle: 'none' }}>
        <Plus size={16} /> Add
      </summary>
      <div
        className={ui.card}
        style={{
          position: 'absolute',
          right: 0,
          zIndex: 1,
          padding: 8,
          gap: 4,
          minWidth: 170,
          background: 'var(--surface-raised)',
          maxHeight: '60dvh',
          overflowY: 'auto',
        }}
      >
        {kinds.map(([value, label]) => (
          <button
            className={ui.quiet}
            key={value}
            onClick={(event) => {
              event.currentTarget.closest('details')?.removeAttribute('open');
              onPick(value);
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
          <div style={{ fontWeight: 600 }}>{CARD_TITLES[category.name] ?? category.name}</div>
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
      <div className={ui.compact}>
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
  const [gratuityOpen, setGratuityOpen] = useState(false);
  const [editingGratuity, setEditingGratuity] = useState<GratuityAccount | null>(null);
  const [addingType, setAddingType] = useState<string | null>(null);
  const [openName, setOpenName] = useState<string | null>(null);
  const [addingNewType, setAddingNewType] = useState(false);
  const canEdit = useTracker((state) => state.canEdit);
  const { investmentTypes } = optionLists(settings);
  const addInvestment = (type: string) => {
    setAddingType(type);
    setAdding('investment');
  };
  const finishAdding = () => {
    setAdding(null);
    setAddingType(null);
  };
  const [section, setSection] = useState<Section>(savedSection);
  const phone = useIsPhone();
  const { state: quickAdd, search } = useLocation() as {
    state: { add?: 'investment' | 'pms'; open?: string; confirm?: boolean } | null;
    search: string;
  };
  // Goals moved to Planning › Goal planning. Older links still land there.
  const navigate = useNavigate();
  useEffect(() => {
    if (new URLSearchParams(search).get('view') === 'goals') {
      void navigate('/analytics/goals', { replace: true });
    }
  }, [navigate, search]);

  // The dashboard's add menu lands here with the entry to open.
  useEffect(() => {
    if (quickAdd?.add === 'investment') setAdding('investment');
    if (quickAdd?.add === 'pms') setOpenName(PMS_TYPE);
    if (quickAdd?.confirm) scrollToSection('record-freshness');
    if (quickAdd?.open) {
      setOpenName(quickAdd.open);
      if (['PF', 'PPF', 'NPS'].includes(quickAdd.open)) setSection('retirement');
    }
  }, [quickAdd]);
  const showInvestments = !phone || section === 'investments';
  const showRetirement = !phone || section === 'retirement';

  const rows = holdingRows(data, today);
  const isUnconfirmed = ({ holding }: (typeof rows)[number]) =>
    valuationAge(holding.id, data, today) === 'Unverified';
  const unconfirmed = rows.filter(isUnconfirmed);
  const confirmed = rows.filter((row) => !isUnconfirmed(row));
  const confirmValue = ({ holding, position }: (typeof rows)[number]) => {
    const id = crypto.randomUUID();
    commit([
      {
        type: 'set',
        collection: 'valuations',
        id,
        value: { id, holdingId: holding.id, date: today, value: position.current },
      },
    ]);
  };
  const freshnessRow = (row: (typeof rows)[number], action: string) => (
    <li className={ui.row} key={row.holding.id}>
      <div className={ui.rowMain}>
        <div className={ui.rowTitle}>{holdingLabel(row.holding)}</div>
        <div className={ui.rowDetail}>{valuationAge(row.holding.id, data, today)}</div>
      </div>
      <span className={ui.amount}>{formatMoney(row.position.current)}</span>
      <button
        aria-label={`${action} value of ${row.holding.name}`}
        className={ui.quiet}
        onClick={() => confirmValue(row)}
        type="button"
      >
        {action}
      </button>
    </li>
  );
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
  const booked = bookedProfitByYear(
    rows.map((row) => row.holding),
    data,
    today,
  );

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
          </div>
          <div className={ui.value}>{formatMoney(current)}</div>
          <div className={`${ui.heroGain} ${gain < 0 ? ui.loss : ui.gain}`}>
            {signedMoney(gain)} · {formatPercent(invested > 0 ? gain / invested : null)} return
          </div>
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
                  <strong>{holding.name}</strong>
                  <span className={ui.caption} style={{ display: 'block' }}>
                    {holding.member}
                  </span>
                </span>
                <ChevronRight aria-hidden="true" size={16} />
              </button>
              <div className={ui.compact} style={{ marginTop: 8 }}>
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

      {booked.length > 0 ? (
        <section aria-label="Booked profit" className={ui.card}>
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>Booked profit</h2>
            <div className={ui.caption}>
              Profit taken out by withdrawals from any account, by financial year, at average cost
            </div>
          </div>
          <ul className={ui.list}>
            {booked.map((row) => (
              <li className={ui.row} key={row.year}>
                <div className={ui.rowMain}>
                  <div className={ui.rowTitle}>{financialYearLabel(row.year)}</div>
                </div>
                <span className={`${ui.amount} ${row.profit < 0 ? ui.loss : ui.gain}`}>
                  {signedMoney(row.profit)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showInvestments ? (
        <section className={ui.card}>
          <div className={ui.cardHeader}>
            <div>
              <h2 style={{ fontSize: '1.2rem' }}>Investment portfolio</h2>
              <div className={ui.caption}>Stocks, mutual funds, ETFs and other holdings</div>
            </div>
            <AddButton
              kinds={[
                ...investmentTypes.map((type): [string, string] => [type, type]),
                ...(canEdit ? [[ADD_NEW_TYPE, '+ Add new…'] as [string, string]] : []),
              ]}
              onPick={(type) => {
                if (type === ADD_NEW_TYPE) {
                  setAddingNewType(true);
                  return;
                }
                addInvestment(type);
              }}
            />
          </div>
          {general.length === 0 ? (
            <EmptyState
              action={
                <button className={ui.quiet} onClick={() => setAdding('investment')} type="button">
                  Add your first investment
                </button>
              }
              icon={TrendingUp}
              text="Add a fund, deposit or bond to track its value and returns."
              title="No investments recorded yet."
            />
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
              <h2 style={{ fontSize: '1.2rem' }}>Retirement accounts</h2>
              <div className={ui.caption}>PF, PPF, NPS and gratuity</div>
            </div>
            <AddButton
              kinds={[
                ['pf', 'PF account'],
                ['ppf', 'PPF account'],
                ['nps', 'NPS account'],
                ['gratuity', 'Gratuity estimate'],
              ]}
              onPick={(kind) => setAdding(kind as Holding['kind'] | 'gratuity')}
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
              <button
                aria-label="Gratuity: open to edit or delete"
                className={ui.categoryCard}
                onClick={() => setGratuityOpen(true)}
                type="button"
              >
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
                      </li>
                    );
                  })}
                </ul>
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {rows.length > 0 ? (
        <details
          className={`${ui.card} ${ui.fold}`}
          id="record-freshness"
          open={quickAdd?.confirm === true}
        >
          <summary>Record freshness</summary>
          <p className={ui.caption}>
            Confirming records today's value against your statement. It doesn't change the balance.
          </p>
          {unconfirmed.length > 0 ? (
            <ul className={ui.list}>{unconfirmed.map((row) => freshnessRow(row, 'Confirm'))}</ul>
          ) : (
            <p className={ui.empty}>All values are confirmed.</p>
          )}
          {confirmed.length > 0 ? (
            <details className={ui.fold}>
              <summary>Confirmed values · {confirmed.length}</summary>
              <ul className={ui.list}>{confirmed.map((row) => freshnessRow(row, 'Update'))}</ul>
            </details>
          ) : null}
        </details>
      ) : null}

      {gratuityOpen && !editingGratuity ? (
        <Modal onClose={() => setGratuityOpen(false)} title="Gratuity">
          <ul className={ui.list}>
            {data.gratuityAccounts.map((account) => {
              const estimate = estimateGratuity(account, today);
              return (
                <li className={ui.row} key={account.id}>
                  <div className={ui.rowMain}>
                    <div className={ui.rowTitle}>
                      {account.member} · {formatMoney(estimate.amount)}
                    </div>
                    <div className={ui.rowDetail}>
                      Basic {formatMoney(account.basicSalary)} a month · joined{' '}
                      {formatDay(account.date)} {account.date.slice(0, 4)} ·{' '}
                      {estimate.eligible
                        ? `${estimate.countedYears} years counted`
                        : `eligible after 5 years, ${estimate.completedYears} served`}
                    </div>
                  </div>
                  <span className={ui.actions}>
                    <button
                      aria-label={`Edit gratuity for ${account.member}`}
                      className={ui.smallIcon}
                      data-tip="Edit"
                      onClick={() => setEditingGratuity(account)}
                      type="button"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      aria-label={`Delete gratuity for ${account.member}`}
                      className={ui.smallIcon}
                      data-tip="Delete"
                      onClick={() => {
                        if (!window.confirm(`Delete the gratuity estimate for ${account.member}?`))
                          return;
                        commit([
                          { type: 'delete', collection: 'gratuityAccounts', id: account.id },
                        ]);
                        if (data.gratuityAccounts.length === 1) setGratuityOpen(false);
                      }}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={ui.caption}>
            Update the basic salary whenever it changes. The estimate is basic × 15/26 × years
            counted, after 5 years, capped at ₹20 lakh.
          </p>
        </Modal>
      ) : null}
      {editingGratuity ? (
        <Modal
          onClose={() => setEditingGratuity(null)}
          title={`Edit gratuity for ${editingGratuity.member}`}
        >
          <GratuityForm initial={editingGratuity} onDone={() => setEditingGratuity(null)} />
        </Modal>
      ) : null}
      {adding === 'gratuity' ? (
        <Modal onClose={() => setAdding(null)} title="Add gratuity estimate">
          <GratuityForm onDone={() => setAdding(null)} />
        </Modal>
      ) : null}
      {adding && adding !== 'gratuity' ? (
        <Modal
          onClose={finishAdding}
          title={`Add ${adding === 'investment' ? (addingType ?? 'investment') : adding.toUpperCase()}`}
        >
          <HoldingForm
            kind={adding}
            onDone={finishAdding}
            {...(addingType ? { type: addingType } : {})}
          />
        </Modal>
      ) : null}
      {addingNewType ? (
        <AddValueDialog
          existing={investmentTypes}
          list="investmentTypes"
          onCancel={() => setAddingNewType(false)}
          onSaved={(type) => {
            setAddingNewType(false);
            addInvestment(type);
          }}
        />
      ) : null}
      {open ? <CategoryDialog category={open} onClose={() => setOpenName(null)} /> : null}
    </div>
  );
}
