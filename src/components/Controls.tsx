import { useEffect, useState } from "react";
import {
  DEFAULT_SQUADRON,
  SQUADRON_OPTIONS
} from "../core/constants";

type Props = {
  squadron: string;
  setSquadron: (value: string) => void;
  monthModeExact: boolean;
  setMonthModeExact: (value: boolean) => void;
  reportMonthValue: string;
  setReportMonthValue: (value: string) => void;
  reportMonthNeedsReview: boolean;
  onConfirmReportMonth: () => void;
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
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (!showInstructions) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowInstructions(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showInstructions]);

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

        <div className="panel-header-actions">
          <button
            className="button button-ghost button-compact"
            onClick={() => setShowInstructions(true)}
            type="button"
          >
            How To Use
          </button>
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

            <div className="report-month-section">
              <div className="report-month-row">
                <div>
                  <label>Report Month</label>
                  <input
                    type="month"
                    value={props.reportMonthValue}
                    onChange={(e) => props.setReportMonthValue(e.target.value)}
                  />
                </div>

                {props.sourceLabel && props.reportMonthNeedsReview ? (
                  <button
                    className="button button-ghost button-compact"
                    onClick={props.onConfirmReportMonth}
                    type="button"
                  >
                    Use This Month
                  </button>
                ) : null}
              </div>

              <div className="report-month-meta">
                {!props.sourceLabel ? (
                  <span className="status-pill">No report loaded</span>
                ) : props.reportMonthNeedsReview ? (
                  <span className="status-pill status-pill-warning">Needs confirmation</span>
                ) : (
                  <span className="status-pill status-pill-success">Ready</span>
                )}

                <p className={props.reportMonthNeedsReview ? "field-note warning" : "field-note"}>
                  {!props.sourceLabel
                    ? "Upload a report to set the forecast month."
                    : props.reportMonthNeedsReview
                      ? "Inferred from incomplete date data. Confirm or adjust it before saving snapshots or exporting."
                      : "Using this report month for the forecast window and saved history."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="control-card guidance-card">
          <div className="guidance-stack">
            <p className="guidance-copy">
              Load the SHARP PPT report in Excel format from the 1st day of the month, select your
              squadron, choose your pilots, and determine how many hours are realistically needed to
              qualify.
            </p>
          </div>
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

      {showInstructions ? (
        <div
          className="dialog-backdrop"
          onClick={() => setShowInstructions(false)}
          role="presentation"
        >
          <div
            className="dialog-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="htq-instructions-title"
          >
            <div className="dialog-header">
              <div>
                <span className="source-label">Guide</span>
                <h3 id="htq-instructions-title">How To Use Hours to Qualify</h3>
              </div>

              <button
                className="button button-secondary button-compact"
                onClick={() => setShowInstructions(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <ol className="help-steps">
              <li>Upload the monthly SHARP PPT Excel report.</li>
              <li>Verify the report month if the app marks it as needing confirmation.</li>
              <li>Select the squadron and choose whether months in squadron already equals training month.</li>
              <li>Pick the pilots you want to project in Pilot Setup.</li>
              <li>Use Auto Calculate Selected, then fine-tune any pilot still marked for review.</li>
              <li>Check HTQ Forecast and Sorties to see qualification timing and monthly load.</li>
              <li>Save Snapshot each month to build history, then export PDF or CSV when you need a shareable output.</li>
            </ol>

            <p className="dialog-note">
              Snapshot history and saved workspace state stay local to the computer using the app.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
