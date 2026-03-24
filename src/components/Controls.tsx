import {
  MAX_DEPLOYMENT_HOURS,
  MAX_HOMECYCLE_HOURS,
  MIN_DEPLOYMENT_HOURS,
  MIN_HOMECYCLE_HOURS,
  PHASE_OPTIONS
} from "../core/constants";
import type { PhaseKey } from "../types/pilot";

type Props = {
  phase: PhaseKey;
  setPhase: (value: PhaseKey) => void;
  defaultDeploymentHours: number;
  setDefaultDeploymentHours: (value: number) => void;
  defaultHomecycleHours: number;
  setDefaultHomecycleHours: (value: number) => void;
  monthModeExact: boolean;
  setMonthModeExact: (value: boolean) => void;
  onOpenWorkbook: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onApplyDefaultsToSelected: () => void;
  onAutoCalculateSelected: () => void;
  exportDisabled: boolean;
  applyDefaultsDisabled: boolean;
  autoCalculateDisabled: boolean;
  sourceLabel: string;
};

export function Controls(props: Props) {
  return (
    <section className="panel controls-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Controls</p>
          <h2>Projection Setup</h2>
        </div>
        <p className="panel-subtitle">
          Load the source workbook, set phase and default hour assumptions, and export the results.
        </p>
      </div>

      <div className="controls-grid">
        <div className="control-card">
          <h3>Projection Window</h3>
          <div className="field-stack">
            <div>
              <label>Phase</label>
              <select value={props.phase} onChange={(e) => props.setPhase(e.target.value as PhaseKey)}>
                {PHASE_OPTIONS.map((option) => (
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

        <div className="control-card">
          <h3>Hour Defaults</h3>
          <div className="field-stack">
            <div>
              <label>Default Deployment Hours</label>
              <input
                type="number"
                min={MIN_DEPLOYMENT_HOURS}
                max={MAX_DEPLOYMENT_HOURS}
                value={props.defaultDeploymentHours}
                onChange={(e) => props.setDefaultDeploymentHours(Number(e.target.value || 0))}
              />
            </div>

            <div>
              <label>Default FRTP / Home Cycle Hours</label>
              <input
                type="number"
                min={MIN_HOMECYCLE_HOURS}
                max={MAX_HOMECYCLE_HOURS}
                value={props.defaultHomecycleHours}
                onChange={(e) => props.setDefaultHomecycleHours(Number(e.target.value || 0))}
              />
            </div>
          </div>
        </div>

      </div>

      <div className="control-footer">
        <div className="button-row">
          <button className="button button-primary" onClick={props.onOpenWorkbook} type="button">
            Open Workbook
          </button>
          <button
            className="button button-secondary"
            onClick={props.onApplyDefaultsToSelected}
            type="button"
            disabled={props.applyDefaultsDisabled}
          >
            Apply Defaults
          </button>
          <button
            className="button button-secondary"
            onClick={props.onAutoCalculateSelected}
            type="button"
            disabled={props.autoCalculateDisabled}
          >
            Auto Calculate Selected
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
          <span className="source-label">Source</span>
          <strong>{props.sourceLabel || "No workbook loaded"}</strong>
        </div>
      </div>
    </section>
  );
}
