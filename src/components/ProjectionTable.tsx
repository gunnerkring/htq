import { Fragment } from "react";
import type { ProjectionMonth, ProjectionRow } from "../types/pilot";

type Props = {
  rows: ProjectionRow[];
  months: ProjectionMonth[];
};

function formatCycleLabel(cycle: ProjectionMonth["cycle"]): string {
  return cycle === "D" ? "Deployment" : "Homecycle";
}

export function ProjectionTable({ rows, months }: Props) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Forecast</p>
          <h2>HTQ Projection</h2>
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
                <th>Month</th>
                {months.map((month, index) => (
                  <th key={`m-${index}`}>{month.monthLabel}</th>
                ))}
              </tr>
              <tr>
                <th>Year</th>
                {months.map((month, index) => (
                  <th key={`y-${index}`}>{month.yearLabel}</th>
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
              {rows.map((row) => (
                <Fragment key={row.name}>
                  <tr key={`${row.name}-hours`} className="projection-row">
                    <td>{row.name}</td>
                    {row.projectedHoursByMonth.map((value, index) => (
                      <td key={`${row.name}-h-${index}`}>{value.toFixed(1)}</td>
                    ))}
                  </tr>
                  <tr key={`${row.name}-tm`} className="detail-row">
                    <td>Training Month</td>
                    {row.trainingMonthsByMonth.map((value, index) => (
                      <td key={`${row.name}-tm-${index}`}>{value}</td>
                    ))}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
