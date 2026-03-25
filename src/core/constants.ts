import type { PhaseKey } from "../types/pilot";

export const QUAL_HOURS = 600;
export const WAIVER_QUAL_HOURS = 550;
export const MAX_PILOTS = 39;
export const PROJECTION_MONTHS = 24;
export const DEFAULT_DEPLOYMENT_HOURS = 40;
export const DEFAULT_HOMECYCLE_HOURS = 20;
export const MIN_DEPLOYMENT_HOURS = 20;
export const MAX_DEPLOYMENT_HOURS = 60;
export const MIN_HOMECYCLE_HOURS = 10;
export const MAX_HOMECYCLE_HOURS = 20;
export const MIN_TARGET_TRAINING_MONTH = 16;
export const DEFAULT_TARGET_TRAINING_MONTH = 24;
export const MAX_TTT_TARGET_TRAINING_MONTH = 27;
export const DEFAULT_HOME_CYCLE_SORTIE_LENGTH = 6;
export const DEFAULT_DEPLOYMENT_SORTIE_LENGTH = 8;
export const DEFAULT_SORTIE_PILOT_COUNT = 3;
export const PHASE_SCHEDULE_START_YEAR = 2026;
export const PHASE_SCHEDULE_START_MONTH = 1;

export const PHASE_OPTIONS = [
  { key: "A", label: "A (VP-4,10,40,45)", squadrons: ["VP-4", "VP-10", "VP-40", "VP-45"] },
  { key: "B", label: "B (VP-1,16,26,47)", squadrons: ["VP-1", "VP-16", "VP-26", "VP-47"] },
  { key: "C", label: "C (VP-5,8,9,46)", squadrons: ["VP-5", "VP-8", "VP-9", "VP-46"] }
] as const;

export const PHASE_LABELS: Record<PhaseKey, string> = Object.fromEntries(
  PHASE_OPTIONS.map((option) => [option.key, option.label])
) as Record<PhaseKey, string>;

export const SQUADRON_OPTIONS = PHASE_OPTIONS.flatMap((option) =>
  option.squadrons.map((squadron) => ({
    key: squadron,
    label: squadron,
    phase: option.key
  }))
);

export const DEFAULT_SQUADRON = SQUADRON_OPTIONS[0].key;

export const DEFAULT_SQUADRON_BY_PHASE: Record<PhaseKey, string> = Object.fromEntries(
  PHASE_OPTIONS.map((option) => [option.key, option.squadrons[0]])
) as Record<PhaseKey, string>;

export function getPhaseForSquadron(squadron: string): PhaseKey {
  return SQUADRON_OPTIONS.find((option) => option.key === squadron)?.phase ?? "A";
}
