import { errorKey, firstAppFrame, safeRoute, sanitizeMessage } from '../domain/errorReport';
import type { ErrorReport } from '../domain/errorReport';
import release from '../release.json';
import { localDate } from './format';

const OPT_OUT_KEY = 'finance-error-reports-off';
const MAX_PER_VISIT = 5;

type Send = (report: ErrorReport) => Promise<unknown>;

let send: Send | null = null;
const sent = new Set<string>();

export function errorReportsAllowed() {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === null;
  } catch {
    return true;
  }
}

export function setErrorReportsAllowed(allowed: boolean) {
  try {
    if (allowed) localStorage.removeItem(OPT_OUT_KEY);
    else localStorage.setItem(OPT_OUT_KEY, '1');
  } catch {
    // The choice lasts for this visit only.
  }
}

/** Sends one sanitized report, at most a few per visit, and never fails loudly. */
export function reportError(error: unknown) {
  if (!send || !errorReportsAllowed() || sent.size >= MAX_PER_VISIT) return;
  const failure = error instanceof Error ? error : new Error(String(error));
  const report: ErrorReport = {
    name: failure.name.slice(0, 40),
    message: sanitizeMessage(failure.message),
    source: firstAppFrame(failure.stack),
    route: safeRoute(window.location.pathname),
    version: release.version,
    day: localDate(),
    device: window.matchMedia?.('(max-width: 700px)')?.matches ? 'phone' : 'desktop',
  };
  const key = errorKey(report);
  if (sent.has(key)) return;
  sent.add(key);
  send(report).catch(() => undefined);
}

export function installErrorReporting(sender: Send) {
  send = sender;
  const onError = (event: ErrorEvent) => reportError(event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => reportError(event.reason);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    send = null;
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
