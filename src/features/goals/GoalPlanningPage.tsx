import ui from '../../ui/ui.module.css';
import { GoalsSection } from './GoalsSection';

/** Reports › Goal planning: every goal the family is saving for. */
export function GoalPlanningPage() {
  return (
    <div className={ui.page}>
      <GoalsSection />
    </div>
  );
}
