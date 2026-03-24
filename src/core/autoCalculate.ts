import {
  DEFAULT_TARGET_TRAINING_MONTH,
  MAX_DEPLOYMENT_HOURS,
  MAX_HOMECYCLE_HOURS,
  MAX_TTT_TARGET_TRAINING_MONTH,
  MIN_TARGET_TRAINING_MONTH,
  MIN_DEPLOYMENT_HOURS,
  MIN_HOMECYCLE_HOURS,
  QUAL_HOURS
} from "./constants";
import type {
  AutoCalcResult,
  CulledPilot,
  PilotProjectionSettings,
  ProjectionMonth
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

    if (pilot.trainingMonth == null) {
      return {
        name: pilot.name,
        status: "missing-training-month",
        message: "Training month is missing, so auto calculation cannot determine a deadline.",
        targetTrainingMonth
      };
    }

    const deadlineIndex = targetTrainingMonth - pilot.trainingMonth;

    if (deadlineIndex < 0) {
      return {
        name: pilot.name,
        status: "past-target-month",
        message: `Current training month ${pilot.trainingMonth} is already past TM${targetTrainingMonth}.`,
        targetTrainingMonth
      };
    }

    if (deadlineIndex >= months.length) {
      return {
        name: pilot.name,
        status: "out-of-window",
        message: `TM${targetTrainingMonth} is outside the available projection window.`,
        targetTrainingMonth
      };
    }

    const monthsBeforeDeadline = months.slice(0, deadlineIndex + 1);
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

        if (projectedHours < QUAL_HOURS) {
          continue;
        }

        const candidate: Candidate = {
          deploymentHours,
          frtpHours,
          totalAddedHours:
            deploymentMonthCount * deploymentHours + homecycleMonthCount * frtpHours
        };

        if (bestCandidate == null || isBetterCandidate(candidate, bestCandidate)) {
          bestCandidate = candidate;
        }
      }
    }

    if (!bestCandidate) {
      return {
        name: pilot.name,
        status: "unachievable",
        message: `Cannot reach 600 by TM${targetTrainingMonth} within ${MIN_DEPLOYMENT_HOURS}-${MAX_DEPLOYMENT_HOURS} deployed and ${MIN_HOMECYCLE_HOURS}-${MAX_HOMECYCLE_HOURS} homecycle.`,
        targetTrainingMonth
      };
    }

    return {
      name: pilot.name,
      status: "calculated",
      message: `TM${targetTrainingMonth}: ${bestCandidate.deploymentHours} deployed / ${bestCandidate.frtpHours} homecycle.`,
      targetTrainingMonth,
      recommendedSettings: {
        deploymentHours: bestCandidate.deploymentHours,
        frtpHours: bestCandidate.frtpHours
      }
    };
  });
}

function isBetterCandidate(left: Candidate, right: Candidate): boolean {
  if (left.frtpHours !== right.frtpHours) {
    return left.frtpHours < right.frtpHours;
  }

  if (left.totalAddedHours !== right.totalAddedHours) {
    return left.totalAddedHours < right.totalAddedHours;
  }

  return left.deploymentHours < right.deploymentHours;
}
