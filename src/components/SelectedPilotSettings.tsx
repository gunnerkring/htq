import { useMemo } from "react";
import {
  getTargetTrainingMonthOptions,
  sanitizeTargetTrainingMonth
} from "../core/autoCalculate";
import {
  DEFAULT_TARGET_TRAINING_MONTH
} from "../core/constants";
import {
  formatOptionalTrainingMonth,
  formatPilotDisplayName,
  formatPilotLevel,
  formatTrainingMonth
} from "../core/display";
import {
  sanitizeDeploymentHours,
  sanitizeHomecycleHours
} from "../core/sanitize";
import type { AutoCalcResult, CulledPilot, PilotProjectionSettings } from "../types/pilot";

type ConfiguredPilot = CulledPilot & PilotProjectionSettings;

type Props = {
  pilots: ConfiguredPilot[];
  reviewResults: AutoCalcResult[];
  onUpdatePilotSettings: (name: string, patch: Partial<PilotProjectionSettings>) => void;
};

function formatMaybeNumber(value: number | null): string {
  return value == null ? "" : value.toFixed(1);
}

export function SelectedPilotSettings({ pilots, reviewResults, onUpdatePilotSettings }: Props) {
  const reviewByName = useMemo(
    () => new Map(reviewResults.map((result) => [result.name, result])),
    [reviewResults]
  );

  const sortedPilots = useMemo(() => {
    return [...pilots].sort((left, right) => {
      const leftTrainingMonth = left.trainingMonth ?? Number.NEGATIVE_INFINITY;
      const rightTrainingMonth = right.trainingMonth ?? Number.NEGATIVE_INFINITY;

      if (leftTrainingMonth !== rightTrainingMonth) {
        return rightTrainingMonth - leftTrainingMonth;
      }

      return formatPilotDisplayName(left.name).localeCompare(formatPilotDisplayName(right.name));
    });
  }, [pilots]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Overrides</p>
          <h2>Selected Pilot Settings</h2>
        </div>
        <div className="section-pill">{pilots.length} configured</div>
      </div>
      {pilots.length === 0 ? (
        <p className="empty-state">
          Select pilots below, then tune waiver, TTT, target month, deployment hours, and FRTP /
          home cycle hours here.
        </p>
      ) : (
        <>
          {reviewResults.length > 0 ? (
            <div className="review-panel">
              <div className="review-panel-header">
                <strong>Needs Review</strong>
                <span>{reviewResults.length} pilots need adjustment</span>
              </div>
              <div className="review-list">
                {reviewResults.map((result) => (
                  <div key={result.name} className="review-card">
                    <div className="review-name">{result.name}</div>
                    <div className="review-message">{result.message}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="table-wrap">
            <table className="data-table pilot-settings-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Level</th>
                  <th>Current Hours</th>
                  <th>Training Month</th>
                  <th>Need / Mo To 600</th>
                  <th>550 Waiver</th>
                  <th>TTT Waiver</th>
                  <th>Target Month</th>
                  <th>Deployment Hours</th>
                  <th>FRTP / Home Cycle Hours</th>
                </tr>
              </thead>
              <tbody>
                {sortedPilots.map((pilot) => {
                  const targetTrainingMonth = sanitizeTargetTrainingMonth(
                    pilot.tttWaiver,
                    pilot.targetTrainingMonth
                  );
                  const reviewResult = reviewByName.get(pilot.name);

                  return (
                    <tr key={pilot.name} className={reviewResult ? "needs-review-row" : undefined}>
                      <td className={reviewResult ? "needs-review-name-cell" : undefined}>
                        <div className="settings-name-wrap">
                          <span>{pilot.name}</span>
                          {reviewResult ? <span className="status-chip danger">Review</span> : null}
                        </div>
                      </td>
                      <td>{formatPilotLevel(pilot.level)}</td>
                      <td>{pilot.pilotHours.toFixed(1)}</td>
                      <td>{formatOptionalTrainingMonth(pilot.trainingMonth, "")}</td>
                      <td>{formatMaybeNumber(pilot.hrsPerMonthTo600)}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={pilot.waiver550}
                          onChange={(e) =>
                            onUpdatePilotSettings(pilot.name, { waiver550: e.target.checked })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={pilot.tttWaiver}
                          onChange={(e) =>
                            onUpdatePilotSettings(pilot.name, {
                              tttWaiver: e.target.checked,
                              targetTrainingMonth: sanitizeTargetTrainingMonth(
                                e.target.checked,
                                targetTrainingMonth
                              )
                            })
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={targetTrainingMonth}
                          onChange={(e) =>
                            onUpdatePilotSettings(pilot.name, {
                              targetTrainingMonth: Number(
                                e.target.value || DEFAULT_TARGET_TRAINING_MONTH
                              )
                            })
                          }
                        >
                          {getTargetTrainingMonthOptions(pilot.tttWaiver).map((monthOption) => (
                            <option key={monthOption} value={monthOption}>
                              {formatTrainingMonth(monthOption)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={pilot.deploymentHours}
                          onChange={(e) =>
                            onUpdatePilotSettings(pilot.name, {
                              deploymentHours: Number(e.target.value || 0)
                            })
                          }
                          onBlur={(e) =>
                            onUpdatePilotSettings(pilot.name, {
                              deploymentHours: sanitizeDeploymentHours(Number(e.target.value))
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={pilot.frtpHours}
                          onChange={(e) =>
                            onUpdatePilotSettings(pilot.name, {
                              frtpHours: Number(e.target.value || 0)
                            })
                          }
                          onBlur={(e) =>
                            onUpdatePilotSettings(pilot.name, {
                              frtpHours: sanitizeHomecycleHours(Number(e.target.value))
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
