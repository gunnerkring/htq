import { useMemo } from "react";
import {
  getTargetTrainingMonthOptions,
  sanitizeTargetTrainingMonth
} from "../core/autoCalculate";
import {
  DEFAULT_TARGET_TRAINING_MONTH,
  MAX_DEPLOYMENT_HOURS,
  MAX_HOMECYCLE_HOURS,
  MIN_DEPLOYMENT_HOURS,
  MIN_HOMECYCLE_HOURS
} from "../core/constants";
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
    const reviewIndexByName = new Map(reviewResults.map((result, index) => [result.name, index]));

    return pilots
      .map((pilot, index) => ({
        pilot,
        index,
        reviewIndex: reviewIndexByName.get(pilot.name) ?? Number.POSITIVE_INFINITY
      }))
      .sort((left, right) => {
        if (left.reviewIndex !== right.reviewIndex) {
          return left.reviewIndex - right.reviewIndex;
        }

        return left.index - right.index;
      })
      .map((entry) => entry.pilot);
  }, [pilots, reviewResults]);

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
            <table className="data-table">
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
                      <td>{pilot.level}</td>
                      <td>{pilot.pilotHours.toFixed(1)}</td>
                      <td>{pilot.trainingMonth ?? ""}</td>
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
                              TM{monthOption}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={MIN_DEPLOYMENT_HOURS}
                          max={MAX_DEPLOYMENT_HOURS}
                          value={pilot.deploymentHours}
                          onChange={(e) =>
                            onUpdatePilotSettings(pilot.name, {
                              deploymentHours: Number(e.target.value || 0)
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={MIN_HOMECYCLE_HOURS}
                          max={MAX_HOMECYCLE_HOURS}
                          value={pilot.frtpHours}
                          onChange={(e) =>
                            onUpdatePilotSettings(pilot.name, {
                              frtpHours: Number(e.target.value || 0)
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
