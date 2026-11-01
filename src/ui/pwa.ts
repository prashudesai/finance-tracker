import { useEffect, useState } from 'react';
import { create } from 'zustand';
import currentRelease from '../release.json';

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

interface Release {
  version: string;
  notes: string[];
}

export interface UpdateCheck {
  message: string;
  next?: Release;
}

/** The newest release on the server, or null if it can't be read. */
async function latestRelease() {
  try {
    const response = await fetch('/version.json', { cache: 'no-store' });
    return response.ok ? ((await response.json()) as Release) : null;
  } catch {
    return null;
  }
}

/** Asks the server for a new version, and says plainly what happened. */
export async function checkForUpdates(): Promise<UpdateCheck> {
  const { registration, updateReady } = useUpdateState.getState();
  if (!registration && !updateReady) {
    return { message: 'Updates are only available in the installed or hosted app.' };
  }
  if (!navigator.onLine) return { message: 'Connect to the internet to check for updates.' };
  try {
    await registration?.update();
  } catch {
    return { message: 'The check could not finish. Please try again.' };
  }
  const release = await latestRelease();
  const next = release && release.version !== currentRelease.version ? release : undefined;
  if (updateReady) return { message: 'A new version is ready.', ...(next ? { next } : {}) };
  if (registration?.installing || registration?.waiting || next) {
    return { message: 'Downloading the new version…', ...(next ? { next } : {}) };
  }
  return { message: 'You have the latest version.' };
}
