import {
  DEFAULT_SQUADRON,
  SQUADRON_OPTIONS
} from "../core/constants";

type Props = {
  squadron: string;
  setSquadron: (value: string) => void;
  monthModeExact: boolean;
  setMonthModeExact: (value: boolean) => void;
  onOpenWorkbook: () => void;
  onSaveSnapshot: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onAutoCalculateSelected: () => void;
  exportDisabled: boolean;
  autoCalculateDisabled: boolean;
  saveSnapshotDisabled: boolean;
  sourceLabel: string;
};

export function Controls(props: Props) {
  const sortedSquadronOptions = [...SQUADRON_OPTIONS].sort((left, right) => {
    const leftNumber = Number(left.key.replace("VP-", ""));
    const rightNumber = Number(right.key.replace("VP-", ""));

    return leftNumber - rightNumber;
  });

  return (
    <section className="panel controls-panel">
      <div className="panel-header">
        <div>
          <h2>Projection Setup</h2>
        </div>
      </div>

      <div className="controls-grid">
        <div className="control-card">
          <h3>Select Your Squadron</h3>
          <div className="field-stack">
            <div>
              <label>Squadron</label>
              <select
                value={props.squadron || DEFAULT_SQUADRON}
                onChange={(e) => props.setSquadron(e.target.value)}
              >
                {sortedSquadronOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="checkbox-block">
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={props.monthModeExact}
                  onChange={(e) => props.setMonthModeExact(e.target.checked)}
                />
                Months in squadron already equals training month
              </label>
            </div>
          </div>
        </div>

        <div className="control-card guidance-card">
          <p className="guidance-copy">
            Load the SHARP PPT report in Excel format from the 1st day of the month, select your
            squadron, choose your pilots, and determine how many hours are realistically needed to
            qualify.
          </p>
        </div>
      </div>

      <div className="control-footer">
        <div className="button-row">
          <button className="button button-primary" onClick={props.onOpenWorkbook} type="button">
            Upload PPT Report
          </button>
          <button
            className="button button-support"
            onClick={props.onAutoCalculateSelected}
            type="button"
            disabled={props.autoCalculateDisabled}
          >
            Auto Calculate Selected
          </button>
          <button
            className="button button-secondary"
            onClick={props.onSaveSnapshot}
            type="button"
            disabled={props.saveSnapshotDisabled}
          >
            Save Snapshot
          </button>
          <button
            className="button button-ghost"
            onClick={props.onExportPdf}
            type="button"
            disabled={props.exportDisabled}
          >
            Export PDF
          </button>
          <button
            className="button button-ghost"
            onClick={props.onExportCsv}
            type="button"
            disabled={props.exportDisabled}
          >
            Export CSV
          </button>
        </div>

        <div className="source-note">
          <span className="source-label">Report</span>
          <strong>{props.sourceLabel || "No report uploaded"}</strong>
        </div>
      </div>
    </section>
  );
}
