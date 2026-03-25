import type { PilotProjectionSettings, SharpPilot } from "../types/pilot";

const WORKSPACE_STORAGE_KEY = "htq-workspace-state-v1";

export type PersistedWorkspaceTab = "pilots" | "forecast" | "sorties" | "history";

export type PersistedWorkspaceState = {
  selectedSquadron: string;
  monthModeExact: boolean;
  reportMonthNeedsReview: boolean;
  reviewTrackingEnabled: boolean;
  sharpRows: SharpPilot[];
  selectedNames: string[];
  pilotSettings: Record<string, PilotProjectionSettings>;
  sourceLabel: string;
  projectionBaseDate: string;
  averageHomeCycleSortieLength: number;
  averageDeploymentSortieLength: number;
  numberOfPilots: number;
  activeWorkspaceTab: PersistedWorkspaceTab;
};

function isWorkspaceTab(value: unknown): value is PersistedWorkspaceTab {
  return value === "pilots" || value === "forecast" || value === "sorties" || value === "history";
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function loadPersistedWorkspaceState(): PersistedWorkspaceState | null {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedWorkspaceState>;

    if (
      typeof parsed.selectedSquadron !== "string" ||
      typeof parsed.monthModeExact !== "boolean" ||
      !Array.isArray(parsed.sharpRows) ||
      !Array.isArray(parsed.selectedNames) ||
      typeof parsed.pilotSettings !== "object" ||
      parsed.pilotSettings == null ||
      typeof parsed.sourceLabel !== "string" ||
      !isValidDateString(parsed.projectionBaseDate) ||
      typeof parsed.averageHomeCycleSortieLength !== "number" ||
      typeof parsed.averageDeploymentSortieLength !== "number" ||
      typeof parsed.numberOfPilots !== "number" ||
      !isWorkspaceTab(parsed.activeWorkspaceTab)
    ) {
      return null;
    }

    return {
      selectedSquadron: parsed.selectedSquadron,
      monthModeExact: parsed.monthModeExact,
      reportMonthNeedsReview: parsed.reportMonthNeedsReview ?? false,
      reviewTrackingEnabled: parsed.reviewTrackingEnabled ?? false,
      sharpRows: parsed.sharpRows,
      selectedNames: parsed.selectedNames,
      pilotSettings: parsed.pilotSettings,
      sourceLabel: parsed.sourceLabel,
      projectionBaseDate: parsed.projectionBaseDate,
      averageHomeCycleSortieLength: parsed.averageHomeCycleSortieLength,
      averageDeploymentSortieLength: parsed.averageDeploymentSortieLength,
      numberOfPilots: parsed.numberOfPilots,
      activeWorkspaceTab: parsed.activeWorkspaceTab
    };
  } catch {
    return null;
  }
}

export function persistWorkspaceState(state: PersistedWorkspaceState): void {
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore local storage failures so the app remains usable.
  }
}

export function clearPersistedWorkspaceState(): void {
  try {
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // Ignore local storage failures so the app remains usable.
  }
}
