import { describe, expect, it } from "vitest";
import { buildCulledData } from "./culledData";

describe("buildCulledData", () => {
  it("uses inclusive Month 24 pressure math for visible Need / Mo values", () => {
    const [pilot] = buildCulledData(
      [{ name: "Example, Pilot, LT", level: "2", trainingMonth: 23, pilotHours: 580 }],
      true
    );

    expect(pilot.trainingMonth).toBe(23);
    expect(pilot.hrsPerMonthTo600).toBeCloseTo(10);
  });

  it("adjusts the imported training month before computing pressure when needed", () => {
    const [pilot] = buildCulledData(
      [{ name: "Example, Pilot, LT", level: "2", trainingMonth: 23, pilotHours: 580 }],
      false
    );

    expect(pilot.trainingMonth).toBe(24);
    expect(pilot.hrsPerMonthTo600).toBeCloseTo(20);
  });

  it("clears Need / Mo when the pilot is already past the Month 24 target", () => {
    const [pilot] = buildCulledData(
      [{ name: "Late, Pilot, LT", level: "2", trainingMonth: 25, pilotHours: 500 }],
      true
    );

    expect(pilot.hrsPerMonthTo600).toBeNull();
  });

  it("keeps training month 0 as a valid month instead of treating it as missing", () => {
    const [pilot] = buildCulledData(
      [{ name: "New, Pilot, LTJG", level: "1", trainingMonth: 0, pilotHours: 500 }],
      true
    );

    expect(pilot.trainingMonth).toBe(0);
    expect(pilot.hrsPerMonthTo600).toBeCloseTo(4);
  });
});
