import { formatOptionalTrainingMonth } from "../core/display";
import type { CulledPilot } from "../types/pilot";

type Props = {
  pilots: CulledPilot[];
};

function formatMaybeNumber(value: number | null): string {
  return value == null ? "" : value.toFixed(1);
}

export function CulledTable({ pilots }: Props) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Workbook Data</p>
          <h2>Culled Data</h2>
        </div>
        <div className="section-pill">{pilots.length} rows</div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Level</th>
              <th>Training Month</th>
              <th>Pilot Hours</th>
              <th>Over 600</th>
              <th>Hrs / Mo To 600</th>
            </tr>
          </thead>
          <tbody>
            {pilots.map((pilot) => (
              <tr key={pilot.name}>
                <td>{pilot.name}</td>
                <td>{pilot.level}</td>
                <td>{formatOptionalTrainingMonth(pilot.trainingMonth, "")}</td>
                <td>{pilot.pilotHours.toFixed(1)}</td>
                <td>
                  <span className={pilot.over600 ? "status-chip danger" : "status-chip success"}>
                    {pilot.over600 ? "Yes" : "No"}
                  </span>
                </td>
                <td>{formatMaybeNumber(pilot.hrsPerMonthTo600)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
