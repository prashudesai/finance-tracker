import { Pencil, Trash2 } from 'lucide-react';
import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import styles from './SwipeRow.module.css';

/** How far the row slides to show its two actions. */
const OPEN = 136;
/** A drag shorter than this is a tap, and longer than half opens the row. */
const SLOP = 8;

/**
 * A list row that slides left to show Edit and Delete, as phone lists do. Tapping still opens
 * the row; a tap on an open row closes it. Scrolling up and down is left to the page.
 */
export function SwipeRow({
  open,
  onOpenChange,
  onTap,
  onEdit,
  onDelete,
  label,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTap: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Names the record, for the action buttons. */
  label: string;
  /** Styles for the row's own content, such as its layout. */
  className?: string;
  children: ReactNode;
}) {
  const start = useRef<{ x: number; y: number; base: number } | null>(null);
  const dragged = useRef(false);
  const [offset, setOffset] = useState<number | null>(null);

  const down = (event: PointerEvent<HTMLButtonElement>) => {
    start.current = { x: event.clientX, y: event.clientY, base: open ? -OPEN : 0 };
    dragged.current = false;
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const from = start.current;
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (!dragged.current) {
      // Mostly up or down is a scroll, so the row lets go.
      if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) {
        start.current = null;
        return;
      }
      if (Math.abs(dx) < SLOP) return;
      dragged.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setOffset(Math.min(0, Math.max(-OPEN - 24, from.base + dx)));
  };
  const up = () => {
    if (dragged.current && offset !== null) onOpenChange(offset < -OPEN / 2);
    start.current = null;
    setOffset(null);
  };

  const x = offset ?? (open ? -OPEN : 0);
  return (
    <div className={styles.row} data-active={open || offset !== null || undefined}>
      <div aria-hidden={!open} className={styles.actions}>
        <button
          className={styles.edit}
          onClick={() => {
            onOpenChange(false);
            onEdit();
          }}
          tabIndex={open ? 0 : -1}
          type="button"
        >
          <Pencil aria-hidden="true" size={16} />
          Edit
          <span className={styles.hidden}> {label}</span>
        </button>
        <button
          className={styles.delete}
          onClick={() => {
            onOpenChange(false);
            onDelete();
          }}
          tabIndex={open ? 0 : -1}
          type="button"
        >
          <Trash2 aria-hidden="true" size={16} />
          Delete
          <span className={styles.hidden}> {label}</span>
        </button>
      </div>
      <button
        className={`${styles.front} ${className ?? ''}`}
        data-dragging={offset !== null || undefined}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          if (open) onOpenChange(false);
          else onTap();
        }}
        onPointerCancel={up}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        style={{ transform: `translateX(${x}px)` }}
        type="button"
      >
        {children}
      </button>
    </div>
  );
}
