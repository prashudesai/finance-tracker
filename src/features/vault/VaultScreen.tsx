import { Check, Fingerprint, KeyRound, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { MIN_PASSPHRASE_LENGTH } from '../../data/crypto';
import { plainError } from '../../data/errors';
import type { DeviceAsk, VaultAccess, VaultGate } from '../../data/vault';
import { Field } from '../../ui/Field';
import ui from '../../ui/ui.module.css';

const START_OVER_PHRASE = 'DELETE MY DATA';

function Screen({
  title,
  text,
  children,
  onSignOut,
}: {
  title: string;
  text: string;
  children: ReactNode;
  onSignOut: () => void;
}) {
  return (
    <main className={ui.vaultScreen}>
      <section className={ui.card}>
        <span aria-hidden="true" className={ui.tileIcon}>
          <ShieldCheck size={22} />
        </span>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem' }}>{title}</h1>
          <p className={ui.caption}>{text}</p>
        </div>
        {children}
        <button className={ui.textButton} onClick={onSignOut} type="button">
          Sign out
        </button>
      </section>
    </main>
  );
}

/** Runs a slow key operation, showing what's happening and any failure in plain words. */
function useTask() {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const run = async (task: () => Promise<void>) => {
    setWorking(true);
    setError('');
    try {
      await task();
    } catch (failure) {
      setError(plainError(failure, 'That did not work. Please try again.'));
    } finally {
      setWorking(false);
    }
  };
  return { working, error, run };
}

function Failure({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className={ui.fieldError} role="alert">
      {message}
    </p>
  );
}

export function PassphraseFields({
  value,
  onChange,
  label = 'Passphrase',
}: {
  value: { passphrase: string; repeat: string };
  onChange: (next: { passphrase: string; repeat: string }) => void;
  label?: string;
}) {
  const short = value.passphrase !== '' && value.passphrase.length < MIN_PASSPHRASE_LENGTH;
  const different = value.repeat !== '' && value.repeat !== value.passphrase;
  return (
    <>
      <Field
        error={short ? `Use at least ${MIN_PASSPHRASE_LENGTH} characters.` : undefined}
        label={label}
      >
        <input
          autoComplete="new-password"
          onChange={(event) => onChange({ ...value, passphrase: event.target.value })}
          type="password"
          value={value.passphrase}
        />
      </Field>
      <Field
        error={different ? 'These do not match.' : undefined}
        label={`Repeat ${label.toLowerCase()}`}
      >
        <input
          autoComplete="new-password"
          onChange={(event) => onChange({ ...value, repeat: event.target.value })}
          type="password"
          value={value.repeat}
        />
      </Field>
    </>
  );
}

export const validPassphrase = ({ passphrase, repeat }: { passphrase: string; repeat: string }) =>
  passphrase.length >= MIN_PASSPHRASE_LENGTH && passphrase === repeat;

type CopyResult = 'copied' | 'failed' | null;

/** The clipboard can be refused, so this falls back to copying the selected text. */
function copyText(text: string, element: HTMLElement | null) {
  const select = () => {
    if (!element) return false;
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return document.execCommand?.('copy') === true;
  };
  const clipboard = navigator.clipboard?.writeText(text);
  return clipboard ? clipboard.then(() => true, select) : Promise.resolve(select());
}

export function RecoveryCode({ code }: { code: string }) {
  const [result, setResult] = useState<CopyResult>(null);
  const text = useRef<HTMLParagraphElement>(null);
  return (
    <div className={ui.notice}>
      <div className={ui.label}>Your recovery code</div>
      <p className={ui.recoveryCode} ref={text}>
        {code}
      </p>
      <button
        className={ui.quiet}
        onClick={() => {
          void copyText(code, text.current).then((done) => setResult(done ? 'copied' : 'failed'));
        }}
        type="button"
      >
        {result === 'copied' ? <Check size={16} /> : null}
        {result === 'copied' ? 'Copied' : 'Copy code'}
      </button>
      {result === 'failed' ? (
        <p className={ui.caption} role="alert">
          This browser blocked copying. The code is selected, so copy it by hand, or write it down.
        </p>
      ) : null}
    </div>
  );
}

function CreatePassphrase({
  gate,
  onAccess,
  onSignOut,
}: {
  gate: VaultGate;
  onAccess: (access: VaultAccess) => void;
  onSignOut: () => void;
}) {
  const [value, setValue] = useState({ passphrase: '', repeat: '' });
  const [created, setCreated] = useState<Awaited<ReturnType<VaultGate['create']>> | null>(null);
  const [saved, setSaved] = useState(false);
  const [offering, setOffering] = useState(false);
  const { working, error, run } = useTask();

  if (created && offering) {
    return (
      <Screen
        onSignOut={onSignOut}
        text="Open your records with your face or fingerprint on this device, instead of staying unlocked. Your passphrase and recovery code still work."
        title="Use Face ID or fingerprint?"
      >
        <Failure message={error} />
        <button
          className={ui.button}
          disabled={working}
          onClick={() =>
            void run(async () => {
              await created.enablePasskey();
              onAccess(await created.enter());
            })
          }
          type="button"
        >
          <Fingerprint size={16} /> {working ? 'Setting up…' : 'Turn on'}
        </button>
        <button
          className={ui.quiet}
          disabled={working}
          onClick={() => void run(async () => onAccess(await created.enter()))}
          type="button"
        >
          Not now
        </button>
      </Screen>
    );
  }

  if (created) {
    return (
      <Screen
        onSignOut={onSignOut}
        text="If you forget your passphrase, this code is the only way back in. Keep it somewhere safe, away from this device."
        title="Save your recovery code"
      >
        <RecoveryCode code={created.recoveryCode} />
        <label className={ui.check}>
          <input
            checked={saved}
            onChange={(event) => setSaved(event.target.checked)}
            type="checkbox"
          />
          I've saved my recovery code
        </label>
        <Failure message={error} />
        <button
          className={ui.button}
          disabled={!saved || working}
          onClick={() => {
            if (created.passkeyAvailable) setOffering(true);
            else void run(async () => onAccess(await created.enter()));
          }}
          type="button"
        >
          {working ? 'Opening…' : 'Continue'}
        </button>
      </Screen>
    );
  }

  return (
    <Screen
      onSignOut={onSignOut}
      text="Your records are encrypted on this device. Nobody else can read them, including the people who run this app. That also means your passphrase can't be reset for you."
      title="Create your passphrase"
    >
      <form
        className={ui.form}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (validPassphrase(value)) {
            void run(async () => setCreated(await gate.create(value.passphrase)));
          }
        }}
      >
        <PassphraseFields onChange={setValue} value={value} />
        <Failure message={error} />
        <div className={ui.formActions}>
          <button className={ui.button} disabled={!validPassphrase(value) || working} type="submit">
            {working ? 'Creating your keys…' : 'Create passphrase'}
          </button>
        </div>
      </form>
    </Screen>
  );
}

function Unlock({
  gate,
  onAccess,
  onSignOut,
  onStartOver,
}: {
  gate: VaultGate;
  onAccess: (access: VaultAccess) => void;
  onSignOut: () => void;
  onStartOver: () => void;
}) {
  const [passphrase, setPassphrase] = useState('');
  const [code, setCode] = useState('');
  const [fresh, setFresh] = useState({ passphrase: '', repeat: '' });
  const [phrase, setPhrase] = useState('');
  const { working, error, run } = useTask();
  const prompted = useRef(false);
  const [ask, setAsk] = useState<Exclude<DeviceAsk, { status: 'approved' }> | null>(null);

  useEffect(() => {
    if (!gate.newDevice) return;
    return gate.askSavedDevice((next) => {
      if (next.status === 'approved') onAccess(next.access);
      else setAsk(next);
    });
  }, [gate, onAccess]);

  // Some browsers refuse this without a tap, and people can cancel. Either way the button stays.
  useEffect(() => {
    if (!gate.autoPasskey || prompted.current) return;
    prompted.current = true;
    gate.unlockWithPasskey().then(onAccess, () => undefined);
  }, [gate, onAccess]);

  return (
    <Screen
      onSignOut={onSignOut}
      text={
        gate.canUsePasskey
          ? 'Use Face ID or your fingerprint, or enter your passphrase.'
          : 'Enter your passphrase to open your records on this device.'
      }
      title="Unlock your tracker"
    >
      {ask?.status === 'waiting' ? (
        <div className={ui.notice} role="status">
          <div className={ui.label}>Waiting for your saved device</div>
          <p className={ui.caption}>
            If you're signed in on another device, approve this there and check it shows this code.
            Or unlock below.
          </p>
          <p className={ui.recoveryCode}>{ask.code}</p>
        </div>
      ) : null}
      {ask?.status === 'denied' ? (
        <p className={ui.fieldError} role="alert">
          Your saved device did not approve this. You can still unlock below.
        </p>
      ) : null}
      {gate.canUsePasskey ? (
        <button
          className={ui.button}
          disabled={working}
          onClick={() => void run(async () => onAccess(await gate.unlockWithPasskey()))}
          type="button"
        >
          <Fingerprint size={16} /> Unlock with Face ID or fingerprint
        </button>
      ) : null}
      <form
        className={ui.form}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void run(async () => onAccess(await gate.unlock(passphrase)));
        }}
      >
        <Field label="Passphrase">
          <input
            autoComplete="current-password"
            autoFocus
            onChange={(event) => setPassphrase(event.target.value)}
            type="password"
            value={passphrase}
          />
        </Field>
        <Failure message={error} />
        <div className={ui.formActions}>
          <button className={ui.button} disabled={!passphrase || working} type="submit">
            <KeyRound size={16} /> {working ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </form>
      <details className={ui.fold}>
        <summary>Forgot your passphrase?</summary>
        <form
          className={ui.form}
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(async () => onAccess(await gate.recover(code, fresh.passphrase)));
          }}
        >
          <Field label="Recovery code">
            <input onChange={(event) => setCode(event.target.value)} value={code} />
          </Field>
          <PassphraseFields label="New passphrase" onChange={setFresh} value={fresh} />
          <div className={ui.formActions}>
            <button
              className={ui.quiet}
              disabled={!code || !validPassphrase(fresh) || working}
              type="submit"
            >
              Set new passphrase
            </button>
          </div>
        </form>
      </details>
      <details className={ui.fold}>
        <summary>Lost your recovery code too?</summary>
        <p className={ui.caption}>
          Your records can't be opened without one of them, and nobody can recover them for you. You
          can permanently delete them and start again. Type {START_OVER_PHRASE} to confirm.
        </p>
        <input
          aria-label={`Type ${START_OVER_PHRASE} to confirm`}
          className={ui.fieldSelect}
          onChange={(event) => setPhrase(event.target.value)}
          value={phrase}
        />
        <button
          className={ui.quiet}
          disabled={phrase !== START_OVER_PHRASE || working}
          onClick={() =>
            void run(async () => {
              await gate.startOver();
              onStartOver();
            })
          }
          type="button"
        >
          Delete and start again
        </button>
      </details>
    </Screen>
  );
}

export function VaultScreen({
  gate,
  onAccess,
  onSignOut,
  onStartOver,
}: {
  gate: VaultGate;
  onAccess: (access: VaultAccess) => void;
  onSignOut: () => void;
  onStartOver: () => void;
}) {
  return gate.hasKeyring ? (
    <Unlock gate={gate} onAccess={onAccess} onSignOut={onSignOut} onStartOver={onStartOver} />
  ) : (
    <CreatePassphrase gate={gate} onAccess={onAccess} onSignOut={onSignOut} />
  );
}

export function WaitingForApproval({
  access,
  onAccess,
  onSignOut,
}: {
  access: Extract<VaultAccess, { status: 'waiting' }>;
  onAccess: (access: VaultAccess) => void;
  onSignOut: () => void;
}) {
  const { working, error, run } = useTask();
  const [note, setNote] = useState('');
  return (
    <Screen
      onSignOut={onSignOut}
      text="The tracker's owner has been asked to approve you. For extra safety, they may check this code with you."
      title="Waiting for approval"
    >
      <div className={ui.notice}>
        <div className={ui.label}>Your safety code</div>
        <p className={ui.recoveryCode}>{access.code}</p>
      </div>
      <Failure message={error} />
      {note ? (
        <p className={ui.caption} role="status">
          {note}
        </p>
      ) : null}
      <button
        className={ui.button}
        disabled={working}
        onClick={() =>
          void run(async () => {
            const next = await access.retry();
            if (next.status === 'waiting') setNote('Not approved yet.');
            else onAccess(next);
          })
        }
        type="button"
      >
        {working ? 'Checking…' : 'Check again'}
      </button>
    </Screen>
  );
}
