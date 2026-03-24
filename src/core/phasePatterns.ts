import {
  PHASE_SCHEDULE_START_MONTH,
  PHASE_SCHEDULE_START_YEAR,
  PROJECTION_MONTHS
} from "./constants";
import { addMonths, monthDiff, monthLabel, startOfMonth, yearLabel } from "./date";
import type { PhaseCycleCode, PhaseKey, ProjectionMonth } from "../types/pilot";

type ProjectionMonthsResult = {
  months: ProjectionMonth[];
  error: string | null;
};

function expandPhaseRuns(runs: Array<[PhaseCycleCode, number]>): PhaseCycleCode[] {
  return runs.flatMap(([value, count]) => Array.from({ length: count }, () => value));
}

const PHASE_SCHEDULE_START = new Date(PHASE_SCHEDULE_START_YEAR, PHASE_SCHEDULE_START_MONTH, 1);

const PHASE_CALENDARS: Record<PhaseKey, PhaseCycleCode[]> = {
  A: expandPhaseRuns([
    ["D", 2],
    ["H", 12],
    ["D", 6],
    ["H", 12],
    ["D", 6],
    ["H", 12]
  ]),
  B: expandPhaseRuns([
    ["H", 2],
    ["D", 6],
    ["H", 12],
    ["D", 6],
    ["H", 12],
    ["D", 6],
    ["H", 6]
  ]),
  C: expandPhaseRuns([
    ["H", 8],
    ["D", 6],
    ["H", 12],
    ["D", 6],
    ["H", 12],
    ["D", 3],
    ["H", 3]
  ])
};

function formatSupportedWindowBoundary(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

export function buildProjectionMonths(phase: PhaseKey, baseDate: Date): ProjectionMonthsResult {
  const projectionStart = startOfMonth(baseDate);
  const calendar = PHASE_CALENDARS[phase];
  const startOffset = monthDiff(PHASE_SCHEDULE_START, projectionStart);
  const lastSupportedOffset = calendar.length - PROJECTION_MONTHS;

  if (startOffset < 0 || startOffset > lastSupportedOffset) {
    const firstSupportedMonth = PHASE_SCHEDULE_START;
    const lastSupportedMonth = addMonths(PHASE_SCHEDULE_START, lastSupportedOffset);

    return {
      months: [],
      error: `The workbook phase calendar only supports projection start months from ${formatSupportedWindowBoundary(firstSupportedMonth)} through ${formatSupportedWindowBoundary(lastSupportedMonth)}.`
    };
  }

  const months = Array.from({ length: PROJECTION_MONTHS }, (_, index) => {
    const date = addMonths(projectionStart, index);

    return {
      date,
      monthLabel: monthLabel(date),
      yearLabel: yearLabel(date),
      cycle: calendar[startOffset + index]
    };
  });

  return { months, error: null };
}
