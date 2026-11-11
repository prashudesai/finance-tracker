import { lazy, Suspense } from 'react';
import { useSettings, useTracker } from '../../store/tracker';

const Setup = lazy(() =>
  import('./GettingStarted').then(({ GettingStarted }) => ({ default: GettingStarted })),
);

/**
 * Quick setup, loaded only while it's still to do: it brings every entry form with it, which
 * a set-up account never needs on Home.
 */
export function GettingStartedGate() {
  const canEdit = useTracker((state) => state.canEdit);
  const { onboardingDone } = useSettings();
  if (!canEdit || onboardingDone) return null;
  return (
    <Suspense fallback={null}>
      <Setup />
    </Suspense>
  );
}
