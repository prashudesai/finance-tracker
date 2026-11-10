import { flushSync } from 'react-dom';

const NAME = 'expand-card';

const motionAllowed = () =>
  window.matchMedia?.('(prefers-reduced-motion: no-preference)')?.matches === true;

/**
 * Opens something from a card so the card appears to grow into it: the browser's view
 * transition morphs the tapped card into the dialog that `open` shows. Where view transitions
 * aren't supported, or motion is reduced, it simply opens.
 */
export function expandFrom(card: HTMLElement | null, open: () => void) {
  const start = document.startViewTransition?.bind(document);
  if (!card || !start || !motionAllowed()) {
    open();
    return;
  }
  const root = document.documentElement;
  // Only the card moves; the page behind it doesn't fade as it does between pages.
  root.dataset.transition = 'expand';
  card.style.viewTransitionName = NAME;
  const before = new Set(document.querySelectorAll('dialog'));
  const transition = start(() => {
    card.style.viewTransitionName = '';
    flushSync(open);
    // The dialog that opening added.
    const dialog = [...document.querySelectorAll('dialog')].find((item) => !before.has(item));
    if (dialog && !dialog.open) dialog.showModal();
    if (dialog) dialog.style.viewTransitionName = NAME;
  });
  void transition.finished.finally(() => {
    delete root.dataset.transition;
    card.style.viewTransitionName = '';
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
    if (dialog) dialog.style.viewTransitionName = '';
  });
}
