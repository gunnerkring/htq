import {
  DEFAULT_DEPLOYMENT_HOURS,
  DEFAULT_DEPLOYMENT_SORTIE_LENGTH,
  DEFAULT_HOMECYCLE_HOURS,
  DEFAULT_HOME_CYCLE_SORTIE_LENGTH,
  DEFAULT_SORTIE_PILOT_COUNT,
  DEFAULT_TARGET_TRAINING_MONTH
} from "./constants";
import { sanitizeTargetTrainingMonth } from "./autoCalculate";
import type { PilotProjectionSettings, SortiesConfig } from "../types/pilot";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function sanitizePositiveNumber(value: unknown, fallback: number): number {
  if (!isFiniteNumber(value) || value <= 0) {
    return fallback;
  }

  return value;
}

export function sanitizePositiveInteger(value: unknown, fallback: number): number {
  if (!isFiniteNumber(value)) {
    return fallback;
  }

  const rounded = Math.round(value);
  return rounded > 0 ? rounded : fallback;
}

export function sanitizeDeploymentHours(
  value: unknown,
  fallback = DEFAULT_DEPLOYMENT_HOURS
): number {
  if (!isFiniteNumber(value)) {
    return fallback;
  }

  return Math.max(value, 0);
}

export function sanitizeHomecycleHours(
  value: unknown,
  fallback = DEFAULT_HOMECYCLE_HOURS
): number {
  if (!isFiniteNumber(value)) {
    return fallback;
  }

  return Math.max(value, 0);
}

export function sanitizePilotSettings(
  settings: Partial<PilotProjectionSettings> | undefined,
  defaultDeploymentHours = DEFAULT_DEPLOYMENT_HOURS,
  defaultHomecycleHours = DEFAULT_HOMECYCLE_HOURS
): PilotProjectionSettings {
  const waiver550 = Boolean(settings?.waiver550);
  const tttWaiver = Boolean(settings?.tttWaiver);

  return {
    waiver550,
    tttWaiver,
    targetTrainingMonth: sanitizeTargetTrainingMonth(
      tttWaiver,
      isFiniteNumber(settings?.targetTrainingMonth)
        ? settings.targetTrainingMonth
        : DEFAULT_TARGET_TRAINING_MONTH
    ),
    deploymentHours: sanitizeDeploymentHours(
      settings?.deploymentHours,
      defaultDeploymentHours
    ),
    frtpHours: sanitizeHomecycleHours(settings?.frtpHours, defaultHomecycleHours)
  };
}

export function sanitizePilotSettingsRecord(
  settingsByName: Record<string, PilotProjectionSettings> | undefined,
  defaultDeploymentHours = DEFAULT_DEPLOYMENT_HOURS,
  defaultHomecycleHours = DEFAULT_HOMECYCLE_HOURS
): Record<string, PilotProjectionSettings> {
  if (!settingsByName) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(settingsByName).map(([name, settings]) => [
      name,
      sanitizePilotSettings(settings, defaultDeploymentHours, defaultHomecycleHours)
    ])
  );
}

export function sanitizeSortiesConfig(
  config: Partial<SortiesConfig> | undefined
): SortiesConfig {
  return {
    averageHomeCycleSortieLength: sanitizePositiveNumber(
      config?.averageHomeCycleSortieLength,
      DEFAULT_HOME_CYCLE_SORTIE_LENGTH
    ),
    averageDeploymentSortieLength: sanitizePositiveNumber(
      config?.averageDeploymentSortieLength,
      DEFAULT_DEPLOYMENT_SORTIE_LENGTH
    ),
    numberOfPilots: sanitizePositiveInteger(
      config?.numberOfPilots,
      DEFAULT_SORTIE_PILOT_COUNT
    )
  };
}
