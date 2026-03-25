import {
  formatPilotDisplayName,
  formatTrainingMonthProgress
} from "../core/display";
import type { ProjectionMonth, ProjectionRow } from "../types/pilot";

type Props = {
  rows: ProjectionRow[];
  months: ProjectionMonth[];
};

function formatCycleLabel(cycle: ProjectionMonth["cycle"]): string {
  return cycle === "D" ? "Deployment" : "Homecycle";
}

function formatTrainingMonthValue(value: ProjectionRow["trainingMonthsByMonth"][number]): string {
  return formatTrainingMonthProgress(value);
}

export function ProjectionTable({ rows, months }: Props) {
  const sortedRows = [...rows].sort((left, right) => {
    const leftTrainingMonth = left.startTrainingMonth ?? Number.NEGATIVE_INFINITY;
    const rightTrainingMonth = right.startTrainingMonth ?? Number.NEGATIVE_INFINITY;

    if (leftTrainingMonth !== rightTrainingMonth) {
      return rightTrainingMonth - leftTrainingMonth;
    }

    return formatPilotDisplayName(left.name).localeCompare(formatPilotDisplayName(right.name));
  });

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Forecast</p>
          <h2>HTQ Projection</h2>
          <p className="panel-subtitle">
            Each column shows the end-of-month result after planned flying for that month.
          </p>
        </div>
        <div className="section-pill">{months.length} months</div>
      </div>
      {rows.length === 0 ? (
        <p className="empty-state">Select pilots to build the workbook-style HTQ forecast.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table projection-table">
            <thead>
              <tr>
                <th>Pilot</th>
                {months.map((month, index) => (
                  <th key={`m-${index}`}>
                    <span className="projection-month-header">
                      <span className="projection-month-name">{month.monthLabel}</span>
                      <span className="projection-month-year">{month.yearLabel}</span>
                    </span>
                  </th>
                ))}
              </tr>
              <tr>
                <th>Cycle</th>
                {months.map((month, index) => (
                  <th key={`p-${index}`}>{formatCycleLabel(month.cycle)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.name} className="projection-row">
                  <td>{formatPilotDisplayName(row.name)}</td>
                  {row.trainingMonthsByMonth.map((value, index) => (
                    <td key={`${row.name}-tm-${index}`}>{formatTrainingMonthValue(value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
