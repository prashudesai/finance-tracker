import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { holdingRows } from '../../domain/analytics';
import {
  memberMixes,
  reviewMix,
  type AssetClass,
  type MixReview,
  type PortfolioMix,
  type TipTone,
} from '../../domain/portfolioMix';
import { useSettings, useView } from '../../store/tracker';
import { CHART_COLORS } from '../../ui/charts';
import { Choices } from '../../ui/Choices';
import { formatAmount, formatMoney, localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import ui from '../../ui/ui.module.css';
import styles from './Mix.module.css';
import { OPTIONS, PURPOSES, RATES_AS_OF, type OptionId, type OptionPurpose } from './options';
import { tipText } from './tipText';

const CLASS_LABELS: Record<AssetClass, string> = {
  equity: 'Market',
  debt: 'Bonds & deposits',
  gold: 'Gold',
  realEstate: 'Real estate',
  cash: 'Cash',
};

/** Fixed per class, so each keeps its colour in every bar. */
const CLASS_COLORS: Record<AssetClass, string> = {
  equity: CHART_COLORS[0] ?? 'var(--accent)',
  debt: CHART_COLORS[2] ?? '#7f9cf5',
  gold: CHART_COLORS[1] ?? '#d9a24a',
  realEstate: CHART_COLORS[4] ?? '#b58be0',
  cash: CHART_COLORS[7] ?? '#8fb8a8',
};

const TONE_ICONS: Record<TipTone, LucideIcon> = {
  act: AlertTriangle,
  consider: Lightbulb,
  good: CheckCircle2,
};
const TONE_LABELS: Record<TipTone, string> = {
  act: 'Worth acting on',
  consider: 'Worth a look',
  good: 'Looks good',
};

const pct = (share: number) => `${Math.round(share * 100)}%`;

/** Planning › Portfolio mix: what the portfolio is made of, and tips to balance it. */
export function MixPage() {
  const view = useView();
  const settings = useSettings();
  const today = localDate();
  const rows = holdingRows(view, today);
  const review = reviewMix(rows, view, {
    today,
    settings,
    ...(settings.retirement?.birthDate ? { birthDate: settings.retirement.birthDate } : {}),
    ...(settings.retirement?.retireDate ? { retireDate: settings.retirement.retireDate } : {}),
  });
  const members = memberMixes(rows, settings);
  const [open, setOpen] = useState<OptionId | null>(null);

  if (review.mix.total === 0) {
    return (
      <section className={ui.card}>
        <h2 className={ui.cardTitle}>No investments yet</h2>
        <p className={ui.caption}>
          Add investments on the Investments page, and tips for balancing them appear here.
        </p>
      </section>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <MixHero review={review} />
        <MixBars review={review} />
      </div>

      <section aria-labelledby="mix-tips" className={styles.section}>
        <h2 className={styles.heading} id="mix-tips">
          Tips for your mix{review.tips.length > 0 ? ` · ${review.tips.length}` : ''}
        </h2>
        {review.tips.length === 0 ? (
          <p className={ui.caption}>
            Tips start once investments pass {formatMoney(50_000)}, so a single small holding
            doesn't skew them.
          </p>
        ) : (
          <ol className={styles.tips}>
            {review.tips.map((tip) => {
              const text = tipText(tip);
              const Icon = TONE_ICONS[tip.tone];
              return (
                <li className={styles.tip} data-tone={tip.tone} key={tip.kind}>
                  <div className={styles.tipHead}>
                    <span aria-hidden="true" className={styles.tipIcon}>
                      <Icon size={18} />
                    </span>
                    <div>
                      <span className={styles.tipTone}>{TONE_LABELS[tip.tone]}</span>
                      <h3 className={styles.tipTitle}>{text.title}</h3>
                    </div>
                  </div>
                  <p className={styles.tipWhy}>{text.why}</p>
                  <ul className={styles.steps}>
                    {text.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                  {text.options.length > 0 ? (
                    <div className={styles.optionRow}>
                      <span className={styles.optionLabel}>Options to look at</span>
                      <div className={styles.optionChips}>
                        {text.options.map((id) => (
                          <OptionChip id={id} key={id} onOpen={setOpen} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {members.length > 1 ? <MemberMixes members={members} /> : null}

      <OptionCatalog onOpen={setOpen} />

      <p className={styles.disclaimer}>
        These are general rules of thumb from what's recorded here, not advice from a
        SEBI-registered adviser. They don't know your taxes, plans or comfort with risk. Rates are
        as quoted in {RATES_AS_OF} and change often; check them before investing.
      </p>

      {open ? (
        <Modal onClose={() => setOpen(null)} title={OPTIONS[open].name}>
          <OptionDetail id={open} />
        </Modal>
      ) : null}
    </div>
  );
}

function MixHero({ review }: { review: MixReview }) {
  const { mix, guide } = review;
  const steady = mix.share.debt + mix.share.cash + mix.share.realEstate;
  const needed = review.tips.filter((tip) => tip.tone !== 'good').length;
  return (
    <section aria-label="Your mix" className={`${ui.hero} ${styles.hero}`}>
      <span className={styles.heroLabel}>Your mix</span>
      <strong className={styles.heroHeadline}>{pct(mix.share.equity)} in the market</strong>
      <span className={styles.heroSub}>
        {guide.age === null
          ? `A common middle is about ${pct(guide.equity)}. Add a date of birth in the retirement planner for a guide by age.`
          : `A common guide at ${guide.age} is about ${pct(guide.equity)}.`}{' '}
        {needed === 0 ? 'Nothing needs a look.' : `${needed} tip${needed === 1 ? '' : 's'} below.`}
      </span>
      <dl className={styles.heroFacts}>
        <div>
          <dt>Steady</dt>
          <dd>{pct(steady)}</dd>
        </div>
        <div>
          <dt>Gold</dt>
          <dd>{pct(mix.share.gold)}</dd>
        </div>
        <div>
          <dt>Fixed payouts</dt>
          <dd>
            {mix.monthlyPayouts > 0 ? `${formatMoney(mix.monthlyPayouts)} a month` : 'None set'}
          </dd>
        </div>
        <div>
          <dt>Locked till retirement</dt>
          <dd>{pct(mix.total > 0 ? mix.locked / mix.total : 0)}</dd>
        </div>
      </dl>
    </section>
  );
}

function Bar({ parts, label }: { parts: { key: AssetClass; share: number }[]; label: string }) {
  return (
    <div className={styles.barRow}>
      <span className={styles.barName}>{label}</span>
      <div
        aria-label={`${label}: ${parts.map((part) => `${CLASS_LABELS[part.key]} ${pct(part.share)}`).join(', ')}`}
        className={styles.bar}
        role="img"
      >
        {parts
          .filter((part) => part.share > 0)
          .map((part) => (
            <span
              key={part.key}
              style={{ flexGrow: part.share, background: CLASS_COLORS[part.key] }}
              title={`${CLASS_LABELS[part.key]} ${pct(part.share)}`}
            />
          ))}
      </div>
    </div>
  );
}

function MixBars({ review }: { review: MixReview }) {
  const { mix, guide } = review;
  return (
    <section aria-labelledby="mix-now" className={ui.card}>
      <h2 className={ui.cardTitle} id="mix-now">
        Now and the guide
      </h2>
      <div className={styles.bars}>
        <Bar label="Now" parts={mix.classes} />
        <Bar
          label="Guide"
          parts={[
            { key: 'equity', share: guide.equity },
            { key: 'debt', share: guide.steady },
            { key: 'gold', share: guide.gold },
          ]}
        />
      </div>
      <ul className={styles.legend}>
        {[
          ...mix.classes,
          ...(mix.share.gold === 0 ? [{ key: 'gold' as const, share: 0, value: 0 }] : []),
        ].map((row) => (
          <li key={row.key}>
            <i aria-hidden="true" style={{ background: CLASS_COLORS[row.key] }} />
            <span>{CLASS_LABELS[row.key]}</span>
            <strong>{pct(row.share)}</strong>
            <span className={styles.legendValue}>{formatAmount(row.value)}</span>
          </li>
        ))}
      </ul>
      <p className={ui.caption}>
        NPS counts as half market and half bonds, and balanced or hybrid funds the same. PF and PPF
        count as bonds.
      </p>
    </section>
  );
}

function MemberMixes({ members }: { members: { member: string; mix: PortfolioMix }[] }) {
  return (
    <section aria-labelledby="mix-members" className={ui.card}>
      <h2 className={ui.cardTitle} id="mix-members">
        Each person's mix
      </h2>
      <p className={ui.caption}>Choose a person in the header for tips on their mix alone.</p>
      <div className={styles.bars}>
        {members.map(({ member, mix }) => (
          <div className={styles.memberRow} key={member}>
            <Bar label={member} parts={mix.classes} />
            <span className={styles.memberFacts}>
              {formatAmount(mix.total)} · {pct(mix.share.equity)} market · {pct(mix.share.gold)}{' '}
              gold
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function OptionChip({ id, onOpen }: { id: OptionId; onOpen: (id: OptionId) => void }) {
  const option = OPTIONS[id];
  const Icon = option.icon;
  return (
    <button className={styles.optionChip} onClick={() => onOpen(id)} type="button">
      <Icon aria-hidden="true" size={15} /> {option.name}
    </button>
  );
}

function OptionCatalog({ onOpen }: { onOpen: (id: OptionId) => void }) {
  const [purpose, setPurpose] = useState<OptionPurpose>('income');
  const shown = Object.values(OPTIONS).filter((option) => option.purposes.includes(purpose));
  return (
    <section aria-labelledby="mix-options" className={styles.section}>
      <h2 className={styles.heading} id="mix-options">
        Ways to balance
      </h2>
      <Choices label="Looking for" onChange={setPurpose} options={PURPOSES} value={purpose} />
      <ul className={styles.catalog}>
        {shown.map((option) => {
          const Icon = option.icon;
          return (
            <li key={option.id}>
              <button className={styles.optionTile} onClick={() => onOpen(option.id)} type="button">
                <span aria-hidden="true" className={styles.optionIcon}>
                  <Icon size={18} />
                </span>
                <span className={styles.optionBody}>
                  <strong>{option.name}</strong>
                  <span>{option.returns}</span>
                  <span className={styles.optionMeta}>
                    <span data-risk={option.risk}>{option.risk} risk</span> · {option.pays}
                  </span>
                </span>
                <ArrowRight aria-hidden="true" className={styles.optionArrow} size={16} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function OptionDetail({ id }: { id: OptionId }) {
  const option = OPTIONS[id];
  const facts: [string, string][] = [
    ['Returns', option.returns],
    ['Pays', option.pays],
    ['Risk', option.risk],
    ['Getting out', option.access],
    ['Minimum', option.minimum],
    ['Where', option.where],
    ['Good for', option.goodFor],
  ];
  return (
    <div className={styles.detail}>
      <p className={styles.detailWhat}>{option.what}</p>
      <dl className={styles.detailFacts}>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.watch}>
        <AlertTriangle aria-hidden="true" size={16} />
        <p>{option.watch}</p>
      </div>
      {option.link ? (
        <a
          className={ui.textLink}
          href={option.link.href}
          rel="noopener noreferrer"
          target="_blank"
        >
          {option.link.label} <ExternalLink aria-hidden="true" size={14} />
        </a>
      ) : null}
      <p className={ui.caption}>
        As quoted in {RATES_AS_OF}. Check current rates before investing.
      </p>
    </div>
  );
}
