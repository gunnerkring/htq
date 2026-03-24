import * as XLSX from "xlsx";
import { DEFAULT_TARGET_TRAINING_MONTH, PHASE_OPTIONS } from "./constants";
import type { ParsedWorkbook, PilotProjectionSettings, SortiesConfig, SharpPilot } from "../types/pilot";
import { MAX_PILOTS } from "./constants";

const PREFERRED_SHEET_NAMES = ["Sharp PPT Data", "Sheet1"];

function safeNumber(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.split(",").join("").trim();
    if (!cleaned) return 0;
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function safeTrainingMonth(value: unknown): number | null {
  const n = safeNumber(value);
  return n > 0 ? n : null;
}

function hasSharpHeaders(row: unknown[] | undefined): boolean {
  if (!row) {
    return false;
  }

  return (
    String(row[0] ?? "").trim() === "Name" &&
    String(row[2] ?? "").trim() === "Actc" &&
    String(row[4] ?? "").trim() === "Month(s) In Unit" &&
    String(row[6] ?? "").trim() === "Career Flight Time"
  );
}

function findSharpRows(workbook: XLSX.WorkBook): unknown[][] {
  const preferredMatches = PREFERRED_SHEET_NAMES
    .map((name) => workbook.Sheets[name])
    .filter((sheet): sheet is XLSX.WorkSheet => Boolean(sheet));

  const allSheets = workbook.SheetNames
    .map((name) => workbook.Sheets[name])
    .filter((sheet): sheet is XLSX.WorkSheet => Boolean(sheet));

  for (const sheet of [...preferredMatches, ...allSheets]) {
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: ""
    }) as unknown[][];

    if (hasSharpHeaders(rows[1])) {
      return rows;
    }
  }

  throw new Error(
    `Workbook does not contain a SHARP data sheet. Available sheets: ${workbook.SheetNames.join(", ")}`
  );
}

function parseInitialPhase(workbook: XLSX.WorkBook): ParsedWorkbook["initialPhase"] {
  const phaseLabel = String(workbook.Sheets["HTQ"]?.D26?.v ?? "").trim();
  return PHASE_OPTIONS.find((option) => option.label === phaseLabel)?.key;
}

function parseInitialMonthModeExact(workbook: XLSX.WorkBook): boolean | undefined {
  const value = String(workbook.Sheets["Culled Data"]?.L1?.v ?? "").trim().toUpperCase();

  if (value === "YES") return true;
  if (value === "NO") return false;

  return undefined;
}

function parseInitialPilotSettings(
  workbook: XLSX.WorkBook
): Pick<ParsedWorkbook, "initialSelectedNames" | "initialPilotSettings"> {
  const sheet = workbook.Sheets["HTQ"];

  if (!sheet) {
    return {};
  }

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: ""
  }) as unknown[][];

  const initialSelectedNames: string[] = [];
  const initialPilotSettings: Record<string, PilotProjectionSettings> = {};

  for (let rowIndex = 28; rowIndex <= 43; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const name = String(row[3] ?? "").trim();

    if (!name) {
      continue;
    }

    initialSelectedNames.push(name);
    initialPilotSettings[name] = {
      waiver550: String(row[0] ?? "").trim().toUpperCase() === "Y",
      tttWaiver: false,
      targetTrainingMonth: DEFAULT_TARGET_TRAINING_MONTH,
      deploymentHours: safeNumber(row[1]),
      frtpHours: safeNumber(row[2])
    };
  }

  if (initialSelectedNames.length === 0) {
    return {};
  }

  return {
    initialSelectedNames,
    initialPilotSettings
  };
}

function parseInitialSortiesConfig(workbook: XLSX.WorkBook): SortiesConfig | undefined {
  const sheet = workbook.Sheets["Sorties"];

  if (!sheet) {
    return undefined;
  }

  const averageHomeCycleSortieLength = safeNumber(sheet.E28?.v);
  const averageDeploymentSortieLength = safeNumber(sheet.E29?.v);
  const numberOfPilots = safeNumber(sheet.O29?.v);

  if (
    averageHomeCycleSortieLength <= 0 ||
    averageDeploymentSortieLength <= 0 ||
    numberOfPilots <= 0
  ) {
    return undefined;
  }

  return {
    averageHomeCycleSortieLength,
    averageDeploymentSortieLength,
    numberOfPilots
  };
}

function parseSharpRows(data: unknown[][]): SharpPilot[] {
  const rows = data.slice(2, 2 + MAX_PILOTS);

  return rows
    .map((row) => ({
      name: String(row?.[0] ?? "").trim(),
      level: String(row?.[2] ?? "").trim(),
      trainingMonth: safeTrainingMonth(row?.[4]),
      pilotHours: safeNumber(row?.[6])
    }))
    .filter((pilot) => pilot.name.length > 0);
}

export function parseSharpWorkbookBytes(bytes: number[]): SharpPilot[] {
  const workbook = XLSX.read(Uint8Array.from(bytes), { type: "array" });
  return parseSharpRows(findSharpRows(workbook));
}

export function parseWorkbookBytes(bytes: number[]): ParsedWorkbook {
  const workbook = XLSX.read(Uint8Array.from(bytes), { type: "array" });
  const pilots = parseSharpRows(findSharpRows(workbook));

  return {
    pilots,
    initialPhase: parseInitialPhase(workbook),
    initialMonthModeExact: parseInitialMonthModeExact(workbook),
    ...parseInitialPilotSettings(workbook),
    initialSortiesConfig: parseInitialSortiesConfig(workbook)
  };
}
