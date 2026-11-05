import { Download, X } from 'lucide-react';
import { useState } from 'react';
import { addDays } from '../../domain/calendar';
import { useSettings, useTracker } from '../../store/tracker';
import { localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { useInstallApp, useInstalled } from '../../ui/pwa';
import { Nudge } from '../../ui/Nudge';
import ui from '../../ui/ui.module.css';
import { detectPlatform, InstallGuide } from './InstallGuide';

const DISMISSED_KEY = 'installDismissed';
/** Phones are reminded again this long after someone says Not now. */
export const REMINDER_DAYS = 7;

/** The day this device last set the install prompt aside, if ever. Kept on this device only. */
function dismissedOn() {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function dismiss(today: string) {
  try {
    localStorage.setItem(DISMISSED_KEY, today);
  } catch {
    // The choice lasts for this visit only.
  }
}

/** Which nudge this device should see today, if any. */
export function installNudge({
  installed,
  dismissed,
  phone,
  today,
}: {
  installed: boolean;
  dismissed: string | null;
  phone: boolean;
  today: string;
}): 'card' | 'reminder' | null {
  if (installed) return null;
  if (!dismissed) return 'card';
  return phone && addDays(dismissed, REMINDER_DAYS) <= today ? 'reminder' : null;
}

function useNudge() {
  const installed = useInstalled();
  const [dismissed, setDismissed] = useState(dismissedOn);
  const today = localDate();
  const nudge = installNudge({
    installed,
    dismissed,
    phone: detectPlatform() !== 'desktop',
    today,
  });
  const notNow = () => {
    dismiss(today);
    setDismissed(today);
  };
  return { nudge, notNow };
}

function GuideDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} title="How to install" wide>
      <InstallGuide />
    </Modal>
  );
}

/** Shown once on the dashboard after setup, until the app is installed or set aside. */
export function InstallCard() {
  const settings = useSettings();
  const loaded = useTracker((state) => state.loaded);
  const tourOpen = useTracker((state) => state.tourOpen);
  const { canInstall, install } = useInstallApp();
  const { nudge, notNow } = useNudge();
  const [guide, setGuide] = useState(false);
  // Waits for setup and the tour, so it never competes with them.
  if (!loaded || !settings.onboardingDone || tourOpen || nudge !== 'card') return null;

  return (
    <Nudge
      action={
        canInstall ? (
          <button className={ui.button} onClick={install} type="button">
            Install
          </button>
        ) : (
          <button
            aria-label="Show me how"
            className={ui.button}
            onClick={() => setGuide(true)}
            type="button"
          >
            How
          </button>
        )
      }
      closeLabel="Not now"
      detail="Opens like any app, in three taps"
      icon={Download}
      label="Install the app"
      onClose={notNow}
      title="Install the app"
    >
      {guide ? <GuideDialog onClose={() => setGuide(false)} /> : null}
    </Nudge>
  );
}

/** On phones, a reminder every week until the app is installed. */
export function InstallReminder() {
  const { canInstall, install } = useInstallApp();
  const { nudge, notNow } = useNudge();
  const [guide, setGuide] = useState(false);
  if (nudge !== 'reminder') return null;

  return (
    <div className={`${ui.notice} ${ui.split}`} role="status">
      <span>Install Finance Tracker to open it from your home screen.</span>
      <span className={ui.actions}>
        <button
          className={ui.quiet}
          onClick={canInstall ? install : () => setGuide(true)}
          type="button"
        >
          {canInstall ? 'Install' : 'How to install'}
        </button>
        <button
          aria-label="Remind me later"
          className={ui.smallIcon}
          onClick={notNow}
          type="button"
        >
          <X size={14} />
        </button>
      </span>
      {guide ? <GuideDialog onClose={() => setGuide(false)} /> : null}
    </div>
  );
}

/** Settings: install where the browser allows it, and the guide for everyone else. */
export function InstallHelp() {
  const installed = useInstalled();
  const { canInstall, install } = useInstallApp();
  const [guide, setGuide] = useState(false);
  return (
    <div className={ui.metric}>
      <strong>Install app</strong>
      <p className={ui.caption}>
        {installed
          ? 'Installed on this device.'
          : 'Add Finance Tracker to your home screen, dock or Start menu.'}
      </p>
      {installed ? null : (
        <div className={ui.actions}>
          {canInstall ? (
            <button className={ui.button} onClick={install} type="button">
              Install
            </button>
          ) : null}
          <button className={ui.quiet} onClick={() => setGuide(true)} type="button">
            How to install
          </button>
        </div>
      )}
      {guide ? <GuideDialog onClose={() => setGuide(false)} /> : null}
    </div>
  );
}
