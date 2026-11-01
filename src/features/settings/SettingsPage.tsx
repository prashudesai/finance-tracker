import {
  ChevronRight,
  DatabaseBackup,
  Info,
  Palette,
  RefreshCw,
  Smartphone,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import release from '../../release.json';
import { syncedRecently } from '../../domain/analytics';
import { createBackup, parseBackup, restoreWrites } from '../../domain/backup';
import { undoWrites } from '../../domain/changes';
import { TRACKER_SETTINGS_ID, type ChangeRecord, type TrackerSettings } from '../../schema/records';
import { useSaveSettings, useSettings, useTracker } from '../../store/tracker';
import type { Account, AccountSecurity, FamilyMember, FamilyRequest } from '../../Shell';
import { downloadText } from '../../ui/download';
import { downloadTablePdf } from '../../ui/pdf';
import { Field } from '../../ui/Field';
import { localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import {
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
  MIN_PASSPHRASE_LENGTH,
} from '../../data/crypto';
import { PassphraseFields, RecoveryCode, validPassphrase } from '../vault/VaultScreen';
import { Avatar } from '../../ui/Avatar';
import { resizePhoto } from '../../ui/photo';
import { checkForUpdates, useAppUpdate, useInstallApp, type UpdateCheck } from '../../ui/pwa';
import { useTheme } from '../../ui/theme';
import { THEME_CHOICES } from '../../ui/themes';
import ui from '../../ui/ui.module.css';

type Panel =
  'info' | 'account' | 'family' | 'appearance' | 'archived' | 'changes' | 'data' | 'updates';

const VERSION = release.version;

const TILES: { panel: Panel; icon: LucideIcon; title: string; text: string }[] = [
  { panel: 'info', icon: Info, title: 'App info', text: 'Features, calculations and PDF guide' },
  {
    panel: 'account',
    icon: User,
    title: 'Account',
    text: 'Profile details, security and account deletion',
  },
  {
    panel: 'family',
    icon: Users,
    title: 'Family access',
    text: 'Invite members and manage permissions',
  },
  {
    panel: 'appearance',
    icon: Palette,
    title: 'Appearance',
    text: 'Choose colors and display preferences',
  },
  {
    panel: 'data',
    icon: DatabaseBackup,
    title: 'Data & backup',
    text: 'Export, import and recovery tools',
  },
  {
    panel: 'updates',
    icon: Smartphone,
    title: 'App & updates',
    text: `Version ${VERSION} · Updates and release notes`,
  },
];

function FamilyNames() {
  const settings = useSettings();
  const save = useSaveSettings();
  const canEdit = useTracker((state) => state.canEdit);
  const [name, setName] = useState('');
  const value = name.trim();
  const members = settings.familyMembers;
  const exists = members.some((item) => item.toLowerCase() === value.toLowerCase());

  return (
    <div>
      <p className={ui.caption}>Names used in your records.</p>
      {members.length === 0 ? null : (
        <ul className={ui.list}>
          {members.map((item) => (
            <li className={ui.row} key={item}>
              <div className={ui.rowMain}>{item}</div>
              {canEdit ? (
                <button
                  aria-label={`Remove ${item}`}
                  className={ui.quiet}
                  onClick={() => save({ familyMembers: members.filter((row) => row !== item) })}
                  type="button"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <form
          className={ui.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (!value || exists) return;
            save({ familyMembers: [...members, value] });
            setName('');
          }}
        >
          <Field label="Add a name">
            <input maxLength={60} onChange={(event) => setName(event.target.value)} value={name} />
          </Field>
          <div className={ui.formActions}>
            <button className={ui.button} disabled={!value || exists} type="submit">
              + Add
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function DataBackup() {
  const settings = useSettings();
  const save = useSaveSettings();
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const syncedAt = useTracker((state) => state.syncedAt);
  const synced = syncedRecently(syncedAt ? localDate(syncedAt) : null, localDate());
  const [status, setStatus] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const strong = passphrase.length >= MIN_PASSPHRASE_LENGTH;

  const restore = async (selected: File) => {
    try {
      const text = await selected.text();
      if (isEncryptedBackup(text) && !passphrase) {
        setStatus("Enter this backup's passphrase first, then choose the file again.");
        return;
      }
      const backup = parseBackup(
        isEncryptedBackup(text) ? await decryptBackup(text, passphrase) : text,
      );
      const count = Object.values(backup).reduce((sum, rows) => sum + rows.length, 0);
      if (!window.confirm(`Replace all current records with ${count} records from this backup?`)) {
        return;
      }
      commit(restoreWrites(data, backup));
      setStatus(`Restored ${count} records.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'This backup could not be read.');
    }
  };

  return (
    <div className={ui.page}>
      <div className={ui.metric}>
        <strong>Backup passphrase</strong>
        <p className={ui.caption}>
          Backups are encrypted with this passphrase. It can be different from your sign-in
          passphrase. A backup can't be opened without it, and it can't be reset.
        </p>
        <Field label="Backup passphrase">
          <input
            autoComplete="off"
            onChange={(event) => setPassphrase(event.target.value)}
            type="password"
            value={passphrase}
          />
        </Field>
      </div>
      <div className={ui.metric}>
        <strong>Export backup</strong>
        <p className={ui.caption}>
          Download all tracker records as one encrypted file. Use at least {MIN_PASSPHRASE_LENGTH}{' '}
          characters.
        </p>
        <button
          className={ui.button}
          disabled={!strong}
          onClick={() => {
            encryptBackup(createBackup(data, new Date().toISOString()), passphrase).then(
              (file) => {
                downloadText(`finance-backup-${localDate()}.json`, file, 'application/json');
                save({ lastBackupOn: localDate() });
              },
              (error: unknown) => setStatus(failureText(error)),
            );
          }}
          type="button"
        >
          Export backup
        </button>
      </div>
      {synced ? null : (
        <div className={ui.metric}>
          <strong>Backup care</strong>
          <p className={ui.caption}>
            {settings.lastBackupOn ? `Last backup ${settings.lastBackupOn}.` : 'No backup yet.'}
          </p>
          <label className={ui.caption}>
            Remind me{' '}
            <select
              className={ui.fieldSelect}
              onChange={(event) => save({ backupReminderDays: Number(event.target.value) })}
              value={settings.backupReminderDays}
            >
              <option value="7">Every 7 days</option>
              <option value="30">Every 30 days</option>
              <option value="0">Off</option>
            </select>
          </label>
        </div>
      )}
      <div className={ui.metric}>
        <strong>Import backup</strong>
        <p className={ui.caption}>
          Replaces every current record. A file with any invalid record is rejected.
        </p>
        <input
          accept="application/json"
          aria-label="Backup file"
          hidden
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) void restore(selected);
            event.target.value = '';
          }}
          ref={file}
          type="file"
        />
        <button className={ui.quiet} onClick={() => file.current?.click()} type="button">
          Choose backup file
        </button>
      </div>
      <details className={ui.fold}>
        <summary>Change log</summary>
        <ChangeLog />
      </details>
      {status ? (
        <p className={ui.notice} role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}

function FamilyMembers({ account }: { account: Account }) {
  const { family } = account;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FamilyMember['role']>('viewer');
  const [status, setStatus] = useState('');
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [requests, setRequests] = useState<FamilyRequest[]>([]);

  const refresh = useCallback(() => {
    family?.list().then(setMembers, (error: unknown) => setStatus(failureText(error)));
    family?.requests().then(setRequests, (error: unknown) => setStatus(failureText(error)));
  }, [family]);
  useEffect(refresh, [refresh]);

  const run = (action: Promise<void>, done: string) =>
    action.then(
      () => {
        setStatus(done);
        refresh();
      },
      (error: unknown) => setStatus(failureText(error)),
    );

  return (
    <div className={ui.page}>
      {family ? (
        <>
          {requests.length > 0 ? (
            <div>
              <div className={ui.groupLabel}>Waiting for approval</div>
              <p className={ui.caption}>
                Ask them to read out the code on their screen, by phone or in person. Approve only
                if it matches exactly.
              </p>
              <ul className={ui.list}>
                {requests.map((request) => (
                  <li className={ui.row} key={request.uid}>
                    <div className={ui.rowMain}>
                      <div className={ui.rowTitle}>{request.email}</div>
                      <div className={ui.rowDetail}>Code {request.code}</div>
                    </div>
                    <button
                      aria-label={`Approve ${request.email}`}
                      className={ui.button}
                      onClick={() =>
                        void run(family.approve(request), `Approved ${request.email}.`)
                      }
                      type="button"
                    >
                      Approve
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <form
            className={ui.form}
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                family.invite(email, role),
                `Invited ${email}. They accept when they next sign in.`,
              ).then(() => setEmail(''));
            }}
          >
            <Field label="Google email">
              <input
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </Field>
            <Field label="Access">
              <select
                onChange={(event) => setRole(event.target.value as FamilyMember['role'])}
                value={role}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            </Field>
            <div className={ui.formActions}>
              <button className={ui.button} type="submit">
                Send invite
              </button>
            </div>
          </form>
          <div>
            <div className={ui.groupLabel}>Members</div>
            {members.length === 0 ? (
              <p className={ui.empty}>No one else has access.</p>
            ) : (
              <ul className={ui.list}>
                {members.map((member) => (
                  <li className={ui.row} key={member.email}>
                    <div className={ui.rowMain}>
                      <div className={ui.rowTitle}>{member.email}</div>
                      <div className={ui.rowDetail}>
                        {member.accepted ? 'Active' : 'Invite pending'}
                      </div>
                    </div>
                    <select
                      aria-label={`Access for ${member.email}`}
                      className={ui.fieldSelect}
                      onChange={(event) =>
                        void run(
                          family.setRole(member.email, event.target.value as FamilyMember['role']),
                          `Updated ${member.email}.`,
                        )
                      }
                      value={member.role}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button
                      aria-label={`Remove ${member.email}`}
                      className={ui.quiet}
                      onClick={() => {
                        if (window.confirm(`Remove access for ${member.email}?`)) {
                          setStatus('Removing access and re-encrypting your records…');
                          void run(family.remove(member.email), `Removed ${member.email}.`);
                        }
                      }}
                      type="button"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p className={ui.empty}>Invites are available to the owner after signing in.</p>
      )}
      {status ? (
        <p className={ui.notice} role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}

const GUIDE = [
  ['Dashboard', 'Net worth, this month, trends, portfolio and debts at a glance.'],
  ['Income & Expense', 'Record money in and out, post recurring items, and review each month.'],
  ['Investment', 'Holdings, PMS, PF, PPF, NPS and gratuity, with values and contributions.'],
  ['Debts', 'Loans, EMIs, part payments, rate changes, top-ups and statement corrections.'],
  ['Analytics & Reports', 'Trends, growth projections, goals, and date range reports.'],
  ['Net worth', 'Current value of all holdings, less what remains on all loans.'],
  ['Invested', 'Opening amount plus contributions.'],
  ['Current value', 'Latest valuation, plus contributions and interest dated after it.'],
  ['XIRR', 'Annualised return that accounts for when each amount was invested.'],
  ['Gratuity', 'Basic salary x 15/26 x years counted, after 5 years, capped at 20,00,000.'],
  ['House expense', 'Opening balance + income - expenses - PMS - next opening balance.'],
];

const saveGuide = () =>
  downloadTablePdf({
    title: 'Personal Finance Tracker guide',
    subtitle: 'Features and calculations',
    columns: [
      { label: 'Topic', width: 55 },
      { label: 'What it means', width: 220 },
    ],
    rows: GUIDE,
    file: 'finance-tracker-guide.pdf',
  });

const withoutPhoto = (settings: TrackerSettings, email: string) =>
  Object.fromEntries(Object.entries(settings.photos).filter(([owner]) => owner !== email));

const DELETE_PHRASE = 'DELETE MY ACCOUNT';

const failureText = (error: unknown) =>
  error instanceof Error ? error.message : 'That did not work. Please try again.';

function DeleteAccount({ account }: { account: Account }) {
  const repository = useTracker((state) => state.repository);
  const settings = useSettings();
  const [phrase, setPhrase] = useState('');
  const [status, setStatus] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { deleteAccount } = account;
  if (!deleteAccount) return null;
  const confirmed = phrase.trim().toUpperCase() === DELETE_PHRASE;
  return (
    <div className={ui.metric}>
      <strong>Delete account</strong>
      <p className={ui.caption}>
        {account.role === 'owner'
          ? 'Permanently deletes this tracker, all its records and family access, then your sign-in.'
          : 'Permanently removes your access and your sign-in. The tracker stays with its owner.'}{' '}
        Google asks you to confirm first, then you're signed out.
      </p>
      <Field label={`Type ${DELETE_PHRASE} to confirm`}>
        <input
          autoCapitalize="characters"
          autoComplete="off"
          onChange={(event) => setPhrase(event.target.value)}
          placeholder={DELETE_PHRASE}
          value={phrase}
        />
      </Field>
      <div className={ui.actions}>
        <button
          className={ui.quiet}
          disabled={!confirmed || deleting}
          onClick={() => {
            setDeleting(true);
            setStatus('');
            deleteAccount(async () => {
              // Viewers can't write here, and can't have uploaded a photo either.
              if (account.role === 'editor' && settings.photos[account.email]) {
                await repository?.commit([
                  {
                    type: 'set',
                    collection: 'settings',
                    id: TRACKER_SETTINGS_ID,
                    value: { ...settings, photos: withoutPhoto(settings, account.email) },
                  },
                ]);
              }
            })
              .catch((error: unknown) => setStatus(failureText(error)))
              .finally(() => setDeleting(false));
          }}
          type="button"
        >
          {deleting ? 'Deleting…' : 'Delete account'}
        </button>
      </div>
      {status ? (
        <p className={ui.fieldError} role="alert">
          {status}
        </p>
      ) : null}
    </div>
  );
}

function DeviceUnlock({ security }: { security: AccountSecurity }) {
  const { passkey } = security;
  const [available, setAvailable] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(passkey.enabled());
  const [asking, setAsking] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    void passkey.available().then(setAvailable);
  }, [passkey]);

  const run = (task: () => Promise<void>, done: string, next: boolean) => {
    setWorking(true);
    setStatus('');
    task()
      .then(
        () => {
          setEnabled(next);
          setAsking(false);
          setPassphrase('');
          setStatus(done);
        },
        (error: unknown) => setStatus(failureText(error)),
      )
      .finally(() => setWorking(false));
  };

  return (
    <div className={ui.metric}>
      <label className={ui.toggleRow}>
        <strong>Face ID or fingerprint</strong>
        <input
          checked={enabled || asking}
          className={ui.switch}
          disabled={!available || working}
          onChange={(event) => {
            setStatus('');
            if (enabled) run(passkey.disable, 'Turned off.', false);
            else setAsking(event.target.checked);
          }}
          role="switch"
          type="checkbox"
        />
      </label>
      <p className={ui.caption}>
        {available === false
          ? "This device or browser doesn't support it yet."
          : enabled
            ? 'On. The app asks when it opens, and again after 5 minutes away. Turning this off removes it from all your devices.'
            : 'Off. This device is saved, so it stays unlocked until you sign out. Turn this on to ask for your face or fingerprint when the app opens.'}
      </p>
      {asking ? (
        <>
          <Field label="Enter your passphrase to turn this on">
            <input
              autoComplete="current-password"
              onChange={(event) => setPassphrase(event.target.value)}
              type="password"
              value={passphrase}
            />
          </Field>
          <button
            className={ui.quiet}
            disabled={!passphrase || working}
            onClick={() => run(() => passkey.enable(passphrase), 'Turned on.', true)}
            type="button"
          >
            {working ? 'Setting up…' : 'Continue'}
          </button>
        </>
      ) : null}
      {status ? (
        <p className={ui.caption} role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}

function SecurityPanel({ security }: { security: AccountSecurity }) {
  const [current, setCurrent] = useState('');
  const [fresh, setFresh] = useState({ passphrase: '', repeat: '' });
  const [recoveryCode, setRecoveryCode] = useState('');
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);

  const run = (task: () => Promise<string>) => {
    setWorking(true);
    setStatus('');
    task()
      .then(setStatus, (error: unknown) => setStatus(failureText(error)))
      .finally(() => setWorking(false));
  };

  return (
    <div className={ui.metric}>
      <strong>Passphrase and recovery code</strong>
      <p className={ui.caption}>
        Only you can open your records. Nobody can reset these for you, so keep your recovery code
        safe.
      </p>
      <Field label="Current passphrase">
        <input
          autoComplete="current-password"
          onChange={(event) => setCurrent(event.target.value)}
          type="password"
          value={current}
        />
      </Field>
      <PassphraseFields label="New passphrase" onChange={setFresh} value={fresh} />
      <div className={ui.actions}>
        <button
          className={ui.quiet}
          disabled={!current || !validPassphrase(fresh) || working}
          onClick={() =>
            run(async () => {
              await security.changePassphrase(current, fresh.passphrase);
              setCurrent('');
              setFresh({ passphrase: '', repeat: '' });
              return 'Passphrase changed.';
            })
          }
          type="button"
        >
          Change passphrase
        </button>
        <button
          className={ui.quiet}
          disabled={!current || working}
          onClick={() =>
            run(async () => {
              setRecoveryCode(await security.newRecoveryCode(current));
              setCurrent('');
              return 'New recovery code created. Your old code no longer works.';
            })
          }
          type="button"
        >
          New recovery code
        </button>
      </div>
      {status ? (
        <p className={ui.caption} role="status">
          {status}
        </p>
      ) : null}
      {recoveryCode ? <RecoveryCode code={recoveryCode} /> : null}
    </div>
  );
}

function FamilyAccessPanel({ account }: { account: Account }) {
  return (
    <div className={ui.page}>
      <section className={ui.metric}>
        <h3 className={ui.panelTitle}>Family members</h3>
        <FamilyNames />
      </section>
      <section className={ui.metric}>
        <h3 className={ui.panelTitle}>Access</h3>
        <p className={ui.caption}>
          Your role: <strong>{account.role}</strong>. Viewers can view and export. Editors can add,
          edit and delete records. Owners also manage access and import backups.
        </p>
        <FamilyMembers account={account} />
      </section>
    </div>
  );
}

function ChangeLog() {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const report = useTracker((state) => state.report);
  const rows = [...data.changes].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50);
  if (rows.length === 0) return <p className={ui.empty}>No changes recorded yet.</p>;

  const undo = (change: ChangeRecord) => {
    try {
      commit(
        [
          ...undoWrites(data, change),
          {
            type: 'set',
            collection: 'changes',
            id: change.id,
            value: { ...change, undone: true },
          },
        ],
        { log: false },
      );
    } catch (error) {
      report(error instanceof Error ? error.message : 'This change could not be undone.');
    }
  };

  return (
    <div className={ui.page}>
      <p className={ui.caption}>
        Saved changes across your family. Undo restores the earlier version of a record, and refuses
        if that record has changed since. Very large changes can't be undone here, so use a backup
        for those.
      </p>
      <ul className={ui.list}>
        {rows.map((change) => (
          <li className={ui.row} key={change.id}>
            <div className={ui.rowMain}>
              <div className={ui.rowTitle}>{change.summary}</div>
              <div className={ui.rowDetail}>
                {new Date(change.at).toLocaleString('en-IN')}
                {change.actor ? ` · ${change.actor}` : ''}
              </div>
            </div>
            <button
              aria-label={`Undo ${change.summary}`}
              className={ui.quiet}
              disabled={change.undone || change.entries.length === 0}
              onClick={() => undo(change)}
              type="button"
            >
              {change.undone ? 'Undone' : 'Undo'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReleaseNotes({ title, notes }: { title: string; notes: string[] }) {
  return (
    <div>
      <div className={ui.groupLabel}>{title}</div>
      <ul className={ui.notes}>
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

function AppUpdates() {
  const { canInstall, install } = useInstallApp();
  const { updateReady, applyUpdate } = useAppUpdate();
  const [result, setResult] = useState<UpdateCheck | null>(null);
  const [checking, setChecking] = useState(false);

  const check = () => {
    setChecking(true);
    void checkForUpdates()
      .then(setResult)
      .finally(() => setChecking(false));
  };

  return (
    <div className={ui.page}>
      <div className={ui.metric}>
        <strong>Version {VERSION}</strong>
        <p className={ui.caption}>New versions wait for you to accept them.</p>
        <div className={ui.actions}>
          <button className={ui.quiet} disabled={checking} onClick={check} type="button">
            {checking ? 'Checking…' : 'Check for updates'}
          </button>
          {updateReady ? (
            <button className={ui.button} onClick={applyUpdate} type="button">
              Apply update
            </button>
          ) : null}
        </div>
        {result ? (
          <p className={ui.caption} role="status">
            {updateReady ? 'A new version is ready.' : result.message}
          </p>
        ) : null}
        {result?.next ? (
          <ReleaseNotes notes={result.next.notes} title={`What's new in ${result.next.version}`} />
        ) : null}
      </div>
      <details className={ui.fold}>
        <summary>In this version</summary>
        <ReleaseNotes notes={release.notes} title={`Version ${VERSION}, ${release.released}`} />
      </details>
      <div className={ui.metric}>
        <strong>Install app</strong>
        <p className={ui.caption}>
          {canInstall
            ? 'Add Finance Tracker to your Home Screen or desktop.'
            : 'Already installed, or use your browser menu to add it to your Home Screen.'}
        </p>
        <button className={ui.quiet} disabled={!canInstall} onClick={install} type="button">
          Install app
        </button>
      </div>
    </div>
  );
}

function ProfilePhoto({ account }: { account: Account }) {
  const settings = useSettings();
  const save = useSaveSettings();
  const report = useTracker((state) => state.report);
  const canEdit = useTracker((state) => state.canEdit);
  const file = useRef<HTMLInputElement>(null);
  const uploaded = settings.photos[account.email];

  const setPhotos = (photos: Record<string, string>) => save({ photos });

  return (
    <div className={ui.metric}>
      <strong>Profile photo</strong>
      <div className={ui.photoRow}>
        <Avatar account={account} size={64} />
        {canEdit ? (
          <div className={ui.actions}>
            <input
              accept="image/*"
              aria-label="Choose a profile photo"
              hidden
              onChange={(event) => {
                const chosen = event.target.files?.[0];
                event.target.value = '';
                if (!chosen) return;
                resizePhoto(chosen).then(
                  (photo) => setPhotos({ ...settings.photos, [account.email]: photo }),
                  () => report('That picture could not be used. Try a JPEG or PNG.'),
                );
              }}
              ref={file}
              type="file"
            />
            <button className={ui.quiet} onClick={() => file.current?.click()} type="button">
              Change photo
            </button>
            {uploaded ? (
              <button
                className={ui.quiet}
                onClick={() => setPhotos(withoutPhoto(settings, account.email))}
                type="button"
              >
                Use Google photo
              </button>
            ) : null}
          </div>
        ) : (
          <p className={ui.caption}>
            Your Google photo is used here. Ask the owner for edit access to change it.
          </p>
        )}
      </div>
    </div>
  );
}

function Appearance() {
  const { theme, toggle, palette, setPalette } = useTheme();
  return (
    <div className={ui.page}>
      <div className={ui.split}>
        <span>
          Mode: <strong>{theme === 'dark' ? 'Dark' : 'Light'}</strong>
        </span>
        <button className={ui.quiet} onClick={toggle} type="button">
          Switch to {theme === 'dark' ? 'light' : 'dark'} mode
        </button>
      </div>
      <div className={ui.themeGrid} role="group" aria-label="Color themes">
        {THEME_CHOICES.map(({ key, label, swatches }) => (
          <button
            aria-pressed={palette === key}
            className={ui.themeChoice}
            key={key}
            onClick={() => setPalette(key)}
            type="button"
          >
            <span aria-hidden="true" className={ui.themeSwatches}>
              {swatches.map((color) => (
                <i key={color} style={{ background: color }} />
              ))}
            </span>
            {label}
          </button>
        ))}
      </div>
      <p className={ui.caption}>Your choice is saved on this device.</p>
    </div>
  );
}

export function SettingsPage({ account }: { account: Account }) {
  const { state: target } = useLocation() as { state: { panel?: Panel } | null };
  const [panel, setPanel] = useState<Panel | null>(target?.panel ?? null);
  const setTourOpen = useTracker((state) => state.setTourOpen);
  const repository = useTracker((state) => state.repository);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  const syncNow = () => {
    if (!navigator.onLine) {
      setSyncStatus('Your changes are safe here and will sync when you reconnect.');
      return;
    }
    setSyncing(true);
    void (repository?.flush?.() ?? Promise.resolve())
      .then(
        () => setSyncStatus('All changes are saved to the cloud.'),
        () => setSyncStatus('Sync could not finish. Your changes stay on this device.'),
      )
      .finally(() => setSyncing(false));
  };
  const open = TILES.find((tile) => tile.panel === panel);

  return (
    <div className={ui.page}>
      <PageHeader
        eyebrow="Personalize your tracker"
        subtitle="Adjust the look, manage the values in your forms, and protect your backup."
        title="Settings"
      />
      <section aria-label="Your account" className={ui.card}>
        <div className={ui.cardHeader} style={{ flexWrap: 'wrap' }}>
          <div className={ui.cardHeader} style={{ justifyContent: 'flex-start' }}>
            <Avatar account={account} size={40} />
            <div>
              <strong>{account.name}</strong>
              <div className={ui.caption}>{account.email}</div>
            </div>
          </div>
          <button className={ui.quiet} disabled={syncing} onClick={syncNow} type="button">
            <RefreshCw size={14} /> {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
        {syncStatus ? (
          <p className={ui.caption} role="status" style={{ margin: 0 }}>
            {syncStatus}
          </p>
        ) : null}
      </section>
      <div className={ui.settingGrid}>
        {TILES.map(({ panel: key, icon: Icon, title, text }) => (
          <button className={ui.settingTile} key={key} onClick={() => setPanel(key)} type="button">
            <span aria-hidden="true" className={ui.tileIcon}>
              <Icon size={20} />
            </span>
            <span className={ui.settingText}>
              <strong style={{ display: 'block' }}>{title}</strong>
              <span className={ui.caption}>{text}</span>
            </span>
            <ChevronRight aria-hidden="true" className={ui.settingArrow} size={16} />
          </button>
        ))}
      </div>
      {open ? (
        <Modal onClose={() => setPanel(null)} title={open.title}>
          {panel === 'info' ? (
            <div className={ui.page}>
              <p>
                Track income, expenses, investments, retirement accounts and loans for your family.
                Balances are always calculated from your records, so totals stay consistent across
                devices.
              </p>
              <button
                className={ui.quiet}
                onClick={() => {
                  setPanel(null);
                  setTourOpen(true);
                }}
                type="button"
              >
                Start app tour
              </button>
              <button className={ui.quiet} onClick={() => void saveGuide()} type="button">
                Save PDF guide
              </button>
            </div>
          ) : null}
          {panel === 'account' ? (
            <div className={ui.page}>
              <p>
                {account.name} · {account.email}
              </p>
              {account.signOut ? (
                <button className={ui.quiet} onClick={account.signOut} type="button">
                  Sign out
                </button>
              ) : null}
              <ProfilePhoto account={account} />
              {account.security ? <DeviceUnlock security={account.security} /> : null}
              {account.security ? <SecurityPanel security={account.security} /> : null}
              <DeleteAccount account={account} />
            </div>
          ) : null}
          {panel === 'family' ? <FamilyAccessPanel account={account} /> : null}
          {panel === 'appearance' ? <Appearance /> : null}
          {panel === 'data' ? <DataBackup /> : null}
          {panel === 'updates' ? <AppUpdates /> : null}
        </Modal>
      ) : null}
    </div>
  );
}
