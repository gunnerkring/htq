import { useMemo } from "react";
import {
  buildArchiveHistoryAnalysis,
  buildArchiveRequirementRows,
  buildArchiveTrendSummary
} from "../core/archive";
import {
  formatOptionalTrainingMonth,
  formatPilotDisplayName,
  formatTrainingMonth
} from "../core/display";
import type { ArchiveRequirementPoint, ProjectionArchiveSnapshot } from "../types/archive";

type ComparableRequirementPoint = ArchiveRequirementPoint & {
  requiredHoursPerMonth: number;
};

type Props = {
  snapshots: ProjectionArchiveSnapshot[];
  currentSquadron: string;
  onDeleteCurrentSquadronHistory: () => void;
  onDeleteAllHistory: () => void;
  onResetLocalWorkspace: () => void;
};

function formatSavedAt(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDelta(value: number, neutralLabel: string): string {
  if (value > 0) {
    return `+${value}`;
  }

  if (value < 0) {
    return `${value}`;
  }

  return neutralLabel;
}

function getTrendChipClass(value: number, positiveIsGood = true): string {
  if (value === 0) {
    return "status-chip neutral";
  }

  const isPositive = value > 0;

  if ((positiveIsGood && isPositive) || (!positiveIsGood && !isPositive)) {
    return "status-chip success";
  }

  return "status-chip danger";
}

function formatRequiredHours(value: number | null): string {
  if (value == null) {
    return "--";
  }

  if (value === 0) {
    return "Qualified";
  }

  return value.toFixed(1);
}

function getRequirementTone(point: ArchiveRequirementPoint): "low" | "medium" | "high" | "clear" | "unknown" {
  if (!point.isPresent) {
    return "unknown";
  }

  if (point.requiredHoursPerMonth == null) {
    return "unknown";
  }

  if (point.requiredHoursPerMonth === 0) {
    return "clear";
  }

  if (point.requiredHoursPerMonth <= 18) {
    return "low";
  }

  if (point.requiredHoursPerMonth <= 26) {
    return "medium";
  }

  return "high";
}

function getComparableRequirementPoints(
  points: ArchiveRequirementPoint[]
): ComparableRequirementPoint[] {
  return points.filter(
    (point): point is ComparableRequirementPoint =>
      point.isPresent && point.requiredHoursPerMonth != null
  );
}

function formatRequirementDelta(value: number): string {
  return `${Math.abs(value).toFixed(1)} hrs/mo`;
}

function summarizeRequirementTrend(points: ArchiveRequirementPoint[]): string {
  const comparablePoints = getComparableRequirementPoints(points);
  const latestPoint = comparablePoints[comparablePoints.length - 1];

  if (!latestPoint) {
    return "No saved requirement data yet.";
  }

  if (comparablePoints.length === 1) {
    return `First tracked in ${latestPoint.reportMonthLabel}.`;
  }

  const firstPoint = comparablePoints[0];
  const delta = latestPoint.requiredHoursPerMonth - firstPoint.requiredHoursPerMonth;

  if (latestPoint.requiredHoursPerMonth === 0 && firstPoint.requiredHoursPerMonth > 0) {
    return `Now clear after needing ${firstPoint.requiredHoursPerMonth.toFixed(1)} hrs/mo in ${firstPoint.reportMonthLabel}.`;
  }

  if (delta <= -1.5) {
    return `Pressure eased by ${formatRequirementDelta(delta)} since ${firstPoint.reportMonthLabel}.`;
  }

  if (delta >= 1.5) {
    return `Pressure rose by ${formatRequirementDelta(delta)} since ${firstPoint.reportMonthLabel}.`;
  }

  return `Requirement is holding close to ${firstPoint.reportMonthLabel}.`;
}

export function ArchiveHistory({
  snapshots,
  currentSquadron,
  onDeleteCurrentSquadronHistory,
  onDeleteAllHistory,
  onResetLocalWorkspace
}: Props) {
  const currentSquadronSnapshots = useMemo(
    () => snapshots.filter((snapshot) => snapshot.squadron === currentSquadron),
    [currentSquadron, snapshots]
  );
  const latestSnapshot = currentSquadronSnapshots[0] ?? null;
  const previousSnapshot =
    currentSquadronSnapshots.find(
      (snapshot) => snapshot.reportMonth !== latestSnapshot?.reportMonth
    ) ?? null;
  const historyAnalysis = useMemo(
    () => buildArchiveHistoryAnalysis(currentSquadronSnapshots),
    [currentSquadronSnapshots]
  );
  const requirementSnapshots = useMemo(
    () =>
      currentSquadronSnapshots
        .slice()
        .sort((left, right) => left.reportMonth.localeCompare(right.reportMonth)),
    [currentSquadronSnapshots]
  );
  const trendSummary = useMemo(
    () => (latestSnapshot ? buildArchiveTrendSummary(latestSnapshot, previousSnapshot) : null),
    [latestSnapshot, previousSnapshot]
  );
  const requirementRows = useMemo(
    () => buildArchiveRequirementRows(currentSquadronSnapshots),
    [currentSquadronSnapshots]
  );
  const requirementAnalysis = useMemo(() => {
    let clearCount = 0;
    let highPressureCount = 0;
    let easingCount = 0;
    let risingCount = 0;

    for (const row of requirementRows) {
      const comparablePoints = getComparableRequirementPoints(row.points);
      const latestPoint = comparablePoints[comparablePoints.length - 1];

      if (!latestPoint) {
        continue;
      }

      if (latestPoint.requiredHoursPerMonth === 0) {
        clearCount += 1;
      } else if (latestPoint.requiredHoursPerMonth > 26) {
        highPressureCount += 1;
      }

      if (comparablePoints.length < 2) {
        continue;
      }

      const firstPoint = comparablePoints[0];
      const delta = latestPoint.requiredHoursPerMonth - firstPoint.requiredHoursPerMonth;

      if (delta <= -1.5) {
        easingCount += 1;
      } else if (delta >= 1.5) {
        risingCount += 1;
      }
    }

    return {
      clearCount,
      highPressureCount,
      easingCount,
      risingCount
    };
  }, [requirementRows]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Archive</p>
          <h2>Snapshot History</h2>
        </div>
        <div className="section-pill">{snapshots.length} saved</div>
      </div>

      <div className="archive-actions">
        <p className="archive-storage-note">
          Current workbook progress and snapshot history save locally on this computer.
        </p>
        <div className="button-row">
          <button
            className="button button-secondary"
            type="button"
            onClick={onDeleteCurrentSquadronHistory}
            disabled={currentSquadronSnapshots.length === 0}
          >
            Delete {currentSquadron} History
          </button>
          <button
            className="button button-ghost"
            type="button"
            onClick={onDeleteAllHistory}
            disabled={snapshots.length === 0}
          >
            Delete All History
          </button>
          <button className="button button-ghost" type="button" onClick={onResetLocalWorkspace}>
            Reset Local Workspace
          </button>
        </div>
      </div>

      {snapshots.length === 0 ? (
        <p className="empty-state">
          Save a snapshot after uploading a report and selecting your pilots. Each snapshot is kept
          locally so you can compare squadron trends month over month.
        </p>
      ) : (
        <>
          <div className="archive-summary-grid">
            <div className="archive-summary-card">
              <span className="archive-card-label">Total Snapshots</span>
              <strong className="archive-card-value">{snapshots.length}</strong>
              <span className="archive-card-note">saved on this machine</span>
            </div>
            <div className="archive-summary-card">
              <span className="archive-card-label">Current Squadron</span>
              <strong className="archive-card-value">{currentSquadron}</strong>
              <span className="archive-card-note">
                {currentSquadronSnapshots.length} archived snapshots
              </span>
            </div>
            <div className="archive-summary-card">
              <span className="archive-card-label">Latest Report Month</span>
              <strong className="archive-card-value">
                {latestSnapshot?.reportMonthLabel ?? "No snapshot yet"}
              </strong>
              <span className="archive-card-note">
                {latestSnapshot ? formatSavedAt(latestSnapshot.savedAt) : "Save one to begin"}
              </span>
            </div>
            <div className="archive-summary-card">
              <span className="archive-card-label">Latest Qualified</span>
              <strong className="archive-card-value">
                {latestSnapshot ? latestSnapshot.qualifiedCount : 0}
              </strong>
              <span className="archive-card-note">
                {latestSnapshot
                  ? `${latestSnapshot.reviewCount} need review in latest snapshot`
                  : "No comparison available yet"}
              </span>
            </div>
          </div>

          {latestSnapshot ? (
            <div className="archive-trend-panel">
              <div className="archive-trend-header">
                <div>
                  <strong>{currentSquadron} Trend Readout</strong>
                  <p>
                    Latest snapshot: {latestSnapshot.reportMonthLabel} from{" "}
                    {latestSnapshot.sourceLabel || "uploaded report"}.
                  </p>
                </div>
                <span className="section-pill">{latestSnapshot.phaseLabel}</span>
              </div>

              {trendSummary?.previousSnapshot ? (
                <>
                  <div className="archive-trend-grid">
                    <div className="archive-trend-card">
                      <span className="archive-card-label">History Span</span>
                      <strong className="archive-card-value">{historyAnalysis.snapshotCount}</strong>
                      <span className="archive-card-note">
                        {historyAnalysis.oldestSnapshot?.reportMonthLabel} to{" "}
                        {historyAnalysis.latestSnapshot?.reportMonthLabel}
                      </span>
                    </div>
                    <div className="archive-trend-card">
                      <span className="archive-card-label">Qualified In Window</span>
                      <strong className="archive-card-value">{latestSnapshot.qualifiedCount}</strong>
                      <span className={getTrendChipClass(historyAnalysis.netQualifiedDelta)}>
                        {formatDelta(historyAnalysis.netQualifiedDelta, "No change")} vs first
                      </span>
                    </div>
                    <div className="archive-trend-card">
                      <span className="archive-card-label">Roster Continuity</span>
                      <strong className="archive-card-value">
                        {historyAnalysis.continuingPilotCount}/{latestSnapshot.selectedCount}
                      </strong>
                      <span className="archive-card-note">
                        carried from first report; {historyAnalysis.rankChangeCount} rank changes
                        tracked
                      </span>
                    </div>
                    <div className="archive-trend-card">
                      <span className="archive-card-label">Pressure Pattern</span>
                      <strong className="archive-card-value">
                        {historyAnalysis.repeatedSlipCount}/{historyAnalysis.persistentReviewCount}
                      </strong>
                      <span className="archive-card-note">repeat slips / recurring reviews</span>
                    </div>
                  </div>

                  <div className="archive-pattern-list">
                    {historyAnalysis.insights.map((insight, index) => (
                      <div key={`${insight.title}-${index}`} className="archive-pattern-item">
                        <span className={`status-chip archive-item-chip ${insight.tone}`}>
                          {insight.title}
                        </span>
                        <span>{insight.detail}</span>
                      </div>
                    ))}
                  </div>

                  {trendSummary.notableItems.length > 0 ? (
                    <>
                      <div className="archive-subsection-title">Latest Month-to-Month Changes</div>
                      <div className="archive-notable-list">
                        {trendSummary.notableItems.slice(0, 8).map((item) => (
                          <div key={`${item.type}-${item.name}`} className="archive-notable-item">
                            <span className={`status-chip archive-item-chip ${item.type}`}>
                              {item.type.replace("-", " ")}
                            </span>
                            <span>{item.detail}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="empty-state archive-empty-inline">
                      No material changes were detected compared with the previous {currentSquadron}{" "}
                      snapshot.
                    </p>
                  )}
                </>
              ) : (
                <p className="empty-state archive-empty-inline">
                  Save one more snapshot for {currentSquadron} and this panel will start comparing
                  qualification movement, review flags, and roster changes automatically.
                </p>
              )}
            </div>
          ) : null}

          {currentSquadronSnapshots.length > 0 ? (
            <div className="archive-latest-roster">
              <div className="archive-trend-header">
                <div>
                  <strong>{currentSquadron} Required Hours Trend</strong>
                  <p>
                    Average monthly hours needed at each saved report to hit the assigned target
                    month. Green means already clear, warmer cells mean more pressure, and gray
                    means that pilot was not on the saved roster yet.
                  </p>
                </div>
              </div>
              <div className="archive-trend-grid archive-requirement-summary">
                <div className="archive-trend-card">
                  <span className="archive-card-label">Current High Pressure</span>
                  <strong className="archive-card-value">{requirementAnalysis.highPressureCount}</strong>
                  <span className="archive-card-note">pilots currently above 26 hrs/mo needed</span>
                </div>
                <div className="archive-trend-card">
                  <span className="archive-card-label">Pressure Easing</span>
                  <strong className="archive-card-value">{requirementAnalysis.easingCount}</strong>
                  <span className="archive-card-note">pilots needing less per month than first tracked</span>
                </div>
                <div className="archive-trend-card">
                  <span className="archive-card-label">Pressure Rising</span>
                  <strong className="archive-card-value">{requirementAnalysis.risingCount}</strong>
                  <span className="archive-card-note">pilots needing more per month than first tracked</span>
                </div>
                <div className="archive-trend-card">
                  <span className="archive-card-label">Already Clear</span>
                  <strong className="archive-card-value">{requirementAnalysis.clearCount}</strong>
                  <span className="archive-card-note">pilots already at threshold in latest report</span>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table archive-requirement-table">
                  <thead>
                    <tr>
                      <th>Pilot</th>
                      {requirementSnapshots.map((snapshot) => (
                        <th key={snapshot.id}>{snapshot.reportMonthLabel}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {requirementRows.map((row) => (
                      <tr key={row.identityKey}>
                        <td>
                          <div className="archive-requirement-name">{row.displayName}</div>
                          <div className="archive-requirement-meta">
                            {row.latestTargetTrainingMonth
                              ? `Target ${formatTrainingMonth(row.latestTargetTrainingMonth)}`
                              : "No target"}
                            {row.latestQualificationLabel
                              ? ` · Latest by end of ${row.latestQualificationLabel}`
                              : ""}
                          </div>
                          <div className="archive-requirement-meta">
                            {summarizeRequirementTrend(row.points)}
                          </div>
                        </td>
                        {row.points.map((point) => (
                          <td key={`${row.identityKey}-${point.snapshotId}`}>
                            <div className={`archive-requirement-cell ${getRequirementTone(point)}`}>
                              <strong>{formatRequiredHours(point.requiredHoursPerMonth)}</strong>
                              <span>
                                {!point.isPresent
                                  ? "Not selected"
                                  : point.trainingMonth != null
                                  ? `${formatTrainingMonth(point.trainingMonth)} to ${formatTrainingMonth(point.targetTrainingMonth)}`
                                  : `Target ${formatTrainingMonth(point.targetTrainingMonth)}`}
                              </span>
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="table-wrap">
            <table className="data-table archive-table">
              <thead>
                <tr>
                  <th>Saved</th>
                  <th>Report Month</th>
                  <th>Squadron</th>
                  <th>Phase</th>
                  <th>Selected</th>
                  <th>Qualified</th>
                  <th>Review</th>
                  <th>Source Report</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr
                    key={snapshot.id}
                    className={snapshot.squadron === currentSquadron ? "archive-current-row" : undefined}
                  >
                    <td>{formatSavedAt(snapshot.savedAt)}</td>
                    <td>{snapshot.reportMonthLabel}</td>
                    <td>{snapshot.squadron}</td>
                    <td>{snapshot.phase}</td>
                    <td>{snapshot.selectedCount}</td>
                    <td>{snapshot.qualifiedCount}</td>
                    <td>{snapshot.reviewCount}</td>
                    <td>{snapshot.sourceLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {latestSnapshot ? (
            <div className="archive-latest-roster">
              <div className="archive-trend-header">
                <div>
                  <strong>Latest {currentSquadron} Pilot Snapshot</strong>
                  <p>{latestSnapshot.windowLabel}</p>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table archive-roster-table">
                  <thead>
                    <tr>
                      <th>Pilot</th>
                      <th>Target Month</th>
                      <th>Qualified By Month End</th>
                      <th>Hours</th>
                      <th>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestSnapshot.pilots.map((pilot) => (
                      <tr key={pilot.name}>
                        <td>{formatPilotDisplayName(pilot.name)}</td>
                        <td>{formatTrainingMonth(pilot.targetTrainingMonth)}</td>
                        <td>
                          {pilot.qualificationLabel
                            ? `End of ${pilot.qualificationLabel}`
                            : "Not in current window"}
                        </td>
                        <td>
                          {pilot.deploymentHours} deployed / {pilot.frtpHours} homecycle
                        </td>
                        <td>{pilot.reviewMessage ?? "Clear"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
