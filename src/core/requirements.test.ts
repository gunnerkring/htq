import { describe, expect, it } from "vitest";
import {
  computeRequiredHoursPerMonth,
  getInclusiveMonthsRemaining
} from "./requirements";

describe("requirements", () => {
  it("counts the current training month through the target month inclusively", () => {
    expect(getInclusiveMonthsRemaining(22, 24)).toBe(3);
    expect(
      computeRequiredHoursPerMonth({
        currentHours: 540,
        threshold: 600,
        currentTrainingMonth: 22,
        targetTrainingMonth: 24
      })
    ).toBeCloseTo(20);
  });

  it("returns zero when the pilot is already at threshold", () => {
    expect(
      computeRequiredHoursPerMonth({
        currentHours: 600,
        threshold: 600,
        currentTrainingMonth: 24,
        targetTrainingMonth: 24
      })
    ).toBe(0);
  });

  it("returns null once the target month is already in the past", () => {
    expect(
      computeRequiredHoursPerMonth({
        currentHours: 500,
        threshold: 600,
        currentTrainingMonth: 25,
        targetTrainingMonth: 24
      })
    ).toBeNull();
  });
});
