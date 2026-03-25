import { describe, expect, it } from "vitest";
import {
  buildArchiveHistoryAnalysis,
  buildArchiveRequirementRows,
  buildArchiveTrendSummary,
  createArchiveSnapshot,
  normalizeArchiveSnapshots
} from "./archive";
import { getPilotIdentityKey } from "./display";
import type { ProjectionMonth, ProjectionRow } from "../types/pilot";
import type {
  ArchivedPilotProjection,
  ProjectionArchiveSnapshot
} from "../types/archive";

function makeMonth(year: number, monthIndex: number, cycle: ProjectionMonth["cycle"]): ProjectionMonth {
  const date = new Date(year, monthIndex, 1);

  return {
    date,
    monthLabel: date.toLocaleString("en-US", { month: "long" }),
    yearLabel: String(date.getFullYear()),
    cycle
  };
}

function makeArchivedPilot(
  overrides: Partial<ArchivedPilotProjection> & Pick<ArchivedPilotProjection, "name">
): ArchivedPilotProjection {
  const { name, ...restOverrides } = overrides;

  return {
    name,
    identityKey: getPilotIdentityKey(name),
    level: "2",
    currentHours: 560,
    startTrainingMonth: 22,
    targetTrainingMonth: 24,
    threshold: 600,
    waiver550: false,
    tttWaiver: false,
    deploymentHours: 30,
    frtpHours: 20,
    qualifiesInWindow: false,
    qualifiesByEndOfMonthIndex: null,
    qualificationDate: null,
    qualificationLabel: null,
    needsReview: false,
    reviewMessage: null,
    ...restOverrides
  };
}

function makeSnapshot(
  reportMonthIso: string,
  pilots: ArchivedPilotProjection[],
  overrides: Partial<ProjectionArchiveSnapshot> = {}
): ProjectionArchiveSnapshot {
  const reportDate = new Date(reportMonthIso);

  return {
    id: overrides.id ?? `snapshot-${reportMonthIso}`,
    savedAt: overrides.savedAt ?? reportDate.toISOString(),
    reportMonth: reportDate.toISOString(),
    reportMonthLabel:
      overrides.reportMonthLabel ??
      reportDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    squadron: overrides.squadron ?? "VP-4",
    phase: overrides.phase ?? "A",
    phaseLabel: overrides.phaseLabel ?? "A (VP-4,10,40,45)",
    windowLabel: overrides.windowLabel ?? "March 2026 to February 2028",
    sourceLabel: overrides.sourceLabel ?? "report.xlsx",
    monthModeExact: overrides.monthModeExact ?? true,
    importedCount: overrides.importedCount ?? pilots.length,
    eligibleCount: overrides.eligibleCount ?? pilots.length,
    selectedCount: overrides.selectedCount ?? pilots.length,
    qualifiedCount:
      overrides.qualifiedCount ?? pilots.filter((pilot) => pilot.qualifiesInWindow).length,
    reviewCount: overrides.reviewCount ?? pilots.filter((pilot) => pilot.needsReview).length,
    pilots
  };
}

describe("archive", () => {
  it("normalizes legacy snapshots and preserves legacy qualification month indexes", () => {
    const olderSnapshot = {
      id: "older",
      savedAt: "2026-03-02T10:00:00.000Z",
      reportMonthLabel: "March 2026",
      squadron: "VP-4",
      phase: "A",
      phaseLabel: "A (VP-4,10,40,45)",
      windowLabel: "March 2026 to February 2028",
      sourceLabel: "older.xlsx",
      monthModeExact: true,
      importedCount: 1,
      eligibleCount: 1,
      selectedCount: 1,
      qualifiedCount: 0,
      reviewCount: 0,
      pilots: [
        {
          name: "Example, Pilot, LT",
          level: "2",
          currentHours: 560,
          startTrainingMonth: 22,
          targetTrainingMonth: 24,
          threshold: 600,
          waiver550: false,
          tttWaiver: false,
          deploymentHours: 30,
          frtpHours: 20,
          qualifiesInWindow: true,
          qualificationDate: "2026-05-01T00:00:00.000Z",
          qualificationLabel: "May 2026",
          needsReview: false,
          reviewMessage: null,
          qualifiesInMonthIndex: 2
        }
      ]
    } as unknown as ProjectionArchiveSnapshot;
    const newerSnapshot = makeSnapshot("2026-04-01T00:00:00.000Z", [
      makeArchivedPilot({ name: "Current, Pilot, LT" })
    ]);

    const normalized = normalizeArchiveSnapshots([olderSnapshot, newerSnapshot]);

    expect(normalized.map((snapshot) => snapshot.id)).toEqual(["snapshot-2026-04-01T00:00:00.000Z", "older"]);
    expect(normalized[1]?.reportMonth).toBe("2026-03-02T10:00:00.000Z");
    expect(normalized[1]?.pilots[0]?.identityKey).toBe(getPilotIdentityKey("Example, Pilot, LT"));
    expect(normalized[1]?.pilots[0]?.qualifiesByEndOfMonthIndex).toBe(2);
  });

  it("creates archive snapshots with month-end qualification and review counts", () => {
    const months = [makeMonth(2026, 2, "H"), makeMonth(2026, 3, "D")];
    const projection: ProjectionRow = {
      name: "Alpha, Pilot, LT",
      level: "2",
      currentHours: 580,
      startTrainingMonth: 22,
      threshold: 600,
      waiver550: false,
      deploymentHours: 30,
      frtpHours: 20,
      endOfMonthHoursByMonth: [600, 630],
      trainingMonthsByMonth: ["Q", ""],
      monthlySortiesByMonth: [5, ""],
      qualifiesByEndOfMonthIndex: 0
    };

    const snapshot = createArchiveSnapshot({
      savedAt: new Date("2026-03-10T00:00:00.000Z"),
      reportMonthDate: new Date("2026-03-01T00:00:00.000Z"),
      squadron: "VP-4",
      phase: "A",
      phaseLabel: "A (VP-4,10,40,45)",
      windowLabel: "March 2026 to February 2028",
      sourceLabel: "report.xlsx",
      monthModeExact: true,
      importedCount: 10,
      eligibleCount: 5,
      reviewResults: [
        {
          name: "Alpha, Pilot, LT",
          status: "unachievable",
          message: "Needs more hours.",
          targetTrainingMonth: 24
        }
      ],
      selectedPilots: [
        {
          pilot: {
            name: "Alpha, Pilot, LT",
            level: "2",
            trainingMonth: 22,
            pilotHours: 580,
            over600: false,
            hrsPerMonthTo600: 10
          },
          settings: {
            waiver550: false,
            tttWaiver: false,
            targetTrainingMonth: 24,
            deploymentHours: 30,
            frtpHours: 20
          }
        }
      ],
      projections: [projection],
      months
    });

    expect(snapshot.reportMonthLabel).toBe("March 2026");
    expect(snapshot.qualifiedCount).toBe(1);
    expect(snapshot.reviewCount).toBe(1);
    expect(snapshot.pilots[0]?.qualificationLabel).toBe("March 2026");
    expect(snapshot.pilots[0]?.qualifiesByEndOfMonthIndex).toBe(0);
    expect(snapshot.pilots[0]?.needsReview).toBe(true);
  });

  it("summarizes month-to-month archive changes for improvement, review resolution, additions, and removals", () => {
    const previous = makeSnapshot("2026-03-01T00:00:00.000Z", [
      makeArchivedPilot({
        name: "Alpha, Pilot, LTJG",
        qualificationDate: "2026-06-01T00:00:00.000Z",
        qualificationLabel: "June 2026",
        qualifiesInWindow: true,
        qualifiesByEndOfMonthIndex: 3,
        needsReview: true,
        reviewMessage: "Watch this pilot."
      }),
      makeArchivedPilot({
        name: "Bravo, Pilot, LT",
        qualificationDate: "2026-07-01T00:00:00.000Z",
        qualificationLabel: "July 2026",
        qualifiesInWindow: true,
        qualifiesByEndOfMonthIndex: 4
      })
    ]);
    const latest = makeSnapshot("2026-04-01T00:00:00.000Z", [
      makeArchivedPilot({
        name: "Alpha, Pilot, LT",
        qualificationDate: "2026-05-01T00:00:00.000Z",
        qualificationLabel: "May 2026",
        qualifiesInWindow: true,
        qualifiesByEndOfMonthIndex: 2,
        needsReview: false
      }),
      makeArchivedPilot({
        name: "Charlie, Pilot, LT",
        qualificationDate: "2026-08-01T00:00:00.000Z",
        qualificationLabel: "August 2026",
        qualifiesInWindow: true,
        qualifiesByEndOfMonthIndex: 5
      })
    ]);

    const summary = buildArchiveTrendSummary(latest, previous);

    expect(summary.qualifiedDelta).toBe(0);
    expect(summary.reviewDelta).toBe(-1);
    expect(summary.improvedCount).toBe(1);
    expect(summary.reviewResolvedCount).toBe(1);
    expect(summary.addedCount).toBe(1);
    expect(summary.removedCount).toBe(1);
    expect(summary.notableItems.map((item) => item.type)).toEqual([
      "improved",
      "review-resolved",
      "added",
      "removed"
    ]);
  });

  it("keeps history linked across rank changes and reports earlier qualification trends", () => {
    const oldest = makeSnapshot("2026-03-01T00:00:00.000Z", [
      makeArchivedPilot({
        name: "Delta, Pilot, LTJG",
        qualificationDate: "2026-07-01T00:00:00.000Z",
        qualificationLabel: "July 2026",
        qualifiesInWindow: true,
        qualifiesByEndOfMonthIndex: 4
      })
    ]);
    const latest = makeSnapshot("2026-04-01T00:00:00.000Z", [
      makeArchivedPilot({
        name: "Delta, Pilot, LT",
        qualificationDate: "2026-05-01T00:00:00.000Z",
        qualificationLabel: "May 2026",
        qualifiesInWindow: true,
        qualifiesByEndOfMonthIndex: 2
      })
    ]);

    const analysis = buildArchiveHistoryAnalysis([latest, oldest]);

    expect(analysis.snapshotCount).toBe(2);
    expect(analysis.continuingPilotCount).toBe(1);
    expect(analysis.rankChangeCount).toBe(1);
    expect(analysis.earlierCount).toBe(1);
    expect(analysis.laterCount).toBe(0);
    expect(analysis.insights.some((insight) => insight.title === "Rank Changes")).toBe(true);
  });

  it("builds requirement rows with inclusive hours-per-month values and missing earlier selections", () => {
    const oldest = makeSnapshot("2026-03-01T00:00:00.000Z", [
      makeArchivedPilot({
        name: "Echo, Pilot, LT",
        currentHours: 560,
        startTrainingMonth: 22,
        targetTrainingMonth: 24
      })
    ]);
    const latest = makeSnapshot("2026-04-01T00:00:00.000Z", [
      makeArchivedPilot({
        name: "Echo, Pilot, LT",
        currentHours: 580,
        startTrainingMonth: 23,
        targetTrainingMonth: 24
      }),
      makeArchivedPilot({
        name: "Foxtrot, Pilot, LT",
        currentHours: 590,
        startTrainingMonth: 24,
        targetTrainingMonth: 24
      })
    ]);

    const rows = buildArchiveRequirementRows([latest, oldest]);
    const echoRow = rows.find((row) => row.identityKey === getPilotIdentityKey("Echo, Pilot, LT"));
    const foxtrotRow = rows.find((row) => row.identityKey === getPilotIdentityKey("Foxtrot, Pilot, LT"));

    expect(echoRow?.points).toHaveLength(2);
    expect(echoRow?.points[0]?.requiredHoursPerMonth).toBeCloseTo(13.3333, 3);
    expect(echoRow?.points[1]?.requiredHoursPerMonth).toBeCloseTo(10);
    expect(foxtrotRow?.points[0]?.isPresent).toBe(false);
    expect(foxtrotRow?.points[1]?.requiredHoursPerMonth).toBeCloseTo(10);
  });
});
