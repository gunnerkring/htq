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
const BASE_PHASE_CYCLE = expandPhaseRuns([
  ["D", 6],
  ["H", 12]
]);
const BASE_PHASE_CYCLE_LENGTH = BASE_PHASE_CYCLE.length;

// Each phase is a different entry point into the same repeating 6-month deployment /
// 12-month homecycle rhythm.
const PHASE_START_OFFSETS: Record<PhaseKey, number> = {
  A: 4,
  B: 16,
  C: 10
};

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function buildProjectionMonths(phase: PhaseKey, baseDate: Date): ProjectionMonthsResult {
  const projectionStart = startOfMonth(baseDate);
  const startOffset = monthDiff(PHASE_SCHEDULE_START, projectionStart);

  const phaseStartOffset = PHASE_START_OFFSETS[phase];
  const months = Array.from({ length: PROJECTION_MONTHS }, (_, index) => {
    const date = addMonths(projectionStart, index);
    const cycleIndex = modulo(phaseStartOffset + startOffset + index, BASE_PHASE_CYCLE_LENGTH);

    return {
      date,
      monthLabel: monthLabel(date),
      yearLabel: yearLabel(date),
      cycle: BASE_PHASE_CYCLE[cycleIndex]
    };
  });

  return { months, error: null };
}
