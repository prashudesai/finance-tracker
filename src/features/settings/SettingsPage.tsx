import {
  Archive,
  ChevronRight,
  DatabaseBackup,
  FileCheck,
  History,
  Info,
  ListPlus,
  Palette,
  RefreshCw,
  Smartphone,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { statementAccounts } from '../../domain/analytics';
import { clearWrites, createBackup, parseBackup, restoreWrites } from '../../domain/backup';
import { undoWrites } from '../../domain/changes';
import type { ChangeRecord } from '../../schema/records';
import { useSaveSettings, useSettings, useTracker } from '../../store/tracker';
import type { Account, FamilyMember } from '../../Shell';
import { downloadText } from '../../ui/download';
import { Field } from '../../ui/Field';
import { formatMoney, localDate, signedMoney } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { useInstallApp } from '../../ui/pwa';
import { useTheme } from '../../ui/theme';
import { THEME_CHOICES } from '../../ui/themes';
import ui from '../../ui/ui.module.css';

type Panel =
  | 'info'
  | 'account'
  | 'family'
  | 'appearance'
  | 'values'
  | 'archived'
  | 'statements'
  | 'changes'
  | 'data'
  | 'updates';

const VERSION = '1.0.0';

const TILES: { panel: Panel; icon: LucideIcon; title: string; text: string }[] = [
  { panel: 'info', icon: Info, title: 'App info', text: 'Features and calculations' },
  { panel: 'account', icon: User, title: 'Account', text: 'Profile details and sign out' },
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
    panel: 'values',
    icon: ListPlus,
    title: 'Custom values',
    text: 'Family members, categories and sources',
  },
  {
    panel: 'archived',
    icon: Archive,
    title: 'Archived accounts',
    text: 'Restore closed accounts and loans',
  },
  {
    panel: 'statements',
    icon: FileCheck,
    title: 'Statement checks',
    text: 'Compare balances with your statements',
  },
  {
    panel: 'changes',
    icon: History,
    title: 'Change log',
    text: 'See saved changes and undo them',
  },
  {
    panel: 'data',
    icon: DatabaseBackup,
    title: 'Data & backup',
    text: 'Export, import and recovery tools',
  },
  { panel: 'updates', icon: Smartphone, title: 'App & updates', text: `Version ${VERSION}` },
];

type ListKey =
  'familyMembers' | 'incomeSources' | 'expenseCategories' | 'debtTypes' | 'investmentTypes';

const LISTS: { key: ListKey; label: string }[] = [
  { key: 'familyMembers', label: 'Family members' },
  { key: 'incomeSources', label: 'Income sources' },
  { key: 'expenseCategories', label: 'Expense categories' },
  { key: 'debtTypes', label: 'Loan types' },
  { key: 'investmentTypes', label: 'Investment types' },
];

function CustomValues() {
  const settings = useSettings();
  const save = useSaveSettings();
  const [key, setKey] = useState<ListKey>('familyMembers');
  const [text, setText] = useState('');
  const [growth, setGrowth] = useState<'market' | 'fixed' | 'no-return'>('market');
  const value = text.trim();
  const exists = settings[key].some((item) => item.toLowerCase() === value.toLowerCase());

  return (
    <div className={ui.page}>
      <form
        className={ui.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!value || exists) return;
          save({
            [key]: [...settings[key], value],
            ...(key === 'investmentTypes'
              ? { growthTypes: { ...settings.growthTypes, [value]: growth } }
              : {}),
          });
          setText('');
        }}
      >
        <Field label="Value category">
          <select onChange={(event) => setKey(event.target.value as ListKey)} value={key}>
            {LISTS.map((list) => (
              <option key={list.key} value={list.key}>
                {list.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="New value">
          <input maxLength={60} onChange={(event) => setText(event.target.value)} value={text} />
        </Field>
        {key === 'investmentTypes' ? (
          <Field label="Growth behaviour">
            <select
              onChange={(event) => setGrowth(event.target.value as typeof growth)}
              value={growth}
            >
              <option value="market">Market linked</option>
              <option value="fixed">Fixed return</option>
              <option value="no-return">No return</option>
            </select>
          </Field>
        ) : null}
        <div className={ui.formActions}>
          <button className={ui.button} disabled={!value || exists} type="submit">
            + Add
          </button>
        </div>
      </form>
      {settings[key].length === 0 ? (
        <p className={ui.empty}>No custom values yet.</p>
      ) : (
        <ul className={ui.list}>
          {settings[key].map((item) => (
            <li className={ui.row} key={item}>
              <div className={ui.rowMain}>{item}</div>
              <button
                aria-label={`Remove ${item}`}
                className={ui.quiet}
                onClick={() => save({ [key]: settings[key].filter((row) => row !== item) })}
                type="button"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={ui.caption}>Removing a value keeps it on records that already use it.</p>
    </div>
  );
}

function ArchivedAccounts() {
  const holdings = useTracker((state) => state.data.holdings);
  const loans = useTracker((state) => state.data.loans);
  const commit = useTracker((state) => state.commit);
  const archivedHoldings = holdings.filter((row) => row.archived);
  const archivedLoans = loans.filter((row) => row.archived);
  if (archivedHoldings.length + archivedLoans.length === 0) {
    return <p className={ui.empty}>No archived accounts.</p>;
  }
  return (
    <div className={ui.page}>
      <p className={ui.caption}>
        Archived accounts are left out of current totals and projections. Restoring one resumes its
        contributions, including any months missed while it was archived.
      </p>
      <ul className={ui.list}>
        {archivedHoldings.map((row) => (
          <li className={ui.row} key={row.id}>
            <div className={ui.rowMain}>
              <div className={ui.rowTitle}>{row.name}</div>
              <div className={ui.rowDetail}>{row.type}</div>
            </div>
            <button
              aria-label={`Restore ${row.name}`}
              className={ui.quiet}
              onClick={() =>
                commit([
                  {
                    type: 'set',
                    collection: 'holdings',
                    id: row.id,
                    value: { ...row, archived: false },
                  },
                ])
              }
              type="button"
            >
              Restore
            </button>
          </li>
        ))}
        {archivedLoans.map((row) => (
          <li className={ui.row} key={row.id}>
            <div className={ui.rowMain}>
              <div className={ui.rowTitle}>{row.type}</div>
              <div className={ui.rowDetail}>{row.member}</div>
            </div>
            <button
              aria-label={`Restore ${row.type}`}
              className={ui.quiet}
              onClick={() =>
                commit([
                  {
                    type: 'set',
                    collection: 'loans',
                    id: row.id,
                    value: { ...row, archived: false },
                  },
                ])
              }
              type="button"
            >
              Restore
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataBackup() {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const [status, setStatus] = useState('');
  const [phrase, setPhrase] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const restore = async (selected: File) => {
    try {
      const backup = parseBackup(await selected.text());
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
        <strong>Export backup</strong>
        <p className={ui.caption}>Download all tracker records as one JSON file.</p>
        <button
          className={ui.button}
          onClick={() =>
            downloadText(
              `finance-backup-${localDate()}.json`,
              createBackup(data, new Date().toISOString()),
              'application/json',
            )
          }
          type="button"
        >
          Export backup
        </button>
      </div>
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
      <div className={ui.metric}>
        <strong>Clear all data</strong>
        <p className={ui.caption}>Type DELETE to remove every record. Export a backup first.</p>
        <div className={ui.actions} style={{ flexWrap: 'wrap' }}>
          <input
            aria-label="Type DELETE to confirm"
            className={ui.fieldSelect}
            onChange={(event) => setPhrase(event.target.value)}
            value={phrase}
          />
          <button
            className={ui.quiet}
            disabled={phrase !== 'DELETE'}
            onClick={() => {
              commit(clearWrites(data));
              setPhrase('');
              setStatus('All records were cleared.');
            }}
            type="button"
          >
            Clear all data
          </button>
        </div>
      </div>
      {status ? (
        <p className={ui.notice} role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}

function FamilyAccessPanel({ account }: { account: Account }) {
  const { family } = account;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FamilyMember['role']>('viewer');
  const [status, setStatus] = useState('');
  const [members, setMembers] = useState<FamilyMember[]>([]);

  const refresh = useCallback(() => {
    family?.list().then(setMembers, (error: unknown) => setStatus(String(error)));
  }, [family]);
  useEffect(refresh, [refresh]);

  const run = (action: Promise<void>, done: string) =>
    action.then(
      () => {
        setStatus(done);
        refresh();
      },
      (error: unknown) => setStatus(String(error)),
    );

  return (
    <div className={ui.page}>
      <p className={ui.caption}>
        Viewer: view and export. Editor: add, edit and delete records. Owner: manage access, import
        backups and clear all data. Copies someone has already downloaded can't be taken back.
      </p>
      <p>
        Your role: <strong>{account.role}</strong>
      </p>
      {family ? (
        <>
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

function StatementChecks() {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const today = localDate();
  const accounts = statementAccounts(data, today);
  const [selected, setSelected] = useState(accounts[0]?.id ?? '');
  const [statement, setStatement] = useState('');
  const [notes, setNotes] = useState('');
  const account = accounts.find((row) => row.id === selected);
  const balance = Number(statement);
  const valid = account !== undefined && statement !== '' && balance >= 0;
  const rows = [...data.statementChecks].sort((a, b) => b.date.localeCompare(a.date));
  if (accounts.length === 0) return <p className={ui.empty}>No accounts to compare yet.</p>;

  return (
    <div className={ui.page}>
      <p className={ui.caption}>
        Compare today's tracker balance with a current statement. This records a check and doesn't
        change any balance. Correct an account or EMI on its own page, then check again.
      </p>
      <form
        className={ui.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid || !account) return;
          const id = crypto.randomUUID();
          commit([
            {
              type: 'set',
              collection: 'statementChecks',
              id,
              value: {
                id,
                accountKind: account.kind,
                accountId: account.id,
                accountName: account.name,
                date: today,
                statementBalance: balance,
                trackerBalance: account.balance,
                ...(notes.trim() ? { notes: notes.trim() } : {}),
              },
            },
          ]);
          setStatement('');
          setNotes('');
        }}
      >
        <Field label="Account">
          <select onChange={(event) => setSelected(event.target.value)} value={selected}>
            {accounts.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Statement balance (₹)">
          <input
            inputMode="decimal"
            onChange={(event) => setStatement(event.target.value)}
            step="0.01"
            type="number"
            value={statement}
          />
        </Field>
        <Field label="Statement reference or notes">
          <input maxLength={240} onChange={(event) => setNotes(event.target.value)} value={notes} />
        </Field>
        {account ? (
          <p className={ui.caption} style={{ gridColumn: '1 / -1', margin: 0 }}>
            Tracker balance {formatMoney(account.balance)}
            {statement !== '' ? ` · Difference ${signedMoney(balance - account.balance)}` : ''}
          </p>
        ) : null}
        <div className={ui.formActions}>
          <button className={ui.button} disabled={!valid} type="submit">
            Save statement check
          </button>
        </div>
      </form>
      {rows.length === 0 ? (
        <p className={ui.empty}>No statement checks yet.</p>
      ) : (
        <ul className={ui.list}>
          {rows.map((row) => {
            const difference = row.statementBalance - row.trackerBalance;
            return (
              <li className={ui.row} key={row.id}>
                <div className={ui.rowMain}>
                  <div className={ui.rowTitle}>{row.accountName}</div>
                  <div className={ui.rowDetail}>
                    {row.date} · Statement {formatMoney(row.statementBalance)}
                    {row.notes ? ` · ${row.notes}` : ''}
                  </div>
                </div>
                <span className={`${ui.amount} ${difference === 0 ? ui.gain : ui.loss}`}>
                  {difference === 0 ? 'Matches' : signedMoney(difference)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
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

function AppUpdates() {
  const { canInstall, install } = useInstallApp();
  return (
    <div className={ui.page}>
      <p>You are on version {VERSION}. New versions wait for you to accept them.</p>
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
  const [panel, setPanel] = useState<Panel | null>(null);
  const setTourOpen = useTracker((state) => state.setTourOpen);
  const initial = account.name.charAt(0).toUpperCase();
  const open = TILES.find((tile) => tile.panel === panel);

  return (
    <div className={ui.page}>
      <PageHeader
        eyebrow="Personalize your tracker"
        subtitle="Adjust the look, manage the values in your forms, and protect your backup."
        title="Settings"
      />
      <section aria-label="Your account" className={ui.card}>
        <div className={ui.cardHeader}>
          <div className={ui.cardHeader} style={{ justifyContent: 'flex-start' }}>
            <span aria-hidden="true" className={ui.tileIcon} style={{ borderRadius: '50%' }}>
              {initial}
            </span>
            <div>
              <strong>{account.name}</strong>
              <div className={ui.caption}>{account.email}</div>
            </div>
          </div>
          <span className={ui.caption}>
            <RefreshCw size={12} /> Syncs automatically
          </span>
        </div>
      </section>
      <div className={ui.threeColumn}>
        {TILES.map(({ panel: key, icon: Icon, title, text }) => (
          <button className={ui.tileButton} key={key} onClick={() => setPanel(key)} type="button">
            <span aria-hidden="true" className={ui.tileIcon}>
              <Icon size={20} />
            </span>
            <span>
              <strong style={{ display: 'block' }}>{title}</strong>
              <span className={ui.caption}>{text}</span>
            </span>
            <ChevronRight aria-hidden="true" size={16} />
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
            </div>
          ) : null}
          {panel === 'family' ? <FamilyAccessPanel account={account} /> : null}
          {panel === 'appearance' ? <Appearance /> : null}
          {panel === 'values' ? <CustomValues /> : null}
          {panel === 'archived' ? <ArchivedAccounts /> : null}
          {panel === 'statements' ? <StatementChecks /> : null}
          {panel === 'changes' ? <ChangeLog /> : null}
          {panel === 'data' ? <DataBackup /> : null}
          {panel === 'updates' ? <AppUpdates /> : null}
        </Modal>
      ) : null}
    </div>
  );
}
