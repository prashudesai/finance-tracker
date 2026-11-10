import {
  Banknote,
  Building2,
  Coins,
  Gem,
  Landmark,
  LineChart,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * Ways to rebalance a mix, described plainly: what each pays, how risky it is and how easy to
 * get out of. Figures are as quoted publicly in November 2026, change often, and are a guide
 * only; each option says to check before investing.
 */
export const RATES_AS_OF = 'November 2026';

export type OptionPurpose = 'income' | 'steady' | 'gold' | 'growth' | 'emergency';

export type OptionId =
  | 'listedBonds'
  | 'govtBonds'
  | 'debtFunds'
  | 'deposits'
  | 'pomis'
  | 'scss'
  | 'reits'
  | 'goldEtf'
  | 'sgb'
  | 'aif'
  | 'invoice'
  | 'indexFunds'
  | 'liquidFunds';

export interface InvestmentOption {
  id: OptionId;
  name: string;
  icon: LucideIcon;
  purposes: OptionPurpose[];
  /** One line: what it is. */
  what: string;
  returns: string;
  pays: string;
  risk: 'Low' | 'Low to medium' | 'Medium' | 'Medium to high' | 'High';
  access: string;
  minimum: string;
  where: string;
  goodFor: string;
  watch: string;
  link?: { label: string; href: string };
}

export const OPTIONS: Record<OptionId, InvestmentOption> = {
  listedBonds: {
    id: 'listedBonds',
    name: 'Listed corporate bonds',
    icon: ReceiptText,
    purposes: ['income', 'steady'],
    what: 'Lend to a company for a fixed term and get a fixed coupon, often every month.',
    returns: 'About 9–12% a year before tax on platforms such as Wint Wealth',
    pays: 'Monthly or quarterly interest on many issues, with principal back at maturity',
    risk: 'Medium to high',
    access: 'Can be sold on the exchange, but few buyers; plan to hold to maturity',
    minimum: '₹1,000 to ₹10,000 a bond on most platforms',
    where:
      'SEBI-registered online bond platforms: Wint Wealth, Grip Invest, IndiaBonds, or a broker',
    goodFor: 'Steady monthly income above FD rates, for money you can lock away for 1–5 years',
    watch:
      'Higher yields mean lower-rated borrowers. Prefer secured bonds rated A or better, spread across five or more issuers, and remember interest is taxed at your slab.',
    link: { label: 'wintwealth.com', href: 'https://www.wintwealth.com/' },
  },
  govtBonds: {
    id: 'govtBonds',
    name: 'Government bonds and RBI bonds',
    icon: Landmark,
    purposes: ['steady', 'income'],
    what: 'Lend to the Government of India: the safest borrower in rupees.',
    returns:
      'About 6.5–7.5% on government securities; RBI Floating Rate Savings Bonds pay 8.05% now',
    pays: 'Interest every six months',
    risk: 'Low',
    access: 'Government securities trade any day; RBI floating rate bonds lock in for 7 years',
    minimum: '₹1,000 for RBI floating rate bonds; ₹10,000 for government securities',
    where: 'RBI Retail Direct (rbiretaildirect.org.in), your bank, or a broker',
    goodFor: 'The steady part of a mix, with no risk of the borrower failing',
    watch: 'Prices of traded bonds move with interest rates if you sell early. Interest is taxed.',
  },
  debtFunds: {
    id: 'debtFunds',
    name: 'Debt mutual funds',
    icon: ShieldCheck,
    purposes: ['steady', 'income'],
    what: 'A fund that holds many bonds, so no single borrower matters much.',
    returns: 'About 6.5–8% a year, depending on the kind of fund',
    pays: 'Nothing on its own; set up a monthly withdrawal (SWP) for income',
    risk: 'Low to medium',
    access: 'Money back in one to three working days',
    minimum: '₹500 to ₹1,000',
    where: 'Any fund house, or apps such as Kuvera, Groww or Zerodha Coin',
    goodFor: 'Spreading steady money across many bonds without picking them',
    watch:
      'Gains are taxed at your slab rate. Stick to short duration, corporate bond or banking and PSU funds for steadiness.',
  },
  deposits: {
    id: 'deposits',
    name: 'Fixed deposits',
    icon: Banknote,
    purposes: ['steady', 'income', 'emergency'],
    what: 'A bank deposit at a fixed rate for a fixed time.',
    returns: 'About 6–7% at large banks, up to about 8% at small finance banks',
    pays: 'Monthly or quarterly payout if you choose it, or added at maturity',
    risk: 'Low',
    access: 'Break early at a small penalty',
    minimum: 'Usually ₹1,000 to ₹10,000',
    where: 'Your bank',
    goodFor: 'Money needed in 1–3 years, and the safest steady income',
    watch:
      'Deposit insurance covers ₹5 lakh per person per bank, so spread larger amounts across banks. Interest is taxed at your slab.',
  },
  pomis: {
    id: 'pomis',
    name: 'Post Office Monthly Income Scheme',
    icon: Wallet,
    purposes: ['income', 'steady'],
    what: 'A government-backed deposit that pays interest every month for five years.',
    returns: '7.4% a year',
    pays: 'Every month',
    risk: 'Low',
    access: 'Locked for one year; closing before five years costs 1–2%',
    minimum: '₹1,000, up to ₹9 lakh alone or ₹15 lakh jointly',
    where: 'Any post office, or India Post internet banking',
    goodFor: 'Safe, predictable monthly income for the household',
    watch: 'Interest is taxed and the rate is reset each quarter for new accounts.',
  },
  scss: {
    id: 'scss',
    name: 'Senior Citizens’ Savings Scheme',
    icon: Landmark,
    purposes: ['income', 'steady'],
    what: 'A government-backed scheme for those 60 or older, paying interest every quarter.',
    returns: '8.2% a year',
    pays: 'Every quarter',
    risk: 'Low',
    access: 'Five years, extendable by three; closing early costs 1–1.5%',
    minimum: '₹1,000, up to ₹30 lakh per person',
    where: 'Post offices and most banks',
    goodFor: 'The safest high income once retired',
    watch:
      'Open at 60, or 55 for those retiring early on a voluntary scheme. Interest is taxed, though up to ₹1.5 lakh invested can be claimed under section 80C.',
  },
  reits: {
    id: 'reits',
    name: 'REITs and InvITs',
    icon: Building2,
    purposes: ['income', 'growth'],
    what: 'Own a slice of office parks, malls, roads or power lines, listed on the exchange.',
    returns: 'Payouts of about 6–8% a year, plus or minus price changes',
    pays: 'Every quarter; most of what they earn must be paid out',
    risk: 'Medium',
    access: 'Sell any trading day',
    minimum: 'One unit, from a few hundred rupees',
    where: 'Any broker, as with shares',
    goodFor: 'Rental-style income and some real estate in the mix, without buying property',
    watch:
      'Prices can fall like shares. Payouts mix interest, dividends and capital repaid, each taxed differently.',
  },
  goldEtf: {
    id: 'goldEtf',
    name: 'Gold ETFs and gold funds',
    icon: Gem,
    purposes: ['gold'],
    what: 'Follow the price of gold without buying, storing or insuring it.',
    returns: 'Follows gold, less about 0.3–0.8% a year in costs',
    pays: 'Nothing; the return is the price of gold',
    risk: 'Medium',
    access: 'ETFs sell any trading day; gold funds in two or three days',
    minimum: 'One ETF unit, or ₹100–₹500 a month in a gold fund',
    where: 'Any broker for ETFs; fund apps for gold funds',
    goodFor: 'A cushion that often rises when shares and the rupee fall',
    watch:
      'Gold can go years without gaining. Gains held over a year (two for gold funds) are taxed at 12.5%. Keep it to about 5–15% of the mix.',
  },
  sgb: {
    id: 'sgb',
    name: 'Sovereign Gold Bonds, bought on the exchange',
    icon: Coins,
    purposes: ['gold', 'income'],
    what: 'Government bonds priced in gold, paying a little interest on top.',
    returns: 'Follows gold, plus 2.5% a year on what was first paid',
    pays: 'Interest every six months',
    risk: 'Medium',
    access: 'Trade on the exchange, often below the gold price; mature after eight years',
    minimum: 'One gram',
    where: 'Any broker; no new issues are being sold, so only existing ones are available',
    goodFor: 'Gold held to maturity, where the gain is tax-free',
    watch: 'Few trades happen, so check the price against gold before buying.',
  },
  aif: {
    id: 'aif',
    name: 'Alternative investment funds (AIFs)',
    icon: Sparkles,
    purposes: ['income', 'growth'],
    what: 'Pooled funds for private credit, real estate or private companies.',
    returns: 'Private credit funds aim for about 11–14%; nothing is fixed',
    pays: 'As loans are repaid or assets are sold, often quarterly',
    risk: 'High',
    access: 'Locked in for three to seven years',
    minimum: '₹1 crore by SEBI rules',
    where: 'Wealth managers and fund houses with an AIF licence',
    goodFor: 'Large portfolios that already have the basics covered',
    watch: 'Hard to exit, fees are high, and SEBI keeps it to investors with ₹1 crore to commit.',
  },
  invoice: {
    id: 'invoice',
    name: 'Invoice discounting and lease financing',
    icon: ReceiptText,
    purposes: ['income'],
    what: 'Fund a business’s unpaid invoices or equipment lease, and get repaid with interest.',
    returns: 'Platforms quote about 10–13% a year',
    pays: 'Monthly, or in full when the invoice is paid',
    risk: 'High',
    access: 'Locked until repaid, from a few months to three years',
    minimum: 'Usually ₹10,000 to ₹50,000',
    where: 'Fintech platforms; check whether the deal is SEBI-regulated before investing',
    goodFor: 'A small slice of high monthly income, for money you can afford to lose',
    watch:
      'Many such deals sit outside SEBI regulation, and a business failing to pay means losing that money. Keep it small.',
  },
  indexFunds: {
    id: 'indexFunds',
    name: 'Index funds',
    icon: LineChart,
    purposes: ['growth'],
    what: 'Own the whole market, such as the Nifty 50, at very low cost.',
    returns: 'The Nifty 50 has grown about 11–13% a year over long periods, with big swings',
    pays: 'Nothing; the return is growth',
    risk: 'High',
    access: 'Money back in two or three working days',
    minimum: '₹100 to ₹500 a month',
    where: 'Any fund house, or fund apps',
    goodFor: 'Growth over seven years or more, beating inflation',
    watch: 'Can fall 30% or more in a bad year. Only for money not needed for several years.',
  },
  liquidFunds: {
    id: 'liquidFunds',
    name: 'Liquid funds and sweep-in deposits',
    icon: Wallet,
    purposes: ['emergency'],
    what: 'Earn more than a savings account on money that must stay ready.',
    returns: 'About 6–7% a year',
    pays: 'Added to the value',
    risk: 'Low',
    access: 'Liquid funds: next working day, with up to ₹50,000 instantly. Sweep-ins: at once',
    minimum: '₹500 to ₹1,000',
    where: 'Fund apps for liquid funds; your bank for sweep-in deposits',
    goodFor: 'The emergency fund',
    watch: 'Gains are taxed at your slab rate.',
  },
};

export const PURPOSES: { value: OptionPurpose; label: string }[] = [
  { value: 'income', label: 'Monthly income' },
  { value: 'steady', label: 'Steady' },
  { value: 'gold', label: 'Gold' },
  { value: 'growth', label: 'Growth' },
  { value: 'emergency', label: 'Emergency fund' },
];
