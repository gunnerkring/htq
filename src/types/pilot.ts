export type PhaseKey = "A" | "B" | "C";
export type PhaseCycleCode = "D" | "H";

export type SharpPilot = {
  name: string;
  level: string;
  trainingMonth: number | null;
  pilotHours: number;
};

export type CulledPilot = SharpPilot & {
  over600: boolean;
  hrsPerMonthTo600: number | null;
};

export type PilotProjectionSettings = {
  waiver550: boolean;
  tttWaiver: boolean;
  targetTrainingMonth: number;
  deploymentHours: number;
  frtpHours: number;
};

export type AutoCalcResultStatus =
  | "calculated"
  | "missing-training-month"
  | "past-target-month"
  | "out-of-window"
  | "unachievable";

export type AutoCalcResult = {
  name: string;
  status: AutoCalcResultStatus;
  message: string;
  targetTrainingMonth: number;
};

export type SortiesConfig = {
  averageHomeCycleSortieLength: number;
  averageDeploymentSortieLength: number;
  numberOfPilots: number;
};

export type ProjectionMonth = {
  date: Date;
  monthLabel: string;
  yearLabel: string;
  cycle: PhaseCycleCode;
};

export type ProjectionRow = {
  name: string;
  level: string;
  currentHours: number;
  startTrainingMonth: number | null;
  threshold: number;
  waiver550: boolean;
  deploymentHours: number;
  frtpHours: number;
  endOfMonthHoursByMonth: number[];
  trainingMonthsByMonth: (number | "Q" | "")[];
  monthlySortiesByMonth: (number | "")[];
  qualifiesByEndOfMonthIndex: number | null;
};

export type ParsedWorkbook = {
  pilots: SharpPilot[];
  reportMonthDate?: Date;
  reportMonthNeedsReview?: boolean;
  initialSquadron?: string;
  initialPhase?: PhaseKey;
  initialMonthModeExact?: boolean;
  initialSelectedNames?: string[];
  initialPilotSettings?: Record<string, PilotProjectionSettings>;
  initialSortiesConfig?: SortiesConfig;
};

declare global {
  interface Window {
    htqApi: {
      openWorkbook: () => Promise<{
        fileName: string;
        filePath: string;
        parsedWorkbook: ParsedWorkbook;
      } | null>;
      saveCsv: (payload: { suggestedName: string; content: string }) => Promise<{
        saved: boolean;
        filePath?: string;
      }>;
      savePdf: (payload: { suggestedName: string; html: string }) => Promise<{
        saved: boolean;
        filePath?: string;
      }>;
    };
  }
}
