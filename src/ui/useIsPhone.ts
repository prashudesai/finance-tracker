import { useSyncExternalStore } from 'react';

const PHONE_QUERY = '(max-width: 700px)';

const media = () => window.matchMedia?.(PHONE_QUERY);

function subscribe(onChange: () => void) {
  const query = media();
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

/** True at the width where the older app switched to its phone layouts. */
export const useIsPhone = () => useSyncExternalStore(subscribe, () => media()?.matches ?? false);
