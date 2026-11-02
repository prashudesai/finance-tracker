import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode, type TouchEvent } from 'react';
import { useTracker } from '../store/tracker';
import ui from './ui.module.css';

const SWIPE_TO_CLOSE = 90;

/** A native dialog, which traps focus and restores it when closed. */
export function Modal({
  title,
  onClose,
  children,
  fullScreenOnPhone = false,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  fullScreenOnPhone?: boolean;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const swipeStart = useRef<number | null>(null);

  // Dragging the header down dismisses a phone sheet. The form below scrolls as normal.
  const drag = (distance: number) => {
    if (dialog.current)
      dialog.current.style.transform = distance > 0 ? `translateY(${distance}px)` : '';
  };
  const swipeHandlers = {
    onTouchStart: (event: TouchEvent) => {
      swipeStart.current = event.touches[0]?.clientY ?? null;
    },
    onTouchMove: (event: TouchEvent) => {
      if (swipeStart.current === null) return;
      drag((event.touches[0]?.clientY ?? 0) - swipeStart.current);
    },
    onTouchEnd: (event: TouchEvent) => {
      const end = event.changedTouches[0]?.clientY ?? 0;
      const moved = swipeStart.current === null ? 0 : end - swipeStart.current;
      swipeStart.current = null;
      drag(0);
      if (moved > SWIPE_TO_CLOSE) onClose();
    },
  };

  // The page's own message sits behind a dialog, where it can't be seen.
  const error = useTracker((state) => state.error);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    <dialog
      aria-label={title}
      className={`${fullScreenOnPhone ? ui.dialogFull : ui.dialog} ${wide ? ui.dialogWide : ''}`}
      onClose={onClose}
      ref={dialog}
    >
      <div className={ui.dialogHeader} {...swipeHandlers}>
        <h2>{title}</h2>
        <button
          aria-label="Close"
          className={ui.iconButton}
          onClick={onClose}
          type="button"
          data-tip="Close"
        >
          <X size={18} />
        </button>
      </div>
      {error ? (
        <p className={ui.notice} role="alert">
          {error}
        </p>
      ) : null}
      {children}
    </dialog>
  );
}
