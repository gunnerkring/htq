import type { CulledPilot, SharpPilot } from "../types/pilot";
import { QUAL_HOURS } from "./constants";
import { computeRequiredHoursPerMonth } from "./requirements";

export function buildCulledData(
  sharpRows: SharpPilot[],
  monthsAlreadyEqualTrainingMonth: boolean
): CulledPilot[] {
  return sharpRows.map((pilot) => {
    const adjustedTrainingMonth =
      pilot.trainingMonth == null
        ? null
        : monthsAlreadyEqualTrainingMonth
          ? pilot.trainingMonth
          : pilot.trainingMonth + 1;

    const over600 = pilot.pilotHours >= QUAL_HOURS;
    const hrsPerMonthTo600 = over600
      ? null
      : computeRequiredHoursPerMonth({
          currentHours: pilot.pilotHours,
          threshold: QUAL_HOURS,
          currentTrainingMonth: adjustedTrainingMonth,
          targetTrainingMonth: 24
        });

    return {
      ...pilot,
      trainingMonth: adjustedTrainingMonth,
      over600,
      hrsPerMonthTo600
    };
  });
}
