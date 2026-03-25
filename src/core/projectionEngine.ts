import { formatTrainingMonthProgress } from "./display";
import {
  QUAL_HOURS,
  WAIVER_QUAL_HOURS
} from "./constants";
import type {
  CulledPilot,
  PilotProjectionSettings,
  ProjectionMonth,
  ProjectionRow,
  SortiesConfig
} from "../types/pilot";

type ProjectionInput = {
  pilot: CulledPilot;
  settings: PilotProjectionSettings;
};

function getThreshold(waiver550: boolean): number {
  return waiver550 ? WAIVER_QUAL_HOURS : QUAL_HOURS;
}

function getSortieDivisor(sortieLength: number, numberOfPilots: number): number | null {
  if (sortieLength <= 0 || numberOfPilots <= 0) {
    return null;
  }

  return (sortieLength / numberOfPilots) * 2;
}

function buildMonthlySorties(
  endOfMonthHoursByMonth: number[],
  months: ProjectionMonth[],
  settings: PilotProjectionSettings,
  sortiesConfig: SortiesConfig,
  threshold: number
): (number | "")[] {
  const homeCycleDivisor = getSortieDivisor(
    sortiesConfig.averageHomeCycleSortieLength,
    sortiesConfig.numberOfPilots
  );
  const deploymentDivisor = getSortieDivisor(
    sortiesConfig.averageDeploymentSortieLength,
    sortiesConfig.numberOfPilots
  );

  return months.map((month, index) => {
    if (index > 0 && endOfMonthHoursByMonth[index - 1] >= threshold) {
      return "";
    }

    const divisor = month.cycle === "D" ? deploymentDivisor : homeCycleDivisor;
    const monthlyHours = month.cycle === "D" ? settings.deploymentHours : settings.frtpHours;

    if (divisor == null) {
      return "";
    }

    return Math.ceil(monthlyHours / divisor);
  });
}

export function projectHoursToQualify(
  pilots: ProjectionInput[],
  months: ProjectionMonth[],
  sortiesConfig: SortiesConfig
): ProjectionRow[] {
  return pilots.map(({ pilot, settings }) => {
    // Store cumulative totals after each month's planned flying.
    const endOfMonthHoursByMonth: number[] = [];
    let runningHours = pilot.pilotHours;

    for (const month of months) {
      runningHours += month.cycle === "D" ? settings.deploymentHours : settings.frtpHours;
      endOfMonthHoursByMonth.push(runningHours);
    }

    const threshold = getThreshold(settings.waiver550);
    let currentTrainingMonth = pilot.trainingMonth;
    let qualifiesByEndOfMonthIndex: number | null = null;
    const trainingMonthsByMonth: (number | "Q" | "")[] = [];

    for (let index = 0; index < months.length; index += 1) {
      if (currentTrainingMonth == null) {
        trainingMonthsByMonth.push("");
        continue;
      }

      if (endOfMonthHoursByMonth[index] >= threshold) {
        trainingMonthsByMonth.push("Q");
        if (qualifiesByEndOfMonthIndex == null) {
          qualifiesByEndOfMonthIndex = index;
        }
        currentTrainingMonth = null;
      } else {
        trainingMonthsByMonth.push(currentTrainingMonth);
        currentTrainingMonth += 1;
      }
    }

    return {
      name: pilot.name,
      level: pilot.level,
      currentHours: pilot.pilotHours,
      startTrainingMonth: pilot.trainingMonth,
      threshold,
      waiver550: settings.waiver550,
      deploymentHours: settings.deploymentHours,
      frtpHours: settings.frtpHours,
      endOfMonthHoursByMonth,
      trainingMonthsByMonth,
      monthlySortiesByMonth: buildMonthlySorties(
        endOfMonthHoursByMonth,
        months,
        settings,
        sortiesConfig,
        threshold
      ),
      qualifiesByEndOfMonthIndex
    };
  });
}

export function projectionsToCsv(
  rows: ProjectionRow[],
  months: ProjectionMonth[],
  phaseLabel: string,
  sortiesConfig: SortiesConfig
): string {
  const monthLabels = months.map((month) => month.monthLabel);
  const yearLabels = months.map((month) => month.yearLabel);
  const phasePattern = months.map((month) => month.cycle);
  const lines: string[] = [];

  lines.push(["HTQ End-of-Month Projection", escapeCsv(phaseLabel)].join(","));
  lines.push(["Month", ...monthLabels].join(","));
  lines.push(["Year", ...yearLabels].join(","));
  lines.push(["Cycle", ...phasePattern].join(","));

  for (const row of rows) {
    lines.push(
      [
        escapeCsv(row.name),
        `Threshold ${row.threshold}`,
        `Deployment ${row.deploymentHours}`,
        `FRTP ${row.frtpHours}`,
        ...row.endOfMonthHoursByMonth.map((value) => value.toFixed(1))
      ].join(",")
    );
    lines.push(
      [
        "Training Month",
        "",
        "",
        "",
        ...row.trainingMonthsByMonth.map(formatTrainingMonthProgress)
      ].join(",")
    );
  }

  lines.push("");
  lines.push(["Sorties"].join(","));
  lines.push(
    ["Average Home Cycle Sortie Length", String(sortiesConfig.averageHomeCycleSortieLength)].join(",")
  );
  lines.push(
    [
      "Average Deployment Sortie Length",
      String(sortiesConfig.averageDeploymentSortieLength)
    ].join(",")
  );
  lines.push(["Number of Pilots", String(sortiesConfig.numberOfPilots)].join(","));
  lines.push(["Month", ...monthLabels].join(","));
  lines.push(["Cycle", ...phasePattern].join(","));

  for (const row of rows) {
    lines.push([escapeCsv(row.name), ...row.monthlySortiesByMonth.map(String)].join(","));
  }

  return lines.join("\r\n");
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.split('"').join('""')}"`;
  }
  return value;
}
