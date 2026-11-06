import {
  ChevronRight,
  DatabaseBackup,
  HeartPulse,
  Info,
  MessageSquare,
  Palette,
  RefreshCw,
  Share2,
  Smartphone,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { DataHealth, useHealthSummary } from './DataHealth';
import { addFamilyName } from '../../domain/options';
import {
  APP_URL,
  appInvite,
  familyInvite,
  shareMessage,
  shareStatus,
  type ShareMessage,
} from '../../ui/share';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import release from '../../release.json';
import { syncedRecently } from '../../domain/analytics';
import { createBackup, parseBackup, restoreWrites } from '../../domain/backup';
import { undoWrites } from '../../domain/changes';
import { plainError } from '../../data/errors';
import { TRACKER_SETTINGS_ID, type ChangeRecord, type TrackerSettings } from '../../schema/records';
import { useSaveSettings, useSettings, useTracker } from '../../store/tracker';
import type { Account, AccountSecurity, FamilyMember, FeedbackKind } from '../../Shell';
import { downloadText } from '../../ui/download';
import { downloadTablePdf } from '../../ui/pdf';
import { AppearanceChoice } from '../../ui/AppearanceChoice';
import { InstallHelp } from '../install/InstallPrompts';
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
import { reminderCalendar } from '../../domain/reminders';
import { errorReportsAllowed, setErrorReportsAllowed } from '../../ui/errorSink';
import { Avatar } from '../../ui/Avatar';
import { resizePhoto } from '../../ui/photo';
import { checkForUpdates, useAppUpdate, type UpdateCheck } from '../../ui/pwa';
import ui from '../../ui/ui.module.css';

type Panel =
  | 'info'
  | 'account'
  | 'family'
  | 'appearance'
  | 'archived'
  | 'changes'
  | 'data'
  | 'health'
  | 'updates';

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
    panel: 'health',
    icon: HeartPulse,
    title: 'Data health',
    text: 'Checks that your figures add up',
  },
  {
    panel: 'updates',
    icon: Smartphone,
    title: 'App & updates',
    text: `Version ${VERSION} · Updates and release notes`,
  },
];

function FamilyNames({ account, onInvited }: { account: Account; onInvited: () => void }) {
  const { family } = account;
  const settings = useSettings();
  const save = useSaveSettings();
  const canEdit = useTracker((state) => state.canEdit);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FamilyMember['role']>('viewer');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [invited, setInvited] = useState<{ name: string; email: string } | null>(null);
  const value = name.trim();
  const address = email.trim();
  const members = settings.familyMembers;
  const exists = members.some((item) => item.toLowerCase() === value.toLowerCase());
  const addName = () => save({ familyMembers: addFamilyName(members, value, account.name) });
  const clear = () => {
    setName('');
    setEmail('');
  };

  const invite = (invites: NonNullable<Account['family']>) => {
    setSending(true);
    setStatus('');
    invites
      .invite(address, role)
      .then(
        () => {
          addName();
          clear();
          setStatus('');
          setInvited({ name: value, email: address });
          onInvited();
        },
        (error: unknown) => setStatus(failureText(error)),
      )
      .finally(() => setSending(false));
  };

  return (
    <div>
      <p className={ui.caption}>
        Names used in your records.
        {members.length === 1
          ? ' Add one more to choose a person on each record and switch profiles.'
          : ''}
      </p>
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
            if (!value || sending) return;
            if (family && address) {
              invite(family);
            } else if (!exists) {
              addName();
              clear();
              setStatus('');
            }
          }}
        >
          <Field label="Name">
            <input
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </Field>
          {family ? (
            <Field label="Google email (optional)">
              <input
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </Field>
          ) : null}
          {family && address ? (
            <Field label="Access">
              <select
                onChange={(event) => setRole(event.target.value as FamilyMember['role'])}
                value={role}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            </Field>
          ) : null}
          {family ? (
            <p className={ui.caption}>Add their email if they should sign in too.</p>
          ) : null}
          <div className={ui.formActions}>
            <button
              className={ui.button}
              disabled={!value || sending || (exists && !address)}
              type="submit"
            >
              {address ? 'Add and invite' : '+ Add'}
            </button>
          </div>
        </form>
      ) : null}
      {invited ? (
        <div className={ui.notice} role="status">
          <p style={{ margin: 0 }}>
            <strong>{invited.name} is invited.</strong> Send them the link. They sign in with{' '}
            {invited.email}, and you approve them from your phone.
          </p>
          <ShareButtons
            message={familyInvite(invited.name, invited.email)}
            onStatus={setStatus}
            primary
          />
        </div>
      ) : null}
      {status ? (
        <p className={ui.notice} role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}

/** For friends who'd like their own tracker, not a place in this family. */
function ShareApp() {
  const [status, setStatus] = useState('');
  return (
    <div>
      <ShareButtons label="Share the app" message={appInvite} onStatus={setStatus} />
      {status ? (
        <p className={ui.caption} role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}

/** Share through the phone's menu, or copy, with any outcome said plainly. */
function ShareButtons({
  message,
  onStatus,
  primary = false,
  label = 'Share invite',
}: {
  message: ShareMessage;
  onStatus: (status: string) => void;
  primary?: boolean;
  label?: string;
}) {
  return (
    <div className={ui.actions} style={{ marginTop: 10 }}>
      <button
        className={primary ? ui.button : ui.quiet}
        onClick={() => void shareMessage(message).then((result) => onStatus(shareStatus(result)))}
        type="button"
      >
        <Share2 aria-hidden="true" size={16} /> {label}
      </button>
      <button
        className={ui.quiet}
        onClick={() =>
          void navigator.clipboard.writeText(APP_URL).then(
            () => onStatus('Link copied.'),
            () => onStatus(`Copy this link: ${APP_URL}`),
          )
        }
        type="button"
      >
        Copy link
      </button>
    </div>
  );
}

function DataBackup() {
  const settings = useSettings();
  const save = useSaveSettings();
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const canEdit = useTracker((state) => state.canEdit);
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
      if (!canEdit) {
        setStatus('Viewer access can look at records but not change them.');
        return;
      }
      if (!window.confirm(`Replace all current records with ${count} records from this backup?`)) {
        return;
      }
      commit(restoreWrites(data, backup));
      setStatus(`Restored ${count} records.`);
    } catch (error) {
      setStatus(plainError(error, 'This backup could not be read.'));
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
                if (canEdit) save({ lastBackupOn: localDate() });
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

function FamilyMembers({ account, invites }: { account: Account; invites: number }) {
  const { family } = account;
  const [status, setStatus] = useState('');
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const requests = useTracker((state) => state.accessRequests);

  const refresh = useCallback(() => {
    family?.list().then(setMembers, (error: unknown) => setStatus(failureText(error)));
    // A new invite changes the list.
  }, [family, invites]);
  useEffect(refresh, [refresh]);

  const run = (action: Promise<void>, done: string) =>
    action.then(
      () => {
        setStatus(done);
        refresh();
        return true;
      },
      (error: unknown) => {
        setStatus(failureText(error));
        return false;
      },
    );

  return (
    <div className={ui.page}>
      {family ? (
        <>
          {requests.length > 0 ? (
            <div>
              <div className={ui.groupLabel}>Waiting for approval</div>
              <p className={ui.caption}>
                For extra safety, check the code matches the one on their screen before you approve.
              </p>
              <ul className={ui.list}>
                {requests.map((request) => (
                  <li className={ui.row} key={request.uid} style={{ flexWrap: 'wrap' }}>
                    <div className={ui.rowMain} style={{ flexBasis: '100%' }}>
                      <div className={ui.rowTitle}>{request.email}</div>
                      <div className={ui.rowDetail}>Code {request.code}</div>
                    </div>
                    <div className={ui.actions}>
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
                      <button
                        aria-label={`Deny ${request.email}`}
                        className={ui.quiet}
                        onClick={() => {
                          if (window.confirm(`Deny access for ${request.email}?`)) {
                            void run(family.deny(request), `Denied ${request.email}.`);
                          }
                        }}
                        type="button"
                      >
                        Deny
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <div className={ui.groupLabel}>Members</div>
            {members.length === 0 ? (
              <p className={ui.empty}>No one else has access.</p>
            ) : (
              <ul className={ui.list}>
                {members.map((member) => (
                  <li className={ui.row} key={member.email} style={{ flexWrap: 'wrap' }}>
                    <div className={ui.rowMain} style={{ flexBasis: '100%' }}>
                      <div className={ui.rowTitle}>{member.email}</div>
                      <div className={ui.rowDetail}>
                        {member.accepted ? 'Active' : 'Invite pending'}
                      </div>
                    </div>
                    <div className={ui.actions}>
                      <select
                        aria-label={`Access for ${member.email}`}
                        className={ui.fieldSelect}
                        onChange={(event) =>
                          void run(
                            family.setRole(
                              member.email,
                              event.target.value as FamilyMember['role'],
                            ),
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
                      {member.accepted ? null : (
                        <button
                          aria-label={`Share invite with ${member.email}`}
                          className={ui.quiet}
                          onClick={() =>
                            void shareMessage(familyInvite(null, member.email)).then((result) =>
                              setStatus(shareStatus(result)),
                            )
                          }
                          type="button"
                        >
                          <Share2 aria-hidden="true" size={16} /> Share invite
                        </button>
                      )}
                    </div>
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
  [
    'Analysis & Planning',
    'Trends, income, growth projections, goals, the retirement planner and date range reports.',
  ],
  ['Net worth', 'Current value of all holdings, less what remains on all loans.'],
  ['Invested', 'Opening amount plus contributions.'],
  ['Current value', 'Latest valuation, plus contributions and interest dated after it.'],
  ['XIRR', 'Annualised return that accounts for when each amount was invested.'],
  ['Gratuity', 'Basic salary x 15/26 x years counted, after 5 years, capped at 20,00,000.'],
  [
    'Unrecorded house expense',
    'Opening balance + income - expenses - invested from income - closing balance. Counted as an expense.',
  ],
];

const saveGuide = () =>
  downloadTablePdf({
    title: 'Finance Tracker guide',
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

const failureText = (error: unknown) => plainError(error, 'That did not work. Please try again.');

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

function GuideButton() {
  const report = useTracker((state) => state.report);
  return (
    <button
      className={ui.quiet}
      onClick={() => {
        saveGuide().catch(() => report('The PDF could not be created. Please try again.'));
      }}
      type="button"
    >
      Save PDF guide
    </button>
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
            ? 'On for this device. The app asks when it opens, and again after 5 minutes away.'
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

type SecurityAction = 'passphrase' | 'recovery';

function SecurityPanel({ security }: { security: AccountSecurity }) {
  const [action, setAction] = useState<SecurityAction | null>(null);
  const [current, setCurrent] = useState('');
  const [fresh, setFresh] = useState({ passphrase: '', repeat: '' });
  const [recoveryCode, setRecoveryCode] = useState('');
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);

  const choose = (next: SecurityAction) => {
    setAction(action === next ? null : next);
    setStatus('');
    setRecoveryCode('');
  };

  const run = (task: () => Promise<string>) => {
    setWorking(true);
    setStatus('');
    task()
      .then(
        (done) => {
          setStatus(done);
          setAction(null);
          setCurrent('');
          setFresh({ passphrase: '', repeat: '' });
        },
        (error: unknown) => setStatus(failureText(error)),
      )
      .finally(() => setWorking(false));
  };

  return (
    <div className={ui.metric}>
      <strong>Passphrase and recovery code</strong>
      <div className={ui.actions} style={{ marginTop: 8 }}>
        <button
          aria-expanded={action === 'passphrase'}
          className={ui.quiet}
          onClick={() => choose('passphrase')}
          type="button"
        >
          Change passphrase
        </button>
        <button
          aria-expanded={action === 'recovery'}
          className={ui.quiet}
          onClick={() => choose('recovery')}
          type="button"
        >
          New recovery code
        </button>
      </div>
      {action ? (
        <div className={ui.form} style={{ marginTop: 10 }}>
          <Field label="Current passphrase">
            <input
              autoComplete="current-password"
              onChange={(event) => setCurrent(event.target.value)}
              type="password"
              value={current}
            />
          </Field>
          {action === 'passphrase' ? (
            <PassphraseFields label="New passphrase" onChange={setFresh} value={fresh} />
          ) : null}
          <div className={ui.formActions}>
            <button
              className={ui.button}
              disabled={!current || working || (action === 'passphrase' && !validPassphrase(fresh))}
              onClick={() =>
                run(async () => {
                  if (action === 'passphrase') {
                    await security.changePassphrase(current, fresh.passphrase);
                    return 'Passphrase changed.';
                  }
                  setRecoveryCode(await security.newRecoveryCode(current));
                  return 'Your old recovery code no longer works.';
                })
              }
              type="button"
            >
              {action === 'passphrase' ? 'Save passphrase' : 'Create code'}
            </button>
          </div>
        </div>
      ) : null}
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
  const [invites, setInvites] = useState(0);
  return (
    <div className={ui.page}>
      <section className={ui.metric}>
        <h3 className={ui.panelTitle}>Family members</h3>
        <FamilyNames account={account} onInvited={() => setInvites((count) => count + 1)} />
      </section>
      <section className={ui.metric}>
        <h3 className={ui.panelTitle}>Access</h3>
        <p className={ui.caption}>
          Your role: <strong>{account.role}</strong>. Viewers can view and export. Editors can add,
          edit and delete records. Owners also manage access and import backups.
        </p>
        <FamilyMembers account={account} invites={invites} />
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

function Reminders() {
  const data = useTracker((state) => state.data);
  return (
    <div className={ui.metric}>
      <strong>EMI reminders</strong>
      <p className={ui.caption}>
        Add your EMI dates and month-end review to your phone's calendar. It reminds you the day
        before and on the day, even with the app closed. Loan names go to your calendar, not your
        amounts. Add them again after a new loan.
      </p>
      <button
        className={ui.quiet}
        onClick={() =>
          downloadText(
            'finance-reminders.ics',
            reminderCalendar(data, localDate()),
            'text/calendar',
          )
        }
        type="button"
      >
        Add to my calendar
      </button>
    </div>
  );
}

const FEEDBACK_LIMIT = 1000;

const FEEDBACK_KINDS: Record<FeedbackKind, { label: string; prompt: string; thanks: string }> = {
  feature: {
    label: 'Suggest a feature',
    prompt: 'What would you like the app to do?',
    thanks: 'Thanks, your suggestion was sent.',
  },
  problem: {
    label: 'Report a problem',
    prompt: 'What went wrong, and on which screen?',
    thanks: 'Thanks, your report was sent.',
  },
};

function SendFeedback({ send }: { send: (kind: FeedbackKind, text: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>('feature');
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const chosen = FEEDBACK_KINDS[kind];

  if (state === 'sent') {
    return (
      <p className={ui.caption} role="status">
        {chosen.thanks}
      </p>
    );
  }
  if (!open) {
    return (
      <button className={ui.quiet} onClick={() => setOpen(true)} type="button">
        Send feedback
      </button>
    );
  }
  const trimmed = text.trim();
  return (
    <form
      className={ui.page}
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmed || state === 'sending') return;
        setState('sending');
        send(kind, trimmed).then(
          () => setState('sent'),
          () => setState('failed'),
        );
      }}
    >
      <div aria-label="Feedback type" className={ui.segmented} role="group">
        {(['feature', 'problem'] as const).map((key) => (
          <button
            aria-pressed={kind === key}
            className={kind === key ? ui.segmentActive : ui.segment}
            key={key}
            onClick={() => setKind(key)}
            type="button"
          >
            {FEEDBACK_KINDS[key].label}
          </button>
        ))}
      </div>
      <Field label={chosen.prompt}>
        <textarea
          maxLength={FEEDBACK_LIMIT}
          onChange={(event) => setText(event.target.value)}
          value={text}
        />
      </Field>
      <p className={ui.caption}>Your name and email aren’t sent. Add them if you’d like a reply.</p>
      {state === 'failed' ? (
        <p className={ui.fieldError} role="alert">
          This couldn’t be sent. Check your connection and try again.
        </p>
      ) : null}
      <div className={ui.actions}>
        <button className={ui.button} disabled={!trimmed || state === 'sending'} type="submit">
          {state === 'sending' ? 'Sending…' : 'Send'}
        </button>
        <button className={ui.quiet} onClick={() => setOpen(false)} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ErrorReports() {
  const [allowed, setAllowed] = useState(errorReportsAllowed());
  return (
    <div className={ui.metric}>
      <label className={ui.toggleRow}>
        <strong>Send error reports</strong>
        <input
          checked={allowed}
          className={ui.switch}
          onChange={(event) => {
            setAllowed(event.target.checked);
            setErrorReportsAllowed(event.target.checked);
          }}
          role="switch"
          type="checkbox"
        />
      </label>
      <p className={ui.caption}>
        If something breaks, send what failed, on which screen and app version. Never your records,
        names, amounts or email.
      </p>
    </div>
  );
}

function AppUpdates() {
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
        <details className={ui.fold}>
          <summary>In this version</summary>
          <ReleaseNotes notes={release.notes} title={`Version ${VERSION}, ${release.released}`} />
        </details>
      </div>
      <Reminders />
      <ErrorReports />
      <div className={ui.metric}>
        <strong>Privacy</strong>
        <p className={ui.caption}>What is stored, and what nobody else can read.</p>
        <div className={ui.actions}>
          <Link className={ui.quiet} to="/privacy">
            Read privacy page
          </Link>
        </div>
      </div>
      <InstallHelp />
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
  const healthSummary = useHealthSummary();

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
              <span className={ui.caption}>{key === 'health' ? healthSummary : text}</span>
            </span>
            <ChevronRight aria-hidden="true" className={ui.settingArrow} size={16} />
          </button>
        ))}
      </div>
      <section aria-label="Share and feedback" className={ui.card}>
        <div>
          <h2 style={{ fontSize: '1.1rem' }}>Enjoying Finance Tracker?</h2>
          <div className={ui.caption}>
            Share it with a family who'd find it useful, or tell us what to improve.
          </div>
        </div>
        <ShareApp />
        {account.sendFeedback ? (
          <button className={ui.quiet} onClick={() => setPanel('info')} type="button">
            <MessageSquare aria-hidden="true" size={16} /> Send feedback
          </button>
        ) : null}
      </section>
      {open ? (
        <Modal onClose={() => setPanel(null)} title={open.title}>
          {panel === 'info' ? (
            <div className={ui.page}>
              <p>
                Track income, expenses, investments, retirement accounts and loans for your family.
                Balances are always calculated from your records, so totals stay consistent across
                devices.
              </p>
              <Link className={ui.quiet} to="/features">
                See all features
              </Link>
              <ShareApp />
              {account.sendFeedback ? <SendFeedback send={account.sendFeedback} /> : null}
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
              <GuideButton />
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
          {panel === 'appearance' ? <AppearanceChoice /> : null}
          {panel === 'data' ? <DataBackup /> : null}
          {panel === 'health' ? <DataHealth onClose={() => setPanel(null)} /> : null}
          {panel === 'updates' ? <AppUpdates /> : null}
        </Modal>
      ) : null}
    </div>
  );
}
