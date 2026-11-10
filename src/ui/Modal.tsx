import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { useTracker } from '../store/tracker';
import ui from './ui.module.css';

const SWIPE_TO_CLOSE = 90;
/** Dragging the header up this far snaps a phone sheet to full height. */
const SWIPE_TO_EXPAND = 40;

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
  // On phones a sheet opens part way up; dragging up, the handle or scrolling it snaps it full.
  const [expanded, setExpanded] = useState(false);

  // Dragging the header down shrinks a full sheet, then dismisses it. The content scrolls as normal.
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
      if (moved < -SWIPE_TO_EXPAND) setExpanded(true);
      else if (moved > SWIPE_TO_CLOSE) {
        if (expanded) setExpanded(false);
        else onClose();
      }
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
      data-expanded={expanded || undefined}
      onClose={onClose}
      onScroll={(event) => {
        if (!expanded && event.currentTarget.scrollTop > 24) setExpanded(true);
      }}
      ref={dialog}
    >
      {fullScreenOnPhone ? null : (
        <button
          aria-label={expanded ? 'Shrink' : 'Expand'}
          className={ui.sheetHandle}
          onClick={() => setExpanded((open) => !open)}
          type="button"
        />
      )}
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
