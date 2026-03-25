import { DEFAULT_TARGET_TRAINING_MONTH, PHASE_OPTIONS, SQUADRON_OPTIONS } from "./constants";
import { startOfMonth } from "./date";
import type { ParsedWorkbook, PilotProjectionSettings, SortiesConfig, SharpPilot } from "../types/pilot";
import { MAX_PILOTS } from "./constants";

type ExcelWorkbook = import("exceljs").Workbook;
type ExcelWorksheet = import("exceljs").Worksheet;
type ExcelCellValue = import("exceljs").CellValue;
type ExcelWorkbookInput = Parameters<ExcelWorkbook["xlsx"]["load"]>[0];
type ExcelJsRuntime = {
  Workbook: new () => ExcelWorkbook;
};

const PREFERRED_SHEET_NAMES = ["Sharp PPT Data", "Sheet1"];
const REPORT_MONTH_SCAN_MAX_ROWS = 12;
const REPORT_MONTH_SCAN_MAX_COLUMNS = 12;
const REPORT_MONTH_SHEET_PRIORITY = ["HTQ", "Sharp PPT Data", "Sheet1", "Culled Data", "Sorties"];
const KNOWN_SQUADRONS = new Set<string>(SQUADRON_OPTIONS.map((option) => option.key));

let excelJsPromise: Promise<ExcelJsRuntime> | null = null;

function loadExcelJs(): Promise<ExcelJsRuntime> {
  if (!excelJsPromise) {
    excelJsPromise = import("exceljs").then(
      (module) => (module as unknown as { default: ExcelJsRuntime }).default
    );
  }

  return excelJsPromise;
}

async function loadWorkbook(bytes: number[]): Promise<ExcelWorkbook> {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load(Uint8Array.from(bytes).buffer as ExcelWorkbookInput);

  return workbook;
}

function safeNumber(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.split(",").join("").trim();

    if (!cleaned) {
      return 0;
    }

    const parsed = Number(cleaned);

    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function safeTrainingMonth(value: unknown): number | null {
  const n = safeNumber(value);
  return n > 0 ? n : null;
}

function normalizeReportMonth(date: Date): Date {
  return startOfMonth(date);
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function normalizeCellValue(value: ExcelCellValue | undefined | null): unknown {
  if (value == null) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Date
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((part) => normalizeCellValue(part as ExcelCellValue)).join("");
  }

  if (typeof value === "object") {
    if ("result" in value && value.result != null) {
      return normalizeCellValue(value.result as ExcelCellValue);
    }

    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? "").join("");
    }

    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return typeof value.text === "string" ? value.text : value.hyperlink;
    }
  }

  return "";
}

function getSheetNames(workbook: ExcelWorkbook): string[] {
  return workbook.worksheets.map((worksheet) => worksheet.name);
}

function getWorksheet(workbook: ExcelWorkbook, sheetName: string): ExcelWorksheet | undefined {
  return workbook.getWorksheet(sheetName);
}

function getRowValues(sheet: ExcelWorksheet, rowNumber: number): unknown[] {
  const values = sheet.getRow(rowNumber).values;

  if (!Array.isArray(values)) {
    return [];
  }

  return values.slice(1).map((value) => normalizeCellValue(value as ExcelCellValue));
}

function getSheetRows(sheet: ExcelWorksheet): unknown[][] {
  const rows: unknown[][] = [];

  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    rows[rowNumber - 1] = getRowValues(sheet, rowNumber);
  }

  return rows;
}

function getCellValue(sheet: ExcelWorksheet | undefined, address: string): unknown {
  if (!sheet) {
    return "";
  }

  return normalizeCellValue(sheet.getCell(address).value as ExcelCellValue);
}

function getCellText(sheet: ExcelWorksheet | undefined, address: string): string {
  if (!sheet) {
    return "";
  }

  return sheet.getCell(address).text.trim();
}

function parseDateLikeString(value: string): Date | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const looksLikeDate =
    /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)/i.test(trimmed) ||
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(trimmed) ||
    /\b\d{4}[/-]\d{1,2}(?:[/-]\d{1,2})?\b/.test(trimmed) ||
    /\b\d{1,2}\s+\d{4}\b/.test(trimmed);

  if (!looksLikeDate) {
    return null;
  }

  const parsed = new Date(trimmed);

  if (!isValidDate(parsed)) {
    return null;
  }

  return normalizeReportMonth(parsed);
}

function parseReportMonthFromFileName(fileName: string | undefined): Date | undefined {
  if (!fileName) {
    return undefined;
  }

  const normalized = fileName.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
  const patterns = [
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s-]+\d{2,4}\b/i,
    /\b\d{4}[ -]\d{1,2}(?:[ -]\d{1,2})?\b/,
    /\b\d{1,2}[ -]\d{1,2}[ -]\d{2,4}\b/
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (!match) {
      continue;
    }

    const parsed = parseDateLikeString(match[0]);

    if (parsed) {
      return parsed;
    }
  }

  const contiguousYearMonth = normalized.match(/\b(20\d{2})(0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])?\b/);

  if (contiguousYearMonth) {
    return normalizeReportMonth(
      new Date(Number(contiguousYearMonth[1]), Number(contiguousYearMonth[2]) - 1, 1)
    );
  }

  return undefined;
}

function parseReportMonthFromWorkbook(workbook: ExcelWorkbook): Date | undefined {
  const availableSheetNames = getSheetNames(workbook);
  const orderedSheetNames = [
    ...REPORT_MONTH_SHEET_PRIORITY,
    ...availableSheetNames.filter((name) => !REPORT_MONTH_SHEET_PRIORITY.includes(name))
  ].filter((name, index, values) => values.indexOf(name) === index);

  for (const sheetName of orderedSheetNames) {
    const sheet = getWorksheet(workbook, sheetName);

    if (!sheet) {
      continue;
    }

    for (let rowIndex = 1; rowIndex <= REPORT_MONTH_SCAN_MAX_ROWS; rowIndex += 1) {
      for (let columnIndex = 1; columnIndex <= REPORT_MONTH_SCAN_MAX_COLUMNS; columnIndex += 1) {
        const cell = sheet.getCell(rowIndex, columnIndex);
        const cellValue = normalizeCellValue(cell.value as ExcelCellValue);

        if (cellValue instanceof Date && isValidDate(cellValue)) {
          return normalizeReportMonth(cellValue);
        }

        const parsedFromText = parseDateLikeString(cell.text);

        if (parsedFromText) {
          return parsedFromText;
        }

        if (typeof cellValue === "string") {
          const parsedFromValue = parseDateLikeString(cellValue);

          if (parsedFromValue) {
            return parsedFromValue;
          }
        }
      }
    }
  }

  return undefined;
}

function parseReportMonthFromWorkbookMetadata(workbook: ExcelWorkbook): Date | undefined {
  const creator = workbook.creator?.trim() ?? "";
  const lastModifiedBy = workbook.lastModifiedBy?.trim() ?? "";

  if (!creator && !lastModifiedBy) {
    return undefined;
  }

  if (workbook.created instanceof Date && isValidDate(workbook.created)) {
    return normalizeReportMonth(workbook.created);
  }

  if (workbook.modified instanceof Date && isValidDate(workbook.modified)) {
    return normalizeReportMonth(workbook.modified);
  }

  return undefined;
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

function findSharpRows(workbook: ExcelWorkbook): unknown[][] {
  const preferredMatches = PREFERRED_SHEET_NAMES
    .map((name) => getWorksheet(workbook, name))
    .filter((sheet): sheet is ExcelWorksheet => Boolean(sheet));

  const allSheets = workbook.worksheets.filter((sheet): sheet is ExcelWorksheet => Boolean(sheet));

  for (const sheet of [...preferredMatches, ...allSheets]) {
    const rows = getSheetRows(sheet);

    if (hasSharpHeaders(rows[1])) {
      return rows;
    }
  }

  throw new Error(
    `Workbook does not contain a SHARP data sheet. Available sheets: ${getSheetNames(workbook).join(", ")}`
  );
}

function parseInitialPhase(workbook: ExcelWorkbook): ParsedWorkbook["initialPhase"] {
  const phaseLabel = getCellText(getWorksheet(workbook, "HTQ"), "D26");

  return PHASE_OPTIONS.find((option) => option.label === phaseLabel)?.key;
}

function parseInitialSquadron(data: unknown[][]): ParsedWorkbook["initialSquadron"] {
  const counts = new Map<string, number>();

  for (const row of data.slice(2, 2 + MAX_PILOTS)) {
    const squadron = String(row?.[3] ?? "").trim().toUpperCase();

    if (!KNOWN_SQUADRONS.has(squadron)) {
      continue;
    }

    counts.set(squadron, (counts.get(squadron) ?? 0) + 1);
  }

  let bestSquadron: string | undefined;
  let bestCount = 0;

  for (const [squadron, count] of counts.entries()) {
    if (count > bestCount) {
      bestSquadron = squadron;
      bestCount = count;
    }
  }

  return bestSquadron;
}

function parseInitialMonthModeExact(workbook: ExcelWorkbook): boolean | undefined {
  const value = getCellText(getWorksheet(workbook, "Culled Data"), "L1").toUpperCase();

  if (value === "YES") {
    return true;
  }

  if (value === "NO") {
    return false;
  }

  return undefined;
}

function parseInitialPilotSettings(
  workbook: ExcelWorkbook
): Pick<ParsedWorkbook, "initialSelectedNames" | "initialPilotSettings"> {
  const sheet = getWorksheet(workbook, "HTQ");

  if (!sheet) {
    return {};
  }

  const initialSelectedNames: string[] = [];
  const initialPilotSettings: Record<string, PilotProjectionSettings> = {};

  for (let rowNumber = 29; rowNumber <= 44; rowNumber += 1) {
    const name = String(getCellValue(sheet, `D${rowNumber}`)).trim();

    if (!name) {
      continue;
    }

    initialSelectedNames.push(name);
    initialPilotSettings[name] = {
      waiver550: String(getCellValue(sheet, `A${rowNumber}`)).trim().toUpperCase() === "Y",
      tttWaiver: false,
      targetTrainingMonth: DEFAULT_TARGET_TRAINING_MONTH,
      deploymentHours: safeNumber(getCellValue(sheet, `B${rowNumber}`)),
      frtpHours: safeNumber(getCellValue(sheet, `C${rowNumber}`))
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

function parseInitialSortiesConfig(workbook: ExcelWorkbook): SortiesConfig | undefined {
  const sheet = getWorksheet(workbook, "Sorties");

  if (!sheet) {
    return undefined;
  }

  const averageHomeCycleSortieLength = safeNumber(getCellValue(sheet, "E28"));
  const averageDeploymentSortieLength = safeNumber(getCellValue(sheet, "E29"));
  const numberOfPilots = safeNumber(getCellValue(sheet, "O29"));

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

export async function parseSharpWorkbookBytes(bytes: number[]): Promise<SharpPilot[]> {
  const workbook = await loadWorkbook(bytes);

  return parseSharpRows(findSharpRows(workbook));
}

export async function parseWorkbookBytes(bytes: number[], fileName?: string): Promise<ParsedWorkbook> {
  const workbook = await loadWorkbook(bytes);
  const sharpData = findSharpRows(workbook);
  const pilots = parseSharpRows(sharpData);
  const reportMonthDate =
    parseReportMonthFromWorkbook(workbook) ??
    parseReportMonthFromFileName(fileName) ??
    parseReportMonthFromWorkbookMetadata(workbook);

  return {
    pilots,
    reportMonthDate,
    initialSquadron: parseInitialSquadron(sharpData),
    initialPhase: parseInitialPhase(workbook),
    initialMonthModeExact: parseInitialMonthModeExact(workbook),
    ...parseInitialPilotSettings(workbook),
    initialSortiesConfig: parseInitialSortiesConfig(workbook)
  };
}
