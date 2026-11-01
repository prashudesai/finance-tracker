import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router';
import { createMemoryRepository } from './data/memoryRepository';
import type { TrackerRepository } from './data/repository';
import { previewData } from './data/previewData';
import { Shell } from './Shell';

type Session =
  | { status: 'loading' }
  | { status: 'signed-out'; signIn: () => void; error?: string }
  | { status: 'ready'; repository: TrackerRepository; signOut: () => void };

/** Firebase loads on demand, so the preview and tests never touch it. */
function useFirebaseSession(): Session {
  const [session, setSession] = useState<Session>({ status: 'loading' });

  useEffect(() => {
    let stop: (() => void) | undefined;
    let active = true;
    void import('./data/firebase').then((firebase) => {
      if (!active) return;
      const signIn = () => {
        firebase.signIn().catch((error: unknown) => {
          setSession({ status: 'signed-out', signIn, error: String(error) });
        });
      };
      stop = firebase.watchUser((user) => {
        if (!user) {
          setSession({ status: 'signed-out', signIn });
          return;
        }
        setSession({ status: 'loading' });
        void firebase.resolveMembership(user).then(({ householdId }) => {
          if (!active) return;
          setSession({
            status: 'ready',
            repository: firebase.createFirestoreRepository(householdId),
            signOut: () => void firebase.signOutUser(),
          });
        });
      });
    });
    return () => {
      active = false;
      stop?.();
    };
  }, []);

  return session;
}

function SignedInApp() {
  const session = useFirebaseSession();
  if (session.status === 'loading') return <p>Loading…</p>;
  if (session.status === 'signed-out') {
    return (
      <main style={{ padding: 'var(--space)' }}>
        <h1>Finance Tracker</h1>
        {session.error ? <p role="alert">{session.error}</p> : null}
        <button onClick={session.signIn} type="button">
          Sign in with Google
        </button>
      </main>
    );
  }
  return <Shell onSignOut={session.signOut} repository={session.repository} />;
}

const preview = createMemoryRepository(previewData());

export function App() {
  return (
    <BrowserRouter>
      {import.meta.env.VITE_DATA_SOURCE === 'memory' ? (
        <Shell repository={preview} />
      ) : (
        <SignedInApp />
      )}
    </BrowserRouter>
  );
}
