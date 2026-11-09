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

/** A category or income source with its icon, so history is quicker to scan. */
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
  return (
    <span className={ui.categoryCell}>
      <Icon aria-hidden="true" size={16} />
      {name}
    </span>
  );
}
