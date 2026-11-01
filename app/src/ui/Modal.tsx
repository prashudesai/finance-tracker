import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import ui from './ui.module.css';

/** A native dialog, which traps focus and restores it when closed. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  return (
    <dialog aria-label={title} className={ui.dialog} onClose={onClose} ref={dialog}>
      <div className={ui.dialogHeader}>
        <h2>{title}</h2>
        <button aria-label="Close" className={ui.iconButton} onClick={onClose} type="button">
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
