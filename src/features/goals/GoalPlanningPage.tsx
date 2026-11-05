import ui from '../../ui/ui.module.css';
import { GoalsSection } from './GoalsSection';
import { RetirementPlanner } from './RetirementPlanner';

/** Reports › Goal planning: the retirement planner, and every goal the family is saving for. */
export function GoalPlanningPage() {
  return (
    <div className={ui.page}>
      <RetirementPlanner />
      <GoalsSection />
    </div>
  );
}
