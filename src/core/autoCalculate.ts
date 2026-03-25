import { formatTrainingMonth } from "./display";
import {
  DEFAULT_TARGET_TRAINING_MONTH,
  MAX_DEPLOYMENT_HOURS,
  MAX_HOMECYCLE_HOURS,
  MAX_TTT_TARGET_TRAINING_MONTH,
  MIN_TARGET_TRAINING_MONTH,
  MIN_DEPLOYMENT_HOURS,
  MIN_HOMECYCLE_HOURS,
  QUAL_HOURS,
  WAIVER_QUAL_HOURS
} from "./constants";
import { getInclusiveMonthsRemaining } from "./requirements";
import type {
  AutoCalcResult,
  CulledPilot,
  PilotProjectionSettings,
  ProjectionMonth,
  PhaseCycleCode
} from "../types/pilot";

type ProjectionInput = {
  pilot: CulledPilot;
  settings: PilotProjectionSettings;
};

type AutoCalcPilotResult = AutoCalcResult & {
  recommendedSettings?: Pick<PilotProjectionSettings, "deploymentHours" | "frtpHours">;
};

type Candidate = {
  deploymentHours: number;
  frtpHours: number;
  totalAddedHours: number;
};

export function getTargetTrainingMonthOptions(tttWaiver: boolean): number[] {
  const minTargetTrainingMonth = tttWaiver
    ? DEFAULT_TARGET_TRAINING_MONTH
    : MIN_TARGET_TRAINING_MONTH;
  const maxTargetTrainingMonth = tttWaiver
    ? MAX_TTT_TARGET_TRAINING_MONTH
    : DEFAULT_TARGET_TRAINING_MONTH;

  return Array.from(
    { length: maxTargetTrainingMonth - minTargetTrainingMonth + 1 },
    (_, index) => minTargetTrainingMonth + index
  );
}

export function sanitizeTargetTrainingMonth(tttWaiver: boolean, targetTrainingMonth: number): number {
  const roundedTarget = Math.round(targetTrainingMonth || DEFAULT_TARGET_TRAINING_MONTH);
  const minTarget = tttWaiver ? DEFAULT_TARGET_TRAINING_MONTH : MIN_TARGET_TRAINING_MONTH;
  const maxTarget = tttWaiver ? MAX_TTT_TARGET_TRAINING_MONTH : DEFAULT_TARGET_TRAINING_MONTH;

  return Math.min(Math.max(roundedTarget, minTarget), maxTarget);
}

export function autoCalculateSelectedPilotSettings(
  pilots: ProjectionInput[],
  months: ProjectionMonth[]
): AutoCalcPilotResult[] {
  return pilots.map(({ pilot, settings }) => {
    const targetTrainingMonth = sanitizeTargetTrainingMonth(
      settings.tttWaiver,
      settings.targetTrainingMonth
    );
    const threshold = settings.waiver550 ? WAIVER_QUAL_HOURS : QUAL_HOURS;

    if (pilot.trainingMonth == null) {
      return {
        name: pilot.name,
        status: "missing-training-month",
        message: "Training month is missing, so auto calculation cannot determine a deadline.",
        targetTrainingMonth
      };
    }

    const monthsRemaining = getInclusiveMonthsRemaining(pilot.trainingMonth, targetTrainingMonth);
    const deadlineIndex = monthsRemaining - 1;

    if (deadlineIndex < 0) {
      return {
        name: pilot.name,
        status: "past-target-month",
        message: `Current training month ${formatTrainingMonth(pilot.trainingMonth)} is already past ${formatTrainingMonth(targetTrainingMonth)}.`,
        targetTrainingMonth
      };
    }

    if (deadlineIndex >= months.length) {
      return {
        name: pilot.name,
        status: "out-of-window",
        message: `${formatTrainingMonth(targetTrainingMonth)} is outside the available projection window.`,
        targetTrainingMonth
      };
    }

    const monthsBeforeDeadline = months.slice(0, monthsRemaining);
    const currentCycle = monthsBeforeDeadline[0]?.cycle ?? "H";
    const deploymentMonthCount = monthsBeforeDeadline.filter((month) => month.cycle === "D").length;
    const homecycleMonthCount = monthsBeforeDeadline.length - deploymentMonthCount;

    let bestCandidate: Candidate | null = null;

    for (let frtpHours = MIN_HOMECYCLE_HOURS; frtpHours <= MAX_HOMECYCLE_HOURS; frtpHours += 1) {
      for (
        let deploymentHours = MIN_DEPLOYMENT_HOURS;
        deploymentHours <= MAX_DEPLOYMENT_HOURS;
        deploymentHours += 1
      ) {
        const projectedHours =
          pilot.pilotHours +
          deploymentMonthCount * deploymentHours +
          homecycleMonthCount * frtpHours;

        if (projectedHours < threshold) {
          continue;
        }

        const candidate: Candidate = {
          deploymentHours,
          frtpHours,
          totalAddedHours:
            deploymentMonthCount * deploymentHours + homecycleMonthCount * frtpHours
        };

        if (bestCandidate == null || isBetterCandidate(candidate, bestCandidate, currentCycle)) {
          bestCandidate = candidate;
        }
      }
    }

    if (!bestCandidate) {
      return {
        name: pilot.name,
        status: "unachievable",
        message: `Cannot reach ${threshold} by ${formatTrainingMonth(targetTrainingMonth)} within ${MIN_DEPLOYMENT_HOURS}-${MAX_DEPLOYMENT_HOURS} deployed and ${MIN_HOMECYCLE_HOURS}-${MAX_HOMECYCLE_HOURS} homecycle.`,
        targetTrainingMonth
      };
    }

    return {
      name: pilot.name,
      status: "calculated",
      message: `${formatTrainingMonth(targetTrainingMonth)}: ${bestCandidate.deploymentHours} deployed / ${bestCandidate.frtpHours} homecycle.`,
      targetTrainingMonth,
      recommendedSettings: {
        deploymentHours: bestCandidate.deploymentHours,
        frtpHours: bestCandidate.frtpHours
      }
    };
  });
}

export function reviewCurrentPilotSettings(
  pilots: ProjectionInput[],
  months: ProjectionMonth[]
): AutoCalcResult[] {
  const results: AutoCalcResult[] = [];

  for (const { pilot, settings } of pilots) {
    const targetTrainingMonth = sanitizeTargetTrainingMonth(
      settings.tttWaiver,
      settings.targetTrainingMonth
    );
    const threshold = settings.waiver550 ? WAIVER_QUAL_HOURS : QUAL_HOURS;

    if (pilot.trainingMonth == null) {
      results.push({
        name: pilot.name,
        status: "missing-training-month",
        message: "Training month is missing, so the current settings cannot be validated.",
        targetTrainingMonth
      });
      continue;
    }

    const monthsRemaining = getInclusiveMonthsRemaining(pilot.trainingMonth, targetTrainingMonth);
    const deadlineIndex = monthsRemaining - 1;

    if (deadlineIndex < 0) {
      results.push({
        name: pilot.name,
        status: "past-target-month",
        message: `Current training month ${formatTrainingMonth(pilot.trainingMonth)} is already past ${formatTrainingMonth(targetTrainingMonth)}.`,
        targetTrainingMonth
      });
      continue;
    }

    if (deadlineIndex >= months.length) {
      results.push({
        name: pilot.name,
        status: "out-of-window",
        message: `${formatTrainingMonth(targetTrainingMonth)} is outside the available projection window.`,
        targetTrainingMonth
      });
      continue;
    }

    const projectedHoursByDeadline = months
      .slice(0, monthsRemaining)
      .reduce(
        (total, month) =>
          total + (month.cycle === "D" ? settings.deploymentHours : settings.frtpHours),
        pilot.pilotHours
      );

    if (projectedHoursByDeadline >= threshold) {
      continue;
    }

    results.push({
      name: pilot.name,
      status: "unachievable",
      message: `Current settings reach ${projectedHoursByDeadline.toFixed(1)} by ${formatTrainingMonth(targetTrainingMonth)}; ${threshold} required.`,
      targetTrainingMonth
    });
  }

  return results;
}

function isBetterCandidate(
  left: Candidate,
  right: Candidate,
  currentCycle: PhaseCycleCode
): boolean {
  const leftCurrentCycleHours = currentCycle === "D" ? left.deploymentHours : left.frtpHours;
  const rightCurrentCycleHours = currentCycle === "D" ? right.deploymentHours : right.frtpHours;
  const leftFutureCycleHours = currentCycle === "D" ? left.frtpHours : left.deploymentHours;
  const rightFutureCycleHours = currentCycle === "D" ? right.frtpHours : right.deploymentHours;

  // Prefer the lightest valid plan first, then bias the hours into the current cycle instead
  // of leaning on a future cycle that the pilot has not reached yet.
  if (left.totalAddedHours !== right.totalAddedHours) {
    return left.totalAddedHours < right.totalAddedHours;
  }

  if (leftFutureCycleHours !== rightFutureCycleHours) {
    return leftFutureCycleHours < rightFutureCycleHours;
  }

  if (leftCurrentCycleHours !== rightCurrentCycleHours) {
    return leftCurrentCycleHours > rightCurrentCycleHours;
  }

  return left.deploymentHours < right.deploymentHours;
}
