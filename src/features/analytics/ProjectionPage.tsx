import { useState } from 'react';
import { totalGratuity } from '../../domain/gratuity';
import {
  gratuityAsset,
  projectionAssets,
  runProjection,
  type ProjectionResult,
} from '../../domain/projection';
import { SCENARIOS, type Scenario } from '../../schema/records';
import { useSettings, useSpendingView } from '../../store/tracker';
import { localDate } from '../../ui/format';
import { ProjectionView } from './ProjectionView';

export function ProjectionPage() {
  const data = useSpendingView();
  const settings = useSettings();
  const today = localDate();
  const [scenario, setScenario] = useState<Scenario>('base');

  const assets = projectionAssets(data.holdings, data, settings, data.projectionAdjustments, today);
  const gratuityNow = totalGratuity(data.gratuityAccounts, today);
  const withGratuity =
    data.gratuityAccounts.length > 0 && settings.includeGratuity
      ? [...assets, gratuityAsset(gratuityNow)]
      : assets;

  let error = '';
  const results = {} as Record<Scenario, ProjectionResult>;
  for (const item of SCENARIOS) {
    try {
      results[item] = runProjection(withGratuity, {
        years: settings.projectionYears,
        scenario: item,
        currentMonth: today.slice(0, 7),
        includeMonthly: settings.includeMonthlyContributions,
        excluded: settings.excludedContributions,
        adjustments: data.projectionAdjustments,
        gratuityAccounts: data.gratuityAccounts,
      });
    } catch (failure) {
      error =
        failure instanceof Error ? failure.message : 'This projection could not be calculated.';
    }
  }

  return (
    <ProjectionView
      assets={assets}
      error={error}
      gratuityNow={gratuityNow}
      onScenario={setScenario}
      results={SCENARIOS.every((item) => results[item]) ? results : null}
      scenario={scenario}
      starting={withGratuity}
    />
  );
}
