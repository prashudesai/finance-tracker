import { useState } from 'react';
import type { Scenario } from '../../schema/records';
import { ProjectionView } from './ProjectionView';
import { useProjection } from './useProjection';

export function ProjectionPage() {
  const [scenario, setScenario] = useState<Scenario>('base');
  const { assets, error, gratuityNow, results, withGratuity } = useProjection();
  return (
    <ProjectionView
      assets={assets}
      error={error}
      gratuityNow={gratuityNow}
      onScenario={setScenario}
      results={results}
      scenario={scenario}
      starting={withGratuity}
    />
  );
}
