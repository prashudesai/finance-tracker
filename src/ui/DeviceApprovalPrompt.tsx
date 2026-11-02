import { useEffect, useState, type FormEvent } from 'react';
import { plainError } from '../data/errors';
import type { AccountSecurity, DeviceApproval } from '../Shell';
import { Field } from './Field';
import { Modal } from './Modal';
import ui from './ui.module.css';

/** Lets a saved device hand its key to a new one, after proving who is holding it. */
export function DeviceApprovalPrompt({ security }: { security: AccountSecurity }) {
  const [requests, setRequests] = useState<DeviceApproval[]>([]);
  const [closed, setClosed] = useState<string[]>([]);
  const [passphrase, setPassphrase] = useState('');
  const [faceId, setFaceId] = useState(() => security.passkey.enabled());
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => security.watchDevices(setRequests), [security]);

  const request = requests.find(({ id }) => !closed.includes(id));
  if (!request) return null;

  const close = () => {
    setClosed((list) => [...list, request.id]);
    setPassphrase('');
    setError('');
  };
  const answer = (task: Promise<void>) => {
    setWorking(true);
    setError('');
    task
      .then(close, (failure: unknown) => {
        setError(plainError(failure, 'That did not work. Please try again.'));
        setFaceId(false);
      })
      .finally(() => setWorking(false));
  };

  return (
    <Modal onClose={close} title="New device sign-in">
      <form
        className={ui.page}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          answer(security.approveDevice(request, faceId ? undefined : passphrase));
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>{request.device}</strong> is trying to open your tracker. Approve only if this is
          you.
        </p>
        <div className={ui.metric}>
          <div className={ui.label}>Safety code</div>
          <div className={ui.recoveryCode}>{request.code}</div>
          <p className={ui.caption}>This should match the code on the new device.</p>
        </div>
        {faceId ? null : (
          <Field label="Your passphrase">
            <input
              autoComplete="current-password"
              onChange={(event) => setPassphrase(event.target.value)}
              type="password"
              value={passphrase}
            />
          </Field>
        )}
        {error ? (
          <p className={ui.fieldError} role="alert">
            {error}
          </p>
        ) : null}
        <div className={ui.actions}>
          <button
            className={ui.button}
            disabled={working || (!faceId && !passphrase)}
            type="submit"
          >
            {working ? 'Approving…' : faceId ? 'Approve with Face ID' : 'Approve'}
          </button>
          <button
            className={ui.quiet}
            disabled={working}
            onClick={() => answer(security.denyDevice(request))}
            type="button"
          >
            Deny
          </button>
        </div>
      </form>
    </Modal>
  );
}
