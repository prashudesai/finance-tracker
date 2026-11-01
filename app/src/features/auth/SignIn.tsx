import { Lock, ShieldCheck } from 'lucide-react';
import logo from '../../assets/logo.png';
import styles from './SignIn.module.css';

function GoogleMark() {
  return (
    <svg aria-hidden="true" height="20" viewBox="0 0 48 48" width="20">
      <path
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.2-.1-2.4-.4-3.5z"
        fill="#FFC107"
      />
      <path
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
        fill="#FF3D00"
      />
      <path
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
        fill="#4CAF50"
      />
      <path
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.4-.4-3.5z"
        fill="#1976D2"
      />
    </svg>
  );
}

export function SignIn({ onSignIn, error }: { onSignIn: () => void; error?: string | undefined }) {
  return (
    <main className={styles.screen}>
      <div className={styles.layout}>
        <div className={styles.brand}>
          <img alt="" className={styles.logo} height="96" src={logo} width="96" />
          <h1>Personal Finance Tracker</h1>
          <p>A clearer view of your family’s financial future.</p>
        </div>
        <div className={styles.card}>
          <h2>Welcome back</h2>
          <p className={styles.subtitle}>Sign in to manage your family finances</p>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <button className={styles.google} onClick={onSignIn} type="button">
            <GoogleMark /> Continue with Google
          </button>
          <p className={styles.private}>
            <ShieldCheck size={16} /> Your tracker is private to your family
          </p>
        </div>
      </div>
      <p className={styles.footer}>
        <Lock size={14} /> Secure sign-in · Your records sync across devices
      </p>
    </main>
  );
}
