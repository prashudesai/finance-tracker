import { useMemo } from 'react';
import { addMonths } from '../../domain/calendar';
import { retirementNeed } from '../../domain/retirement';
import { useSettings, useSpendingHousehold } from '../../store/tracker';
import { localDate } from '../../ui/format';
import { savedRetirementInputs } from './retirementInputs';

export interface RetirementSummary {
  needed: number;
  onCourse: number;
  gap: number;
  year: string;
}

/** The retirement planner's result, from its saved inputs, or null before it's been used. */
export function useRetirementSummary(): RetirementSummary | null {
  const data = useSpendingHousehold();
  const settings = useSettings();
  const today = localDate();
  return useMemo(() => {
    const inputs = savedRetirementInputs(data, settings, today);
    if (!inputs) return null;
    const need = retirementNeed(inputs);
    const birth = settings.retirement?.birthDate ?? '';
    const retireOn = settings.retirement?.retireDate || (birth ? addMonths(birth, 60 * 12) : '');
    return {
      needed: need.needed,
      onCourse: need.onCourse,
      gap: need.gap,
      year: retireOn.slice(0, 4),
    };
  }, [data, settings, today]);
}
