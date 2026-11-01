import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { createMemoryRepository } from './data/memoryRepository';
import type { TrackerRepository } from './data/repository';
import type { VaultAccess, VaultGate } from './data/vault';
import { previewData } from './data/previewData';
import { SignIn } from './features/auth/SignIn';
import { VaultScreen, WaitingForApproval } from './features/vault/VaultScreen';
import { Shell, type Account } from './Shell';

type Session =
  | { status: 'loading' }
  | { status: 'signed-out'; signIn: () => void; error?: string }
  | {
      status: 'locked';
      gate: VaultGate;
      onAccess: (access: VaultAccess) => void;
      onSignOut: () => void;
      onStartOver: () => void;
    }
  | {
      status: 'waiting';
      access: Extract<VaultAccess, { status: 'waiting' }>;
      onAccess: (access: VaultAccess) => void;
      onSignOut: () => void;
    }
  | { status: 'ready'; repository: TrackerRepository; account: Account };

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
        const onSignOut = () => void firebase.signOutUser();
        const start = async () => {
          const membership = await firebase.resolveMembership(user);
          const { householdId, role } = membership;
          const onAccess = (access: VaultAccess) => {
            if (!active) return;
            if (access.status === 'waiting') {
              setSession({ status: 'waiting', access, onAccess, onSignOut });
              return;
            }
            setSession({
              status: 'ready',
              repository: firebase.createFirestoreRepository(householdId, access.codec),
              account: {
                name: user.displayName ?? user.email ?? 'You',
                email: user.email ?? '',
                role,
                ...(user.photoURL ? { photo: user.photoURL } : {}),
                signOut: onSignOut,
                deleteAccount: (clearMemberData: () => Promise<void>) =>
                  firebase.deleteAccount(user, membership, clearMemberData),
                security: access.tools,
                ...(access.owner ? { family: firebase.familyAccess(user.uid, access.owner) } : {}),
              },
            });
          };
          const opened = await firebase.openVault(user, membership);
          if (!active) return;
          if ('access' in opened) onAccess(opened.access);
          else {
            const onStartOver = () => void start();
            setSession({ status: 'locked', gate: opened.gate, onAccess, onSignOut, onStartOver });
          }
        };
        start().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          setSession({ status: 'signed-out', signIn, error: message });
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
  if (session.status === 'loading') return null;
  if (session.status === 'signed-out') {
    return <SignIn error={session.error} onSignIn={session.signIn} />;
  }
  if (session.status === 'locked') {
    return (
      <VaultScreen
        gate={session.gate}
        onAccess={session.onAccess}
        onSignOut={session.onSignOut}
        onStartOver={session.onStartOver}
      />
    );
  }
  if (session.status === 'waiting') {
    return (
      <WaitingForApproval
        access={session.access}
        onAccess={session.onAccess}
        onSignOut={session.onSignOut}
      />
    );
  }
  return <Shell account={session.account} repository={session.repository} />;
}

const preview = createMemoryRepository(previewData());

export function App() {
  return (
    <BrowserRouter>
      {import.meta.env.VITE_DATA_SOURCE === 'memory' ? (
        <Routes>
          <Route element={<SignIn onSignIn={() => undefined} />} path="/signin" />
          <Route element={<Shell repository={preview} />} path="*" />
        </Routes>
      ) : (
        <SignedInApp />
      )}
    </BrowserRouter>
  );
}
