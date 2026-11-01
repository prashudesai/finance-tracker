import { useEffect, useState } from 'react';

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

/** Registers the service worker. A new version waits until the person accepts it. */
export function useAppUpdate() {
  const [updateReady, setUpdateReady] = useState(false);
  const [apply, setApply] = useState<() => void>(() => () => undefined);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    void import('virtual:pwa-register').then(({ registerSW }) => {
      const update = registerSW({ onNeedRefresh: () => setUpdateReady(true) });
      setApply(() => () => void update(true));
    });
  }, []);

  return { updateReady, applyUpdate: apply };
}
