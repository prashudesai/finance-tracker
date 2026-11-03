import { useEffect, useRef, useState } from 'react';
import ui from './ui.module.css';

const GAP = 8;
const EDGE = 8;

/**
 * Names an icon button the moment it's pointed at or focused, from its `data-tip`. It's a
 * popover so it shows above open dialogs, and nothing around it can clip it.
 */
export function Tooltip() {
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const anchor = useRef<Element | null>(null);

  useEffect(() => {
    const show = (event: Event) => {
      const target = (event.target as Element | null)?.closest?.('[data-tip]');
      anchor.current = target ?? null;
      setText(target?.getAttribute('data-tip') ?? '');
    };
    const hide = () => {
      anchor.current = null;
      setText('');
    };
    document.addEventListener('mouseover', show);
    document.addEventListener('focusin', show);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide);
    document.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('mouseover', show);
      document.removeEventListener('focusin', show);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide);
      document.removeEventListener('scroll', hide, true);
    };
  }, []);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    if (!text || !anchor.current) {
      if (element.matches?.(':popover-open')) element.hidePopover();
      return;
    }
    // Showing again moves it above whichever dialog opened since.
    if (element.matches?.(':popover-open')) element.hidePopover();
    element.showPopover?.();
    const target = anchor.current.getBoundingClientRect();
    const { width, height } = element.getBoundingClientRect();
    const left = target.left + target.width / 2 - width / 2;
    const above = target.top - height - GAP;
    element.style.left = `${Math.min(Math.max(EDGE, left), window.innerWidth - width - EDGE)}px`;
    element.style.top = `${above < EDGE ? target.bottom + GAP : above}px`;
  }, [text]);

  return (
    <div aria-hidden="true" className={ui.tooltip} popover="manual" ref={box}>
      {text}
    </div>
  );
}
