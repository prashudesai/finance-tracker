import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router';
import { plainError } from './data/errors';
import type { TrackerRepository } from './data/repository';
import type { VaultAccess, VaultGate } from './data/vault';
import { SignIn } from './features/auth/SignIn';
import { installErrorReporting } from './ui/errorSink';
import { LoadingScreen } from './ui/Skeleton';
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
    let stopReports: (() => void) | undefined;
    let active = true;
    void import('./data/firebase').then((firebase) => {
      if (!active) return;
      const signIn = () => {
        firebase.signIn().catch((error: unknown) => {
          const message = plainError(error, 'Sign-in did not finish. Please try again.');
          setSession({ status: 'signed-out', signIn, error: message });
        });
      };
      stopReports = installErrorReporting(firebase.sendErrorReport);
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
          const message = plainError(error, 'Your tracker could not be opened. Please try again.');
          setSession({ status: 'signed-out', signIn, error: message });
        });
      });
    });
    return () => {
      active = false;
      stop?.();
      stopReports?.();
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
  if (session.status === 'loading') return <LoadingScreen />;
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

// The sample-data app is left out of real builds entirely.
const PreviewApp =
  import.meta.env.VITE_DATA_SOURCE === 'memory'
    ? lazy(() => import('./PreviewApp').then(({ PreviewApp: Page }) => ({ default: Page })))
    : null;

export function App() {
  return (
    <BrowserRouter>
      {PreviewApp ? (
        <Suspense fallback={<LoadingScreen />}>
          <PreviewApp />
        </Suspense>
      ) : (
        <SignedInApp />
      )}
    </BrowserRouter>
  );
}
