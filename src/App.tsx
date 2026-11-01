import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { createMemoryRepository } from './data/memoryRepository';
import type { TrackerRepository } from './data/repository';
import type { VaultAccess, VaultGate } from './data/vault';
import { previewAccount, previewGate, previewWaiting } from './data/previewAccount';
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

const RELOCK_AFTER_MS = 5 * 60 * 1000;

/** With Face ID on, coming back after a break reloads, which asks again. */
function useRelockOnReturn(enabled: () => boolean) {
  useEffect(() => {
    let hiddenAt = 0;
    const update = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS && enabled()) {
        window.location.reload();
      }
    };
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [enabled]);
}

function SignedInApp() {
  const session = useFirebaseSession();
  const passkey = session.status === 'ready' ? session.account.security?.passkey : undefined;
  useRelockOnReturn(useCallback(() => passkey?.enabled() ?? false, [passkey]));
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

const leavePreviewVault = () => window.location.assign('/signin');

function PreviewVault({ gate }: { gate: VaultGate }) {
  return (
    <VaultScreen
      gate={gate}
      onAccess={() => undefined}
      onSignOut={leavePreviewVault}
      onStartOver={leavePreviewVault}
    />
  );
}

export function App() {
  return (
    <BrowserRouter>
      {import.meta.env.VITE_DATA_SOURCE === 'memory' ? (
        <Routes>
          <Route element={<SignIn onSignIn={() => undefined} />} path="/signin" />
          <Route element={<PreviewVault gate={previewGate(false)} />} path="/setup" />
          <Route element={<PreviewVault gate={previewGate(true)} />} path="/unlock" />
          <Route
            element={
              <WaitingForApproval
                access={previewWaiting}
                onAccess={() => undefined}
                onSignOut={leavePreviewVault}
              />
            }
            path="/waiting"
          />
          <Route element={<Shell account={previewAccount} repository={preview} />} path="*" />
        </Routes>
      ) : (
        <SignedInApp />
      )}
    </BrowserRouter>
  );
}
