import {
  BriefcaseBusiness,
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
};

/** A category or income source with its icon, so history is quicker to scan. */
export function CategoryLabel({ name, income = false }: { name: string; income?: boolean }) {
  const Icon = ICONS[name] ?? (income ? Wallet : Receipt);
  return (
    <span className={ui.categoryCell}>
      <Icon aria-hidden="true" size={16} />
      {name}
    </span>
  );
}
