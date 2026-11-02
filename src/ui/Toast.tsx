import { useEffect } from 'react';
import { useTracker } from '../store/tracker';
import ui from './ui.module.css';

const SHOW_FOR_MS = 5000;

/** Confirms a save, with a quick way to take it back. */
export function Toast() {
  const toast = useTracker((state) => state.toast);
  const dismiss = useTracker((state) => state.dismissToast);
  const undo = useTracker((state) => state.undoLast);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismiss, SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  if (!toast) return null;
  return (
    <div className={ui.toast} role="status">
      <span>{toast.message}</span>
      {toast.change?.entries.length ? (
        <button className={ui.toastUndo} onClick={undo} type="button">
          Undo
        </button>
      ) : null}
    </div>
  );
}
