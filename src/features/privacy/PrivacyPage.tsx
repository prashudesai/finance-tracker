import { ArrowLeft } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { PRIVACY_UPDATED } from '../../domain/privacy';
import styles from './PrivacyPage.module.css';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** Open to everyone, so people can read it before signing in. */
export function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy · Finance Tracker';
  }, []);

  return (
    <main className={styles.page}>
      <Link className={styles.back} to="/">
        <ArrowLeft size={16} /> Back to the app
      </Link>
      <h1>Your privacy</h1>
      <p className={styles.updated}>Last updated {PRIVACY_UPDATED}</p>
      <p className={styles.lead}>
        Your financial records are encrypted on your device before they are saved. Nobody else can
        read them, including the person who runs this app.
      </p>

      <Section title="What is stored, in unreadable form">
        <p>
          Income, expenses, loans, investments, balances, reminders and settings. Only you and the
          family members you approve can open them.
        </p>
      </Section>

      <Section title="What the app's admin can still see">
        <ul>
          <li>Email addresses and names from sign-in</li>
          <li>When you last signed in, and when you agreed to this page</li>
          <li>Who belongs to which household, and each person's role</li>
          <li>How many records are in each category, and when they changed</li>
          <li>A rough device name, such as "iPhone · Safari", while a new device is waiting</li>
        </ul>
      </Section>

      <Section title="Signing in">
        <p>
          You sign in with Google, so the app receives your name and email. It never sees your
          Google password.
        </p>
      </Section>

      <Section title="Your passphrase">
        <p>
          Your passphrase is never sent or stored in readable form, so it cannot be reset for you.
          If you lose both your passphrase and your recovery code, your records are gone for good.
        </p>
      </Section>

      <Section title="What stays on your device">
        <p>
          Your unlock key and your app preferences, such as your theme. Signing out removes the
          unlock key.
        </p>
      </Section>

      <Section title="Family sharing">
        <p>
          Approved family members can read all of the household's records. When someone is removed,
          the records are locked with a new key, but they may still have anything they saved or
          noted while they had access.
        </p>
      </Section>

      <Section title="Error reports">
        <p>
          If something breaks, the app sends a short technical report: what failed, on which screen,
          the app version and whether it was a phone or computer. It never includes your records,
          names, amounts or email. This is on by default, and you can turn it off in Settings.
        </p>
      </Section>

      <Section title="Where your data lives">
        <p>
          The app runs on Google Firebase, and the database is in Mumbai, India. Google handles
          technical details such as IP addresses to run the service, under its own terms.
        </p>
      </Section>

      <Section title="Analytics and advertising">
        <p>The app has no analytics, tracking or ads, and your data is never sold.</p>
      </Section>

      <Section title="Deleting your account">
        <p>
          You can delete your account in Settings. That removes your records, keys and sign-in. If
          you own a household, it deletes the whole household, including what family members added.
        </p>
        <p>Google may keep deleted data in its own systems for a limited time.</p>
      </Section>

      <Section title="The limit of this protection">
        <p>
          Encryption protects stored data, but you still have to trust the app you load. Whoever
          controls the app's code could, in theory, release a version that captures passphrases.
        </p>
      </Section>

      <Section title="Questions and changes">
        <p>
          If this page changes, the date at the top will change too. For questions, ask the person
          who shared this app with you.
        </p>
      </Section>
    </main>
  );
}
