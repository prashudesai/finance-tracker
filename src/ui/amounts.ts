import { create } from 'zustand';
import { setAmountsHidden } from './format';

const KEY = 'hideAmounts';

function saved() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

interface AmountsState {
  hidden: boolean;
  toggle(): void;
}

/** Hide amounts, for using the app around other people. Kept per device. */
export const useAmounts = create<AmountsState>((set, get) => ({
  hidden: saved(),
  toggle() {
    const hidden = !get().hidden;
    try {
      if (hidden) localStorage.setItem(KEY, '1');
      else localStorage.removeItem(KEY);
    } catch {
      // The choice lasts for this visit only.
    }
    setAmountsHidden(hidden);
    set({ hidden });
  },
}));

setAmountsHidden(useAmounts.getState().hidden);
