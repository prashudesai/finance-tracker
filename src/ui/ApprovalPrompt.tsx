import { useState } from 'react';
import type { FamilyAccess } from '../Shell';
import { useTracker } from '../store/tracker';
import { Modal } from './Modal';
import ui from './ui.module.css';

/** Asks the owner straight away, on any screen. "Later" leaves it in Needs attention. */
export function ApprovalPrompt({ family }: { family: FamilyAccess }) {
  const requests = useTracker((state) => state.accessRequests);
  const [later, setLater] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const request = requests.find(({ uid }) => !later.includes(uid));
  if (!request) return null;

  const skip = () => setLater((list) => [...list, request.uid]);
  const answer = (task: Promise<void>) => {
    setWorking(true);
    setError('');
    task
      .then(skip, (failure: unknown) => {
        setError(failure instanceof Error ? failure.message : 'That did not work. Try again.');
      })
      .finally(() => setWorking(false));
  };

  return (
    <Modal onClose={skip} title="Family access request">
      <div className={ui.page}>
        <p style={{ margin: 0 }}>
          <strong>{request.email}</strong> wants to join your family tracker.
        </p>
        <div className={ui.metric}>
          <div className={ui.label}>Safety code</div>
          <div className={ui.recoveryCode}>{request.code}</div>
          <p className={ui.caption}>
            For extra safety, check this matches the code on their screen.
          </p>
        </div>
        {error ? (
          <p className={ui.fieldError} role="alert">
            {error}
          </p>
        ) : null}
        <div className={ui.actions}>
          <button
            className={ui.button}
            disabled={working}
            onClick={() => answer(family.approve(request))}
            type="button"
          >
            Approve
          </button>
          <button
            className={ui.quiet}
            disabled={working}
            onClick={() => {
              if (window.confirm(`Deny access for ${request.email}?`)) {
                answer(family.deny(request));
              }
            }}
            type="button"
          >
            Deny
          </button>
          <button className={ui.quiet} disabled={working} onClick={skip} type="button">
            Later
          </button>
        </div>
      </div>
    </Modal>
  );
}
