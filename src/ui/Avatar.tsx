import { Users } from 'lucide-react';
import type { Account } from '../Shell';
import { useSettings } from '../store/tracker';
import ui from './ui.module.css';

/** An uploaded photo, then the Google photo, then a plain icon. */
export function Avatar({ account, size }: { account: Account; size: number }) {
  const { photos } = useSettings();
  const photo = photos[account.email] ?? account.photo;
  return (
    <span
      aria-hidden="true"
      className={ui.avatar}
      style={{ width: size, height: size, flex: 'none' }}
    >
      {photo ? (
        <img alt="" height={size} referrerPolicy="no-referrer" src={photo} width={size} />
      ) : (
        <Users size={size / 2} />
      )}
    </span>
  );
}
