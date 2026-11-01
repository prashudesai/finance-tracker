import { useEffect, useState } from 'react';
import { create } from 'zustand';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
}

/** The browser offers this once, possibly before any screen is showing. */
let installPrompt: InstallPrompt | null = null;
const listeners = new Set<() => void>();

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event as InstallPrompt;
  listeners.forEach((listener) => listener());
});

export function useInstallApp() {
  const [canInstall, setCanInstall] = useState(installPrompt !== null);

  useEffect(() => {
    const update = () => setCanInstall(installPrompt !== null);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const install = () => {
    void installPrompt?.prompt();
    installPrompt = null;
    setCanInstall(false);
  };

  return { canInstall, install };
}

interface UpdateState {
  updateReady: boolean;
  applyUpdate: () => void;
  registration: ServiceWorkerRegistration | null;
}

const useUpdateState = create<UpdateState>(() => ({
  updateReady: false,
  applyUpdate: () => undefined,
  registration: null,
}));

let started = false;

/** Registers the service worker. A new version waits until the person accepts it. */
async function startUpdates() {
  if (started || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  started = true;
  const { registerSW } = await import('virtual:pwa-register');
  const update = registerSW({
    onNeedRefresh: () => useUpdateState.setState({ updateReady: true }),
    onRegisteredSW: (_url, registration) => {
      if (registration) useUpdateState.setState({ registration });
    },
  });
  useUpdateState.setState({ applyUpdate: () => void update(true) });
}

export function useAppUpdate() {
  const updateReady = useUpdateState((state) => state.updateReady);
  const applyUpdate = useUpdateState((state) => state.applyUpdate);

  useEffect(() => {
    void startUpdates();
  }, []);

  return { updateReady, applyUpdate };
}

/** Asks the server for a new version, and says plainly what happened. */
export async function checkForUpdates() {
  const { registration, updateReady } = useUpdateState.getState();
  if (updateReady) return 'A new version is ready.';
  if (!registration) return 'Updates are only available in the installed or hosted app.';
  if (!navigator.onLine) return 'Connect to the internet to check for updates.';
  try {
    await registration.update();
  } catch {
    return 'The check could not finish. Please try again.';
  }
  return registration.installing || registration.waiting
    ? 'Downloading the new version…'
    : 'You have the latest version.';
}
