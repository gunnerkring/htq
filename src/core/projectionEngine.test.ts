import { describe, expect, it } from "vitest";
import { projectHoursToQualify } from "./projectionEngine";
import type {
  CulledPilot,
  PilotProjectionSettings,
  ProjectionMonth,
  SortiesConfig
} from "../types/pilot";

function makeMonths(cycles: Array<ProjectionMonth["cycle"]>): ProjectionMonth[] {
  return cycles.map((cycle, index) => ({
    date: new Date(2026, index, 1),
    monthLabel: `Month ${index + 1}`,
    yearLabel: "2026",
    cycle
  }));
}

function makePilot(overrides: Partial<CulledPilot> = {}): CulledPilot {
  return {
    name: "Example, Pilot, LT",
    level: "2",
    trainingMonth: 22,
    pilotHours: 580,
    over600: false,
    hrsPerMonthTo600: 10,
    ...overrides
  };
}

function makeSettings(overrides: Partial<PilotProjectionSettings> = {}): PilotProjectionSettings {
  return {
    waiver550: false,
    tttWaiver: false,
    targetTrainingMonth: 24,
    deploymentHours: 30,
    frtpHours: 20,
    ...overrides
  };
}

const sortiesConfig: SortiesConfig = {
  averageHomeCycleSortieLength: 6,
  averageDeploymentSortieLength: 8,
  numberOfPilots: 3
};

describe("projectHoursToQualify", () => {
  it("marks qualification at the end of the month after that month's planned flying", () => {
    const [row] = projectHoursToQualify(
      [{ pilot: makePilot(), settings: makeSettings() }],
      makeMonths(["H", "D"]),
      sortiesConfig
    );

    expect(row.endOfMonthHoursByMonth).toEqual([600, 630]);
    expect(row.qualifiesByEndOfMonthIndex).toBe(0);
    expect(row.trainingMonthsByMonth).toEqual(["Q", ""]);
    expect(row.monthlySortiesByMonth).toEqual([5, ""]);
  });

  it("uses the waiver threshold for month-end qualification", () => {
    const [row] = projectHoursToQualify(
      [
        {
          pilot: makePilot({ pilotHours: 540, hrsPerMonthTo600: 5 }),
          settings: makeSettings({ waiver550: true, frtpHours: 10 })
        }
      ],
      makeMonths(["H"]),
      sortiesConfig
    );

    expect(row.threshold).toBe(550);
    expect(row.endOfMonthHoursByMonth).toEqual([550]);
    expect(row.qualifiesByEndOfMonthIndex).toBe(0);
  });
});
