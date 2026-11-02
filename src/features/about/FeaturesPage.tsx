import {
  CalendarRange,
  HandCoins,
  LayoutList,
  Sparkles,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router';
import logo from '../../assets/logo.png';
import styles from './FeaturesPage.module.css';

const GROUPS: { title: string; icon: LucideIcon; items: string[] }[] = [
  {
    title: 'Track everything',
    icon: LayoutList,
    items: [
      'Income and expenses, with recurring payments',
      'Monthly balances and a month-end review',
      'Investments, PMS, PF, PPF, NPS and gratuity',
      'Automatic monthly contributions to your investments',
      'PF interest credits and EPS history',
      'Your net worth over time, with a trend line on the Dashboard',
    ],
  },
  {
    title: 'Manage loans',
    icon: HandCoins,
    items: [
      'EMI tracking for all your loans',
      'Part payments, rate changes, top-ups and revised EMIs',
      'Daily loan statements',
    ],
  },
  {
    title: 'Plan ahead',
    icon: CalendarRange,
    items: [
      'Growth projections and goal planning',
      'Planned changes to see their effect on your future',
      'Date range reports, exported as PDF or CSV',
      "EMI reminders on your phone's calendar",
      'A Needs attention list, so nothing gets missed',
    ],
  },
  {
    title: 'Share with family',
    icon: Users,
    items: [
      'Invite family with their Google account',
      'Choose who can edit and who can only view',
      "See everyone's finances together, or one person at a time",
      "Add people by name only, like kids or parents who don't need a login",
      'See who changed what, and undo mistakes',
    ],
  },
  {
    title: 'Private by design',
    icon: ShieldCheck,
    items: [
      'Your records are encrypted on your device, so nobody else can read them',
      'Unlock with Face ID, fingerprint or a passphrase',
      'New devices need your approval or your passphrase',
      'No ads, no tracking, and your data is never sold',
      'Delete your account and data anytime',
    ],
  },
  {
    title: 'Easy to use',
    icon: Sparkles,
    items: [
      'Free, and installs on your phone or computer like an app',
      'Works on phone and desktop',
      'Opens without internet once installed',
      "Stays unlocked on your saved devices, so there's no passphrase each visit",
      'Search across all your records',
      'Add your own income sources and expense categories',
      'Guided setup and an app tour',
      'Encrypted backup and restore',
      '8 colour themes, each in light and dark',
    ],
  },
];

/** Open to everyone, so the link can be shared with people who haven't signed up. */
export function FeaturesPage() {
  useEffect(() => {
    document.title = 'Features · Finance Tracker';
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <img alt="" className={styles.logo} height="80" src={logo} width="80" />
        <h1>Personal Finance Tracker</h1>
        <p>All your family's money in one private app.</p>
        <Link className={styles.open} to="/">
          Open the app
        </Link>
      </header>
      <div className={styles.grid}>
        {GROUPS.map(({ title, icon: Icon, items }) => (
          <section className={styles.card} key={title}>
            <h2>
              <span aria-hidden="true" className={styles.icon}>
                <Icon size={18} />
              </span>
              {title}
            </h2>
            <ul>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className={styles.note}>
        <strong>Good to know:</strong> sign in with Google to start. Save your passphrase and
        recovery code safely. If you lose both, your data can't be recovered.
      </p>
      <p className={styles.footer}>
        <Link to="/privacy">Read how your data is handled</Link>
      </p>
    </main>
  );
}
