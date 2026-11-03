import { Route, Routes } from 'react-router';
import { createMemoryRepository } from './data/memoryRepository';
import { previewAccount, previewGate, previewWaiting } from './data/previewAccount';
import { previewData } from './data/previewData';
import type { VaultGate } from './data/vault';
import { SignIn } from './features/auth/SignIn';
import { VaultScreen, WaitingForApproval } from './features/vault/VaultScreen';
import { Shell } from './Shell';

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

/** Sample data and stand-ins for `dev:preview`. Real builds never include this file. */
export function PreviewApp() {
  return (
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
  );
}
