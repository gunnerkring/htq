import { describe, expect, it } from "vitest";
import {
  autoCalculateSelectedPilotSettings
} from "./autoCalculate";
import type {
  CulledPilot,
  PilotProjectionSettings,
  ProjectionMonth
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
    trainingMonth: 24,
    pilotHours: 590,
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
    deploymentHours: 40,
    frtpHours: 20,
    ...overrides
  };
}

describe("autoCalculateSelectedPilotSettings", () => {
  it("treats the target month as inclusive", () => {
    const [result] = autoCalculateSelectedPilotSettings(
      [{ pilot: makePilot(), settings: makeSettings() }],
      makeMonths(["H"])
    );

    expect(result.status).toBe("calculated");
    expect(result.recommendedSettings).toEqual({
      deploymentHours: 20,
      frtpHours: 10
    });
  });

  it("uses the 550 waiver threshold when enabled", () => {
    const [result] = autoCalculateSelectedPilotSettings(
      [
        {
          pilot: makePilot({ pilotHours: 540 }),
          settings: makeSettings({ waiver550: true })
        }
      ],
      makeMonths(["H"])
    );

    expect(result.status).toBe("calculated");
    expect(result.recommendedSettings).toEqual({
      deploymentHours: 20,
      frtpHours: 10
    });
  });

  it("prefers putting tied hours into the current cycle instead of a future cycle", () => {
    const [result] = autoCalculateSelectedPilotSettings(
      [
        {
          pilot: makePilot({ trainingMonth: 22, pilotHours: 540, hrsPerMonthTo600: 20 }),
          settings: makeSettings({ targetTrainingMonth: 24 })
        }
      ],
      makeMonths(["H", "D", "D"])
    );

    expect(result.status).toBe("calculated");
    expect(result.recommendedSettings).toEqual({
      deploymentHours: 20,
      frtpHours: 20
    });
  });
});
