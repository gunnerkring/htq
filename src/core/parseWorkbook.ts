import * as XLSX from "xlsx";
import {
  DEFAULT_TARGET_TRAINING_MONTH,
  MAX_PILOTS,
  PHASE_OPTIONS,
  SQUADRON_OPTIONS
} from "./constants";
import { startOfMonth } from "./date";
import type { ParsedWorkbook, PilotProjectionSettings, SortiesConfig, SharpPilot } from "../types/pilot";

type WorkbookProps = {
  Author?: string;
  LastAuthor?: string;
  CreatedDate?: Date;
  ModifiedDate?: Date;
};

type SourceSheet = {
  name: string;
  worksheet: XLSX.WorkSheet;
  rows: unknown[][];
};

type SourceWorkbook = {
  props: WorkbookProps;
  sheetNames: string[];
  sheets: Map<string, SourceSheet>;
};

type ReportMonthResolution = {
  date?: Date;
  needsReview: boolean;
};

const PREFERRED_SHEET_NAMES = ["Sharp PPT Data", "Sheet1", "DataSet1"];
const REPORT_MONTH_SCAN_MAX_ROWS = 12;
const REPORT_MONTH_SCAN_MAX_COLUMNS = 12;
const REPORT_MONTH_SHEET_PRIORITY = ["HTQ", "Sharp PPT Data", "Sheet1", "DataSet1", "Culled Data", "Sorties"];
const KNOWN_SQUADRONS = new Set<string>(SQUADRON_OPTIONS.map((option) => option.key));
const MONTH_NAME_PATTERNS: Array<{ pattern: RegExp; monthIndex: number }> = [
  { pattern: /^jan(?:uary)?$/i, monthIndex: 0 },
  { pattern: /^feb(?:ruary)?$/i, monthIndex: 1 },
  { pattern: /^mar(?:ch)?$/i, monthIndex: 2 },
  { pattern: /^apr(?:il)?$/i, monthIndex: 3 },
  { pattern: /^may$/i, monthIndex: 4 },
  { pattern: /^jun(?:e)?$/i, monthIndex: 5 },
  { pattern: /^jul(?:y)?$/i, monthIndex: 6 },
  { pattern: /^aug(?:ust)?$/i, monthIndex: 7 },
  { pattern: /^sep(?:t|tember)?$/i, monthIndex: 8 },
  { pattern: /^oct(?:ober)?$/i, monthIndex: 9 },
  { pattern: /^nov(?:ember)?$/i, monthIndex: 10 },
  { pattern: /^dec(?:ember)?$/i, monthIndex: 11 }
];

function buildSourceWorkbook(workbook: XLSX.WorkBook): SourceWorkbook {
  const sheetNames = workbook.SheetNames.slice();
  const sheets = new Map<string, SourceSheet>();

  for (const name of sheetNames) {
    const worksheet = workbook.Sheets[name];

    if (!worksheet) {
      continue;
    }

    sheets.set(name, {
      name,
      worksheet,
      rows: XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: true,
        defval: ""
      }) as unknown[][]
    });
  }

  return {
    props: (workbook.Props ?? {}) as WorkbookProps,
    sheetNames,
    sheets
  };
}

function loadWorkbook(bytes: number[]): SourceWorkbook {
  const workbook = XLSX.read(Uint8Array.from(bytes), {
    type: "array",
    cellDates: true
  });

  return buildSourceWorkbook(workbook);
}

function loadWorkbookFromFile(filePath: string): SourceWorkbook {
  const workbook = XLSX.readFile(filePath, {
    cellDates: true
  });

  return buildSourceWorkbook(workbook);
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
  if (typeof value === "number") {
    return !Number.isNaN(value) && value >= 0 ? value : null;
  }

  if (typeof value === "string") {
    const cleaned = value.trim();

    if (!cleaned) {
      return null;
    }

    const parsed = Number(cleaned);

    return !Number.isNaN(parsed) && parsed >= 0 ? parsed : null;
  }

  return null;
}

function normalizeReportMonth(date: Date): Date {
  return startOfMonth(date);
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function normalizeCellValue(value: unknown): unknown {
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
    return value.map((part) => normalizeCellValue(part)).join("");
  }

  return "";
}

function getSheetNames(workbook: SourceWorkbook): string[] {
  return workbook.sheetNames;
}

function getWorksheet(workbook: SourceWorkbook, sheetName: string): SourceSheet | undefined {
  return workbook.sheets.get(sheetName);
}

function getRowValues(sheet: SourceSheet, rowNumber: number): unknown[] {
  return (sheet.rows[rowNumber - 1] ?? []).map((value) => normalizeCellValue(value));
}

function getSheetRows(sheet: SourceSheet): unknown[][] {
  return sheet.rows.map((row) => row.map((value) => normalizeCellValue(value)));
}

function getCell(sheet: SourceSheet | undefined, address: string): XLSX.CellObject | undefined {
  if (!sheet) {
    return undefined;
  }

  return sheet.worksheet[address];
}

function getCellValue(sheet: SourceSheet | undefined, address: string): unknown {
  return normalizeCellValue(getCell(sheet, address)?.v);
}

function getCellText(sheet: SourceSheet | undefined, address: string): string {
  const cell = getCell(sheet, address);

  if (!cell) {
    return "";
  }

  if (typeof cell.w === "string" && cell.w.trim()) {
    return cell.w.trim();
  }

  const normalized = normalizeCellValue(cell.v);

  if (normalized instanceof Date) {
    return normalized.toISOString();
  }

  return String(normalized ?? "").trim();
}

function parseDateLikeString(value: string): Date | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const looksLikeDate =
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[\s-]+\d{2,4}\b/i.test(
      trimmed
    ) ||
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}\b/i.test(
      trimmed
    ) ||
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

function parseMonthOnlyString(value: string, referenceDate: Date): Date | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const match = MONTH_NAME_PATTERNS.find(({ pattern }) => pattern.test(trimmed));

  if (!match) {
    return null;
  }

  const referenceMonth = startOfMonth(referenceDate);
  const inferredYear =
    match.monthIndex > referenceMonth.getMonth()
      ? referenceMonth.getFullYear() - 1
      : referenceMonth.getFullYear();

  return new Date(inferredYear, match.monthIndex, 1);
}

function parseReportMonthFromFileName(
  fileName: string | undefined,
  referenceDate: Date,
  allowMonthOnly = false
): Date | undefined {
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

  const monthOnlyMatch = normalized.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i
  );

  if (allowMonthOnly && monthOnlyMatch) {
    return parseMonthOnlyString(monthOnlyMatch[1], referenceDate) ?? undefined;
  }

  return undefined;
}

function parseReportMonthFromWorkbook(
  workbook: SourceWorkbook,
  referenceDate: Date,
  allowMonthOnly = false
): Date | undefined {
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
        const address = XLSX.utils.encode_cell({ r: rowIndex - 1, c: columnIndex - 1 });
        const cell = getCell(sheet, address);
        const cellValue = normalizeCellValue(cell?.v);

        if (cellValue instanceof Date && isValidDate(cellValue)) {
          return normalizeReportMonth(cellValue);
        }

        const parsedFromText = parseDateLikeString(getCellText(sheet, address));

        if (parsedFromText) {
          return parsedFromText;
        }

        const inferredFromMonthOnlyText = allowMonthOnly
          ? parseMonthOnlyString(getCellText(sheet, address), referenceDate)
          : null;

        if (inferredFromMonthOnlyText) {
          return inferredFromMonthOnlyText;
        }

        if (typeof cellValue === "string") {
          const parsedFromValue = parseDateLikeString(cellValue);

          if (parsedFromValue) {
            return parsedFromValue;
          }

          const inferredFromMonthOnlyValue = allowMonthOnly
            ? parseMonthOnlyString(cellValue, referenceDate)
            : null;

          if (inferredFromMonthOnlyValue) {
            return inferredFromMonthOnlyValue;
          }
        }
      }
    }
  }

  return undefined;
}

function parseReportMonthFromWorkbookMetadata(workbook: SourceWorkbook): Date | undefined {
  const creator = workbook.props.Author?.trim() ?? "";
  const lastModifiedBy = workbook.props.LastAuthor?.trim() ?? "";

  if (!creator && !lastModifiedBy) {
    return undefined;
  }

  if (workbook.props.CreatedDate instanceof Date && isValidDate(workbook.props.CreatedDate)) {
    return normalizeReportMonth(workbook.props.CreatedDate);
  }

  if (workbook.props.ModifiedDate instanceof Date && isValidDate(workbook.props.ModifiedDate)) {
    return normalizeReportMonth(workbook.props.ModifiedDate);
  }

  return undefined;
}

function resolveReportMonth(
  workbook: SourceWorkbook,
  fileName: string | undefined,
  referenceDate: Date
): ReportMonthResolution {
  const explicitWorkbookDate = parseReportMonthFromWorkbook(workbook, referenceDate);

  if (explicitWorkbookDate) {
    return {
      date: explicitWorkbookDate,
      needsReview: false
    };
  }

  const explicitFileNameDate = parseReportMonthFromFileName(fileName, referenceDate);

  if (explicitFileNameDate) {
    return {
      date: explicitFileNameDate,
      needsReview: false
    };
  }

  const inferredWorkbookDate = parseReportMonthFromWorkbook(workbook, referenceDate, true);

  if (inferredWorkbookDate) {
    return {
      date: inferredWorkbookDate,
      needsReview: true
    };
  }

  const inferredFileNameDate = parseReportMonthFromFileName(fileName, referenceDate, true);

  if (inferredFileNameDate) {
    return {
      date: inferredFileNameDate,
      needsReview: true
    };
  }

  const metadataDate = parseReportMonthFromWorkbookMetadata(workbook);

  if (metadataDate) {
    return {
      date: metadataDate,
      needsReview: true
    };
  }

  return {
    needsReview: true
  };
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

function findSharpRows(workbook: SourceWorkbook): unknown[][] {
  const preferredMatches = PREFERRED_SHEET_NAMES
    .map((name) => getWorksheet(workbook, name))
    .filter((sheet): sheet is SourceSheet => Boolean(sheet));

  const allSheets = workbook.sheetNames
    .map((name) => getWorksheet(workbook, name))
    .filter((sheet): sheet is SourceSheet => Boolean(sheet));

  for (const sheet of [...preferredMatches, ...allSheets]) {
    const rows = getSheetRows(sheet);

    const headerRowIndex = rows.findIndex((row) => hasSharpHeaders(row));

    if (headerRowIndex >= 0) {
      return rows.slice(headerRowIndex);
    }
  }

  throw new Error(
    `Workbook does not contain a SHARP data sheet. Available sheets: ${getSheetNames(workbook).join(", ")}`
  );
}

function parseInitialPhase(workbook: SourceWorkbook): ParsedWorkbook["initialPhase"] {
  const phaseLabel = String(getCellValue(getWorksheet(workbook, "HTQ"), "D26")).trim();

  return PHASE_OPTIONS.find((option) => option.label === phaseLabel)?.key;
}

function parseInitialSquadron(data: unknown[][]): ParsedWorkbook["initialSquadron"] {
  const counts = new Map<string, number>();

  for (const row of data.slice(1, 1 + MAX_PILOTS)) {
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

function parseInitialMonthModeExact(workbook: SourceWorkbook): boolean | undefined {
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
  workbook: SourceWorkbook
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

function parseInitialSortiesConfig(workbook: SourceWorkbook): SortiesConfig | undefined {
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
  const rows = data.slice(1, 1 + MAX_PILOTS);

  return rows
    .map((row) => ({
      name: String(row?.[0] ?? "").trim(),
      level: String(row?.[2] ?? "").trim(),
      trainingMonth: safeTrainingMonth(row?.[4]),
      pilotHours: safeNumber(row?.[6])
    }))
    .filter((pilot) => pilot.name.length > 0);
}

function parseWorkbook(
  workbook: SourceWorkbook,
  fileName?: string,
  referenceDate = new Date()
): ParsedWorkbook {
  const sharpData = findSharpRows(workbook);
  const pilots = parseSharpRows(sharpData);
  const reportMonth = resolveReportMonth(workbook, fileName, referenceDate);

  return {
    pilots,
    reportMonthDate: reportMonth.date,
    reportMonthNeedsReview: reportMonth.needsReview,
    initialSquadron: parseInitialSquadron(sharpData),
    initialPhase: parseInitialPhase(workbook),
    initialMonthModeExact: parseInitialMonthModeExact(workbook),
    ...parseInitialPilotSettings(workbook),
    initialSortiesConfig: parseInitialSortiesConfig(workbook)
  };
}

export async function parseSharpWorkbookBytes(bytes: number[]): Promise<SharpPilot[]> {
  const workbook = loadWorkbook(bytes);

  return parseSharpRows(findSharpRows(workbook));
}

export async function parseWorkbookBytes(
  bytes: number[],
  fileName?: string,
  referenceDate = new Date()
): Promise<ParsedWorkbook> {
  const workbook = loadWorkbook(bytes);
  return parseWorkbook(workbook, fileName, referenceDate);
}

export async function parseWorkbookFile(
  filePath: string,
  fileName?: string,
  referenceDate = new Date()
): Promise<ParsedWorkbook> {
  const workbook = loadWorkbookFromFile(filePath);
  return parseWorkbook(workbook, fileName, referenceDate);
}
