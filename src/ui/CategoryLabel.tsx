import {
  BriefcaseBusiness,
  Car,
  Dumbbell,
  Fuel,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  Wifi,
  Zap,
  Clapperboard,
  Coins,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Plane,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import ui from './ui.module.css';

const ICONS: Record<string, LucideIcon> = {
  Healthcare: HeartPulse,
  Entertainment: Clapperboard,
  Insurance: ShieldCheck,
  Maintenance: Wrench,
  'House Rent': House,
  Vacation: Plane,
  Education: GraduationCap,
  'EMI Payment': Landmark,
  Salary: BriefcaseBusiness,
  Bonus: Coins,
  Investments: TrendingUp,
  'Rental Income': House,
  Groceries: ShoppingCart,
  'Dining out': Utensils,
  Dining: Utensils,
  Food: Utensils,
  Transport: Car,
  Fuel: Fuel,
  Utilities: Zap,
  Bills: Zap,
  Internet: Wifi,
  Shopping: ShoppingBag,
  Gym: Dumbbell,
  Rent: House,
  Consulting: BriefcaseBusiness,
};

type Hue = 'amber' | 'rose' | 'green' | 'violet' | 'blue' | 'cyan' | 'mint' | 'gold';

/** A colour for each known category, so a list is scanned by colour as well as words. */
const HUES: Record<string, Hue> = {
  Healthcare: 'rose',
  Entertainment: 'violet',
  Insurance: 'blue',
  Maintenance: 'gold',
  'House Rent': 'cyan',
  Rent: 'cyan',
  Vacation: 'blue',
  Education: 'gold',
  'EMI Payment': 'rose',
  Groceries: 'green',
  Grocery: 'green',
  'Dining out': 'amber',
  Dining: 'amber',
  Food: 'amber',
  Transport: 'blue',
  Fuel: 'blue',
  Utilities: 'gold',
  Bills: 'gold',
  Internet: 'gold',
  Shopping: 'violet',
  Gym: 'green',
  Salary: 'mint',
  Bonus: 'gold',
  Investments: 'green',
  'Rental Income': 'cyan',
  Consulting: 'mint',
};

const ORDER: Hue[] = ['amber', 'rose', 'green', 'violet', 'blue', 'cyan', 'gold', 'mint'];

/** A category's colour: its own if known, otherwise one picked from its name, so it stays put. */
export function categoryHue(name: string, income = false): Hue {
  const known = HUES[name];
  if (known) return known;
  if (income) return 'mint';
  let hash = 0;
  for (const char of name.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ORDER[hash % ORDER.length] ?? 'mint';
}

/** A category or income source with its icon in the category's colour, so history scans quickly. */
export function CategoryLabel({
  name,
  income = false,
  icon,
}: {
  name: string;
  income?: boolean;
  /** The category whose icon to show, when the label says something else. */
  icon?: string;
}) {
  const Icon = ICONS[icon ?? name] ?? (income ? Wallet : Receipt);
  const hue = categoryHue(icon ?? name, income);
  return (
    <span className={ui.categoryCell} style={{ '--cat': `var(--cat-${hue})` } as CSSProperties}>
      <Icon aria-hidden="true" size={16} />
      {name}
    </span>
  );
}
