import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseWorkbookBytes } from "./parseWorkbook";

function toByteArray(buffer: Awaited<ReturnType<ExcelJS.Workbook["xlsx"]["writeBuffer"]>>): number[] {
  return Array.from(new Uint8Array(buffer));
}

function expectMonth(date: Date | undefined, year: number, monthIndex: number) {
  expect(date).toBeInstanceOf(Date);
  expect(date?.getFullYear()).toBe(year);
  expect(date?.getMonth()).toBe(monthIndex);
  expect(date?.getDate()).toBe(1);
}

describe("parseWorkbookBytes", () => {
  it("parses the workbook selections, sorties settings, and report month", async () => {
    const workbook = new ExcelJS.Workbook();
    const sharpSheet = workbook.addWorksheet("Sharp PPT Data");
    const htqSheet = workbook.addWorksheet("HTQ");
    const culledSheet = workbook.addWorksheet("Culled Data");
    const sortiesSheet = workbook.addWorksheet("Sorties");

    sharpSheet.getCell("A2").value = "Name";
    sharpSheet.getCell("C2").value = "Actc";
    sharpSheet.getCell("E2").value = "Month(s) In Unit";
    sharpSheet.getCell("G2").value = "Career Flight Time";
    sharpSheet.getCell("A3").value = "Stivaletta, Sean P, LT";
    sharpSheet.getCell("C3").value = "2P";
    sharpSheet.getCell("D3").value = "VP-10";
    sharpSheet.getCell("E3").value = 22;
    sharpSheet.getCell("G3").value = 535.3;
    sharpSheet.getCell("A4").value = "Baker, Adam R, LT";
    sharpSheet.getCell("C4").value = "2P";
    sharpSheet.getCell("D4").value = "VP-10";
    sharpSheet.getCell("E4").value = 18;
    sharpSheet.getCell("G4").value = 430.5;

    htqSheet.getCell("A1").value = new Date(2026, 2, 1);
    htqSheet.getCell("D26").value = "A (VP-4,10,40,45)";
    htqSheet.getCell("A29").value = "Y";
    htqSheet.getCell("B29").value = 45;
    htqSheet.getCell("C29").value = 10;
    htqSheet.getCell("D29").value = "Stivaletta, Sean P, LT";

    culledSheet.getCell("L1").value = "YES";

    sortiesSheet.getCell("E28").value = 6;
    sortiesSheet.getCell("E29").value = 8;
    sortiesSheet.getCell("O29").value = 3;

    const parsed = await parseWorkbookBytes(
      toByteArray(await workbook.xlsx.writeBuffer()),
      "sharp_mar_2026.xlsx"
    );

    expect(parsed.pilots).toEqual([
      {
        name: "Stivaletta, Sean P, LT",
        level: "2P",
        trainingMonth: 22,
        pilotHours: 535.3
      },
      {
        name: "Baker, Adam R, LT",
        level: "2P",
        trainingMonth: 18,
        pilotHours: 430.5
      }
    ]);
    expectMonth(parsed.reportMonthDate, 2026, 2);
    expect(parsed.initialSquadron).toBe("VP-10");
    expect(parsed.initialPhase).toBe("A");
    expect(parsed.initialMonthModeExact).toBe(true);
    expect(parsed.initialSelectedNames).toEqual(["Stivaletta, Sean P, LT"]);
    expect(parsed.initialPilotSettings).toEqual({
      "Stivaletta, Sean P, LT": {
        waiver550: true,
        tttWaiver: false,
        targetTrainingMonth: 24,
        deploymentHours: 45,
        frtpHours: 10
      }
    });
    expect(parsed.initialSortiesConfig).toEqual({
      averageHomeCycleSortieLength: 6,
      averageDeploymentSortieLength: 8,
      numberOfPilots: 3
    });
  });

  it("falls back to the filename when the workbook does not expose a report month", async () => {
    const workbook = new ExcelJS.Workbook();
    const sharpSheet = workbook.addWorksheet("Sheet1");

    sharpSheet.getCell("A2").value = "Name";
    sharpSheet.getCell("C2").value = "Actc";
    sharpSheet.getCell("E2").value = "Month(s) In Unit";
    sharpSheet.getCell("G2").value = "Career Flight Time";
    sharpSheet.getCell("A3").value = "Example, Pilot, LT";
    sharpSheet.getCell("C3").value = "2P";
    sharpSheet.getCell("E3").value = 20;
    sharpSheet.getCell("G3").value = 500;

    const parsed = await parseWorkbookBytes(
      toByteArray(await workbook.xlsx.writeBuffer()),
      "htq_2026-04.xlsx"
    );

    expectMonth(parsed.reportMonthDate, 2026, 3);
  });
});
