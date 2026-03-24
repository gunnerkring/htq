import type { CulledPilot, SharpPilot } from "../types/pilot";
import { QUAL_HOURS } from "./constants";

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

    const over600 = pilot.pilotHours > QUAL_HOURS;
    const monthsRemainingToMonth24 =
      adjustedTrainingMonth == null ? null : 24 - adjustedTrainingMonth;

    let hrsPerMonthTo600: number | null = null;
    if (
      monthsRemainingToMonth24 != null &&
      !over600 &&
      monthsRemainingToMonth24 !== 0
    ) {
      hrsPerMonthTo600 = (QUAL_HOURS - pilot.pilotHours) / monthsRemainingToMonth24;
    }

    return {
      ...pilot,
      trainingMonth: adjustedTrainingMonth,
      over600,
      hrsPerMonthTo600
    };
  });
}
