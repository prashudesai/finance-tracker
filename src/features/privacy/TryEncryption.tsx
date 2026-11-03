import { Lock, Smartphone, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createDemoLock } from '../../data/crypto';
import { Field } from '../../ui/Field';
import ui from '../../ui/ui.module.css';
import styles from './TryEncryption.module.css';

const EXAMPLE = 'Salary ₹25,000';
type DemoLock = Awaited<ReturnType<typeof createDemoLock>>;

/**
 * Locks whatever someone types, for real, with a throwaway key, then opens it again the
 * way a family member's device would. Nothing typed here is saved or sent.
 */
export function TryEncryption() {
  const [text, setText] = useState(EXAMPLE);
  const [demo, setDemo] = useState<DemoLock | null>(null);
  const [shown, setShown] = useState({ locked: '', opened: '' });

  useEffect(() => {
    let current = true;
    void createDemoLock().then((made) => {
      if (current) setDemo(made);
    });
    return () => {
      current = false;
    };
  }, []);

  // Each change is locked afresh, so one new letter changes the whole line.
  useEffect(() => {
    if (!demo) return;
    let current = true;
    void demo.lock(text).then(async (sealed) => {
      const opened = await demo.open(sealed);
      if (current) setShown({ locked: sealed.c, opened });
    });
    return () => {
      current = false;
    };
  }, [demo, text]);

  return (
    <div className={styles.try}>
      <Field label="Type something private">
        <input maxLength={60} onChange={(event) => setText(event.target.value)} value={text} />
      </Field>
      <div className={styles.row}>
        <span className={styles.badge}>
          <Smartphone aria-hidden="true" size={16} />
        </span>
        <strong>On your phone</strong>
      </div>
      <p className={styles.plain}>{text || ' '}</p>
      <div className={styles.row}>
        <span className={styles.badge}>
          <Lock aria-hidden="true" size={16} />
        </span>
        <strong>What Google and the app&apos;s owner see</strong>
      </div>
      <p className={styles.locked} key={shown.locked}>
        <span className={ui.visuallyHidden}>Scrambled: </span>
        <span aria-hidden="true">{shown.locked || '…'}</span>
      </p>
      <p className={styles.note}>
        Real encryption, done just now on this device. Change one letter and it all changes.
      </p>
      <div className={styles.row}>
        <span className={styles.badge}>
          <Users aria-hidden="true" size={16} />
        </span>
        <strong>What your approved family sees</strong>
      </div>
      <p className={styles.plain}>{shown.opened || text || ' '}</p>
    </div>
  );
}
