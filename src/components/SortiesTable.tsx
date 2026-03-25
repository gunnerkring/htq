import { formatPilotDisplayName } from "../core/display";
import type { ProjectionMonth, ProjectionRow, SortiesConfig } from "../types/pilot";

type Props = {
  rows: ProjectionRow[];
  months: ProjectionMonth[];
  sortiesConfig: SortiesConfig;
  setAverageHomeCycleSortieLength: (value: number) => void;
  setAverageDeploymentSortieLength: (value: number) => void;
  setNumberOfPilots: (value: number) => void;
};

function formatCycleLabel(cycle: ProjectionMonth["cycle"]): string {
  return cycle === "D" ? "Deployment" : "Homecycle";
}

export function SortiesTable({
  rows,
  months,
  sortiesConfig,
  setAverageHomeCycleSortieLength,
  setAverageDeploymentSortieLength,
  setNumberOfPilots
}: Props) {
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
          <p className="eyebrow">Sorties</p>
          <h2>Monthly Sortie Load</h2>
        </div>
        <div className="section-pill">{months.length} months</div>
      </div>
      <div className="sorties-controls">
        <div className="sorties-control-card">
          <label>Avg Home Cycle Sortie Length</label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={sortiesConfig.averageHomeCycleSortieLength}
            onChange={(e) => setAverageHomeCycleSortieLength(Number(e.target.value || 0))}
          />
        </div>
        <div className="sorties-control-card">
          <label>Avg Deployment Sortie Length</label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={sortiesConfig.averageDeploymentSortieLength}
            onChange={(e) => setAverageDeploymentSortieLength(Number(e.target.value || 0))}
          />
        </div>
        <div className="sorties-control-card">
          <label>Sortie Pilot Count</label>
          <input
            type="number"
            min={1}
            step={1}
            value={sortiesConfig.numberOfPilots}
            onChange={(e) => setNumberOfPilots(Number(e.target.value || 0))}
          />
        </div>
      </div>
      <div className="sorties-meta">
        <span>Avg Home Cycle Sortie Length: {sortiesConfig.averageHomeCycleSortieLength}</span>
        <span>Avg Deployment Sortie Length: {sortiesConfig.averageDeploymentSortieLength}</span>
        <span>Number of Pilots: {sortiesConfig.numberOfPilots}</span>
      </div>
      {rows.length === 0 ? (
        <p className="empty-state">Sortie counts appear here once pilots are selected.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table sorties-table">
            <thead>
              <tr>
                <th>Name</th>
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
                <tr key={`${row.name}-sorties`}>
                  <td>{formatPilotDisplayName(row.name)}</td>
                  {row.monthlySortiesByMonth.map((value, index) => (
                    <td key={`${row.name}-sortie-${index}`}>{value}</td>
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
