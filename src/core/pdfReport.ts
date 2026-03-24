import type {
  PilotProjectionSettings,
  ProjectionMonth,
  ProjectionRow,
  SortiesConfig
} from "../types/pilot";

type SelectedPilotReportRow = {
  name: string;
  level: string;
  pilotHours: number;
  trainingMonth: number | null;
} & PilotProjectionSettings;

type PdfReportPayload = {
  phaseLabel: string;
  windowLabel: string;
  sourceLabel: string;
  importedCount: number;
  eligibleCount: number;
  selectedCount: number;
  generatedAt: Date;
  autoCalcSummary?: string;
  months: ProjectionMonth[];
  selectedPilots: SelectedPilotReportRow[];
  projections: ProjectionRow[];
  sortiesConfig: SortiesConfig;
};

export function buildPdfReportHtml(payload: PdfReportPayload): string {
  const generatedAt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(payload.generatedAt);

  const monthHeaders = payload.months
    .map((month) => `<th>${escapeHtml(month.monthLabel)}</th>`)
    .join("");
  const yearHeaders = payload.months
    .map((month) => `<th>${escapeHtml(month.yearLabel)}</th>`)
    .join("");
  const cycleHeaders = payload.months
    .map((month) => `<th>${formatCycleLabel(month.cycle)}</th>`)
    .join("");

  const selectedPilotRows = payload.selectedPilots.length
    ? payload.selectedPilots
        .map(
          (pilot) => `
            <tr>
              <td>${escapeHtml(pilot.name)}</td>
              <td>${escapeHtml(pilot.level || "")}</td>
              <td>${formatNumber(pilot.pilotHours)}</td>
              <td>${formatTrainingMonth(pilot.trainingMonth)}</td>
              <td>${pilot.waiver550 ? "Yes" : "No"}</td>
              <td>${pilot.tttWaiver ? "Yes" : "No"}</td>
              <td>TM${pilot.targetTrainingMonth}</td>
              <td>${formatNumber(pilot.deploymentHours, 0)}</td>
              <td>${formatNumber(pilot.frtpHours, 0)}</td>
            </tr>
          `
        )
        .join("")
    : `
      <tr>
        <td colspan="9" class="empty-row">No selected pilots</td>
      </tr>
    `;

  const projectionRows = payload.projections.length
    ? payload.projections
        .map((row) => {
          const hoursCells = row.projectedHoursByMonth
            .map((value) => `<td>${formatNumber(value)}</td>`)
            .join("");
          const trainingMonthCells = row.trainingMonthsByMonth
            .map((value) => `<td>${escapeHtml(String(value))}</td>`)
            .join("");
          const qualificationStatus =
            row.qualifiesInMonthIndex == null
              ? "Not achieved in window"
              : `Qualifies in ${escapeHtml(
                  payload.months[row.qualifiesInMonthIndex]?.monthLabel ?? ""
                )} ${escapeHtml(payload.months[row.qualifiesInMonthIndex]?.yearLabel ?? "")}`;

          return `
            <tr class="primary-row">
              <td>${escapeHtml(row.name)}</td>
              ${hoursCells}
            </tr>
            <tr class="secondary-row">
              <td>Training Month</td>
              ${trainingMonthCells}
            </tr>
            <tr class="note-row">
              <td colspan="${payload.months.length + 1}">
                ${escapeHtml(qualificationStatus)} | Threshold ${formatNumber(row.threshold, 0)} | Deployment ${formatNumber(row.deploymentHours, 0)} | Homecycle ${formatNumber(row.frtpHours, 0)}
              </td>
            </tr>
          `;
        })
        .join("")
    : `
      <tr>
        <td colspan="${payload.months.length + 1}" class="empty-row">No projection rows</td>
      </tr>
    `;

  const sortieRows = payload.projections.length
    ? payload.projections
        .map((row) => {
          const cells = row.monthlySortiesByMonth
            .map((value) => `<td>${escapeHtml(String(value))}</td>`)
            .join("");

          return `
            <tr>
              <td>${escapeHtml(row.name)}</td>
              ${cells}
            </tr>
          `;
        })
        .join("")
    : `
      <tr>
        <td colspan="${payload.months.length + 1}" class="empty-row">No sortie rows</td>
      </tr>
    `;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Hours to Qualify Report</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #163346;
        --muted: #536a79;
        --navy: #0f3f57;
        --teal: #0f8b8d;
        --line: #c8d6df;
        --panel: #ffffff;
        --soft: #eef4f7;
        --accent: #fff3cd;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        color: var(--ink);
        background: white;
      }

      .page {
        padding: 22px 28px 28px;
      }

      .hero {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        padding: 20px 22px;
        border-radius: 20px;
        background: linear-gradient(135deg, var(--navy), #155879);
        color: white;
      }

      .hero h1 {
        margin: 8px 0 10px;
        font-size: 28px;
        line-height: 1.1;
      }

      .eyebrow {
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 11px;
        font-weight: 700;
        color: #87e7e0;
      }

      .hero p {
        margin: 0;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.86);
      }

      .hero-meta {
        min-width: 260px;
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.12);
      }

      .hero-meta strong,
      .hero-meta span {
        display: block;
      }

      .hero-meta strong {
        margin-top: 4px;
        font-size: 13px;
      }

      .hero-meta .meta-block + .meta-block {
        margin-top: 12px;
      }

      .meta-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: rgba(255, 255, 255, 0.72);
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin: 18px 0;
      }

      .summary-card {
        padding: 14px 16px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--soft);
      }

      .summary-card .label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .summary-card .value {
        margin-top: 8px;
        font-size: 24px;
        font-weight: 800;
      }

      .summary-card .small {
        font-size: 14px;
        line-height: 1.4;
      }

      .banner {
        margin: 0 0 18px;
        padding: 12px 14px;
        border-radius: 14px;
        background: #dff3f0;
        border: 1px solid #b9e0db;
        color: #0f5164;
        font-size: 12px;
        line-height: 1.45;
      }

      .section {
        margin-top: 18px;
        break-inside: avoid;
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        margin-bottom: 10px;
      }

      .section-header h2 {
        margin: 0;
        font-size: 18px;
      }

      .section-header p {
        margin: 0;
        color: var(--muted);
        font-size: 11px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      .report-table {
        border: 1px solid var(--line);
        border-radius: 14px;
        overflow: hidden;
      }

      th,
      td {
        padding: 6px 7px;
        border: 1px solid var(--line);
        font-size: 9px;
        text-align: left;
        vertical-align: top;
        word-wrap: break-word;
      }

      th {
        background: #e6eef3;
        color: var(--navy);
        font-size: 8px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .compact th,
      .compact td {
        font-size: 8.5px;
      }

      .primary-row td:first-child {
        font-weight: 700;
      }

      .secondary-row td {
        background: #f7fafb;
        color: var(--muted);
      }

      .note-row td {
        background: var(--accent);
        color: var(--ink);
        font-size: 8.5px;
      }

      .empty-row {
        text-align: center;
        color: var(--muted);
        padding: 14px;
      }

      .sortie-meta {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 10px;
      }

      .sortie-meta span {
        padding: 6px 9px;
        border-radius: 999px;
        background: var(--soft);
        border: 1px solid var(--line);
        color: var(--muted);
        font-size: 9px;
      }

      .page-break {
        page-break-before: always;
      }

      @page {
        size: letter landscape;
        margin: 0.35in;
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div>
          <p class="eyebrow">Hours to Qualify</p>
          <h1>Projection Report</h1>
          <p>Workbook-aligned HTQ and sortie output for selected pilots.</p>
        </div>
        <div class="hero-meta">
          <div class="meta-block">
            <span class="meta-label">Phase</span>
            <strong>${escapeHtml(payload.phaseLabel)}</strong>
          </div>
          <div class="meta-block">
            <span class="meta-label">Window</span>
            <strong>${escapeHtml(payload.windowLabel)}</strong>
          </div>
          <div class="meta-block">
            <span class="meta-label">Source</span>
            <strong>${escapeHtml(payload.sourceLabel || "No workbook loaded")}</strong>
          </div>
          <div class="meta-block">
            <span class="meta-label">Generated</span>
            <strong>${escapeHtml(generatedAt)}</strong>
          </div>
        </div>
      </section>

      <section class="summary-grid">
        <div class="summary-card">
          <div class="label">Imported</div>
          <div class="value">${payload.importedCount}</div>
        </div>
        <div class="summary-card">
          <div class="label">Eligible</div>
          <div class="value">${payload.eligibleCount}</div>
        </div>
        <div class="summary-card">
          <div class="label">Selected</div>
          <div class="value">${payload.selectedCount}</div>
        </div>
        <div class="summary-card">
          <div class="label">Projection Span</div>
          <div class="value small">${escapeHtml(payload.windowLabel)}</div>
        </div>
      </section>

      ${
        payload.autoCalcSummary
          ? `<p class="banner">${escapeHtml(payload.autoCalcSummary)}</p>`
          : ""
      }

      <section class="section">
        <div class="section-header">
          <h2>Selected Pilot Settings</h2>
          <p>Current assumptions used for this export</p>
        </div>
        <div class="report-table compact">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Level</th>
                <th>Current Hours</th>
                <th>Start TM</th>
                <th>550 Waiver</th>
                <th>TTT Waiver</th>
                <th>Target Month</th>
                <th>Deployment</th>
                <th>Homecycle</th>
              </tr>
            </thead>
            <tbody>
              ${selectedPilotRows}
            </tbody>
          </table>
        </div>
      </section>

      <section class="section page-break">
        <div class="section-header">
          <h2>HTQ Projection</h2>
          <p>Projected cumulative hours and training month progress</p>
        </div>
        <div class="report-table">
          <table>
            <thead>
              <tr>
                <th>Pilot / Metric</th>
                ${monthHeaders}
              </tr>
              <tr>
                <th>Year</th>
                ${yearHeaders}
              </tr>
              <tr>
                <th>Cycle</th>
                ${cycleHeaders}
              </tr>
            </thead>
            <tbody>
              ${projectionRows}
            </tbody>
          </table>
        </div>
      </section>

      <section class="section page-break">
        <div class="section-header">
          <h2>Sorties</h2>
          <p>Monthly sortie demand based on the current sortie assumptions</p>
        </div>
        <div class="sortie-meta">
          <span>Avg Home Cycle Sortie Length: ${escapeHtml(
            String(payload.sortiesConfig.averageHomeCycleSortieLength)
          )}</span>
          <span>Avg Deployment Sortie Length: ${escapeHtml(
            String(payload.sortiesConfig.averageDeploymentSortieLength)
          )}</span>
          <span>Number of Pilots: ${escapeHtml(String(payload.sortiesConfig.numberOfPilots))}</span>
        </div>
        <div class="report-table">
          <table>
            <thead>
              <tr>
                <th>Pilot</th>
                ${monthHeaders}
              </tr>
              <tr>
                <th>Cycle</th>
                ${cycleHeaders}
              </tr>
            </thead>
            <tbody>
              ${sortieRows}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </body>
</html>`;
}

function formatNumber(value: number, fractionDigits = 1): string {
  return value.toFixed(fractionDigits);
}

function formatTrainingMonth(value: number | null): string {
  return value == null ? "--" : `TM${value}`;
}

function formatCycleLabel(cycle: ProjectionMonth["cycle"]): string {
  return cycle === "D" ? "Deploy" : "Home";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
