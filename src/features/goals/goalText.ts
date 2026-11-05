import {
  Car,
  GraduationCap,
  Heart,
  House,
  LifeBuoy,
  Palmtree,
  Sunset,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { GoalPlan } from '../../domain/goals';
import type { GoalKind } from '../../schema/records';

export const GOAL_ICONS: Record<GoalKind, LucideIcon> = {
  education: GraduationCap,
  house: House,
  retirement: Sunset,
  wedding: Heart,
  car: Car,
  emergency: LifeBuoy,
  vacation: Palmtree,
  custom: Target,
};

/** Words for a status, so it never rests on colour alone. */
export const STATUS_LABELS: Record<GoalPlan['status'], string> = {
  reached: 'Funded',
  onTrack: 'On track',
  close: 'Slightly behind',
  behind: 'Behind',
};

export const STATUS_TONES: Record<GoalPlan['status'], 'good' | 'neutral' | 'watch'> = {
  reached: 'good',
  onTrack: 'good',
  close: 'neutral',
  behind: 'watch',
};
