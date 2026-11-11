import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { plainError } from './data/errors';
import type { TrackerRepository } from './data/repository';
import { rememberMembership } from './data/membershipMemory';
import type { VaultAccess, VaultGate } from './data/vault';
import { SignIn } from './features/auth/SignIn';
import release from './release.json';
import { installErrorReporting } from './ui/errorSink';
import { localDate } from './ui/format';
import { LoadingScreen } from './ui/Skeleton';
import { Shell, type Account, type FeedbackKind } from './Shell';

// Shown to few visits, so each loads when it's needed and stays out of the first download.
const FeaturesPage = lazy(() =>
  import('./features/about/FeaturesPage').then(({ FeaturesPage: Page }) => ({ default: Page })),
);
const PrivacyPage = lazy(() =>
  import('./features/privacy/PrivacyPage').then(({ PrivacyPage: Page }) => ({ default: Page })),
);
const VaultScreen = lazy(() =>
  import('./features/vault/VaultScreen').then(({ VaultScreen: Page }) => ({ default: Page })),
);
const WaitingForApproval = lazy(() =>
  import('./features/vault/VaultScreen').then(({ WaitingForApproval: Page }) => ({
    default: Page,
  })),
);

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

const REMOVED_MESSAGE =
  'Your access to this family tracker was removed. Sign in again to start your own tracker.';

/** Firebase loads on demand, so the preview and tests never touch it. */
function useFirebaseSession(): Session {
  const [session, setSession] = useState<Session>({ status: 'loading' });

  useEffect(() => {
    let stop: (() => void) | undefined;
    let stopReports: (() => void) | undefined;
    let stopMembership: (() => void) | undefined;
    let farewell = '';
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
          stopMembership?.();
          stopMembership = undefined;
          setSession({
            status: 'signed-out',
            signIn,
            ...(farewell ? { error: farewell } : {}),
          });
          farewell = '';
          return;
        }
        setSession({ status: 'loading' });
        const onSignOut = () => void firebase.signOutUser();
        const removed = () => {
          farewell = REMOVED_MESSAGE;
          onSignOut();
        };
        const start = async () => {
          const membership = await firebase.resolveMembership(user);
          const { householdId, role } = membership;
          const wasMember = rememberMembership(user.uid, role !== 'owner');
          // Removed while the app was closed. Signing in again starts their own tracker.
          if (wasMember && role === 'owner') {
            removed();
            return;
          }
          stopMembership?.();
          stopMembership =
            role === 'owner' ? undefined : firebase.onMembershipRemoved(user, removed);
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
                sendFeedback: (kind: FeedbackKind, text: string) =>
                  firebase.sendFeedback({ kind, text, version: release.version, day: localDate() }),
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
      stopMembership?.();
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
      <Suspense fallback={<LoadingScreen />}>
        <VaultScreen
          gate={session.gate}
          onAccess={session.onAccess}
          onSignOut={session.onSignOut}
          onStartOver={session.onStartOver}
        />
      </Suspense>
    );
  }
  if (session.status === 'waiting') {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <WaitingForApproval
          access={session.access}
          onAccess={session.onAccess}
          onSignOut={session.onSignOut}
        />
      </Suspense>
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
      <Routes>
        <Route
          element={
            <Suspense fallback={<LoadingScreen />}>
              <FeaturesPage />
            </Suspense>
          }
          path="/features"
        />
        <Route
          element={
            <Suspense fallback={<LoadingScreen />}>
              <PrivacyPage />
            </Suspense>
          }
          path="/privacy"
        />
        <Route
          element={
            PreviewApp ? (
              <Suspense fallback={<LoadingScreen />}>
                <PreviewApp />
              </Suspense>
            ) : (
              <SignedInApp />
            )
          }
          path="*"
        />
      </Routes>
    </BrowserRouter>
  );
}
