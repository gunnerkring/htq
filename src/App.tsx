import { useEffect, useMemo, useState } from "react";
import { ArchiveHistory } from "./components/ArchiveHistory";
import { Header } from "./components/Header";
import { Controls } from "./components/Controls";
import { SummaryBar } from "./components/SummaryBar";
import { PilotSelector } from "./components/PilotSelector";
import { ProjectionTable } from "./components/ProjectionTable";
import { SelectedPilotSettings } from "./components/SelectedPilotSettings";
import { SortiesTable } from "./components/SortiesTable";
import {
  appendArchiveSnapshot,
  createArchiveSnapshot,
  loadArchiveSnapshots,
  normalizeArchiveSnapshots,
  persistArchiveSnapshots
} from "./core/archive";
import {
  autoCalculateSelectedPilotSettings,
  reviewCurrentPilotSettings
} from "./core/autoCalculate";
import {
  DEFAULT_SQUADRON,
  DEFAULT_SQUADRON_BY_PHASE,
  DEFAULT_TARGET_TRAINING_MONTH,
  DEFAULT_DEPLOYMENT_HOURS,
  DEFAULT_DEPLOYMENT_SORTIE_LENGTH,
  DEFAULT_HOMECYCLE_HOURS,
  DEFAULT_HOME_CYCLE_SORTIE_LENGTH,
  DEFAULT_SORTIE_PILOT_COUNT,
  getPhaseForSquadron,
  PHASE_LABELS
} from "./core/constants";
import { buildCulledData } from "./core/culledData";
import { startOfMonth } from "./core/date";
import { buildProjectionMonths } from "./core/phasePatterns";
import { parseWorkbookBytes } from "./core/parseWorkbook";
import { buildPdfReportHtml } from "./core/pdfReport";
import { projectHoursToQualify, projectionsToCsv } from "./core/projectionEngine";
import {
  sanitizePilotSettings,
  sanitizePilotSettingsRecord,
  sanitizePositiveInteger,
  sanitizePositiveNumber,
  sanitizeSortiesConfig
} from "./core/sanitize";
import {
  clearPersistedWorkspaceState,
  loadPersistedWorkspaceState,
  persistWorkspaceState
} from "./core/workspaceState";
import type {
  AutoCalcResult,
  PilotProjectionSettings,
  SharpPilot,
  SortiesConfig
} from "./types/pilot";
import type { ProjectionArchiveSnapshot } from "./types/archive";

type WorkspaceTabKey = "pilots" | "forecast" | "sorties" | "history";

function createDefaultPilotSettings(
  deploymentHours: number,
  frtpHours: number
): PilotProjectionSettings {
  return {
    waiver550: false,
    tttWaiver: false,
    targetTrainingMonth: DEFAULT_TARGET_TRAINING_MONTH,
    deploymentHours,
    frtpHours
  };
}

function buildAutoCalcSummary(results: AutoCalcResult[]): string {
  const calculatedCount = results.filter((result) => result.status === "calculated").length;
  const unresolved = results.filter((result) => result.status !== "calculated");

  if (unresolved.length === 0) {
    return `Auto-calculated all ${results.length} selected pilots.`;
  }

  return `Auto-calculated ${calculatedCount} of ${results.length} selected pilots. Review the highlighted pilots in Selected Pilot Settings.`;
}

export default function App() {
  const [initialWorkspaceState] = useState(() => loadPersistedWorkspaceState());

  const [selectedSquadron, setSelectedSquadron] = useState<string>(
    initialWorkspaceState?.selectedSquadron ?? DEFAULT_SQUADRON
  );
  const [defaultDeploymentHours, setDefaultDeploymentHours] = useState(DEFAULT_DEPLOYMENT_HOURS);
  const [defaultHomecycleHours, setDefaultHomecycleHours] = useState(DEFAULT_HOMECYCLE_HOURS);
  const [averageHomeCycleSortieLength, setAverageHomeCycleSortieLength] = useState(
    sanitizePositiveNumber(
      initialWorkspaceState?.averageHomeCycleSortieLength,
      DEFAULT_HOME_CYCLE_SORTIE_LENGTH
    )
  );
  const [averageDeploymentSortieLength, setAverageDeploymentSortieLength] = useState(
    sanitizePositiveNumber(
      initialWorkspaceState?.averageDeploymentSortieLength,
      DEFAULT_DEPLOYMENT_SORTIE_LENGTH
    )
  );
  const [numberOfPilots, setNumberOfPilots] = useState(
    sanitizePositiveInteger(initialWorkspaceState?.numberOfPilots, DEFAULT_SORTIE_PILOT_COUNT)
  );
  const [monthModeExact, setMonthModeExact] = useState(initialWorkspaceState?.monthModeExact ?? false);
  const [sharpRows, setSharpRows] = useState<SharpPilot[]>(initialWorkspaceState?.sharpRows ?? []);
  const [selectedNames, setSelectedNames] = useState<string[]>(
    initialWorkspaceState?.selectedNames ?? []
  );
  const [pilotSettings, setPilotSettings] = useState<Record<string, PilotProjectionSettings>>(
    sanitizePilotSettingsRecord(
      initialWorkspaceState?.pilotSettings,
      DEFAULT_DEPLOYMENT_HOURS,
      DEFAULT_HOMECYCLE_HOURS
    )
  );
  const [sourceLabel, setSourceLabel] = useState(initialWorkspaceState?.sourceLabel ?? "");
  const [error, setError] = useState("");
  const [autoCalcSummary, setAutoCalcSummary] = useState("");
  const [reviewTrackingEnabled, setReviewTrackingEnabled] = useState(
    initialWorkspaceState?.reviewTrackingEnabled ?? false
  );
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTabKey>(
    initialWorkspaceState?.activeWorkspaceTab ?? "pilots"
  );
  const [archiveSnapshots, setArchiveSnapshots] = useState<ProjectionArchiveSnapshot[]>(() =>
    loadArchiveSnapshots()
  );
  const [archiveMessage, setArchiveMessage] = useState("");
  const [projectionBaseDate, setProjectionBaseDate] = useState(() => {
    if (!initialWorkspaceState?.projectionBaseDate) {
      return startOfMonth(new Date());
    }

    const restoredDate = new Date(initialWorkspaceState.projectionBaseDate);

    if (Number.isNaN(restoredDate.getTime())) {
      return startOfMonth(new Date());
    }

    return startOfMonth(restoredDate);
  });

  const phase = getPhaseForSquadron(selectedSquadron);

  const sortiesConfig = useMemo<SortiesConfig>(
    () =>
      sanitizeSortiesConfig({
        averageHomeCycleSortieLength,
        averageDeploymentSortieLength,
        numberOfPilots
      }),
    [averageDeploymentSortieLength, averageHomeCycleSortieLength, numberOfPilots]
  );

  const culled = useMemo(
    () => buildCulledData(sharpRows, monthModeExact),
    [sharpRows, monthModeExact]
  );

  const phaseWindow = useMemo(
    () => buildProjectionMonths(phase, projectionBaseDate),
    [phase, projectionBaseDate]
  );

  const eligiblePilotsByName = useMemo(
    () => new Map(culled.filter((pilot) => !pilot.over600).map((pilot) => [pilot.name, pilot])),
    [culled]
  );
  const eligiblePilotNames = useMemo(() => Array.from(eligiblePilotsByName.keys()), [eligiblePilotsByName]);

  const selectedPilots = useMemo(
    () =>
      selectedNames
        .map((name) => {
          const pilot = eligiblePilotsByName.get(name);

          if (!pilot) {
            return null;
          }

          return {
            pilot,
            settings:
              pilotSettings[name] ??
              createDefaultPilotSettings(defaultDeploymentHours, defaultHomecycleHours)
          };
        })
        .filter((pilot): pilot is NonNullable<typeof pilot> => pilot != null),
    [
      defaultDeploymentHours,
      defaultHomecycleHours,
      eligiblePilotsByName,
      pilotSettings,
      selectedNames
    ]
  );

  const selectedConfiguredPilots = useMemo(
    () =>
      selectedPilots.map(({ pilot, settings }) => ({
        pilot,
        settings: sanitizePilotSettings(
          settings,
          defaultDeploymentHours,
          defaultHomecycleHours
        )
      })),
    [defaultDeploymentHours, defaultHomecycleHours, selectedPilots]
  );

  const selectedPilotsForSettings = useMemo(
    () =>
      selectedPilots.map(({ pilot, settings }) => ({
        ...pilot,
        ...settings
      })),
    [selectedPilots]
  );

  const selectedPilotsForReport = useMemo(
    () =>
      selectedConfiguredPilots.map(({ pilot, settings }) => ({
        ...pilot,
        ...settings
      })),
    [selectedConfiguredPilots]
  );

  const projections = useMemo(
    () =>
      phaseWindow.error
        ? []
        : projectHoursToQualify(selectedConfiguredPilots, phaseWindow.months, sortiesConfig),
    [phaseWindow, selectedConfiguredPilots, sortiesConfig]
  );
  const autoCalcReviewResults = useMemo(
    () =>
      reviewTrackingEnabled && !phaseWindow.error
        ? reviewCurrentPilotSettings(selectedConfiguredPilots, phaseWindow.months)
        : [],
    [phaseWindow, reviewTrackingEnabled, selectedConfiguredPilots]
  );

  const phaseLabel = PHASE_LABELS[phase];
  const windowLabel =
    phaseWindow.months.length === 0
      ? "Unavailable"
      : `${phaseWindow.months[0].monthLabel} ${phaseWindow.months[0].yearLabel} to ${
          phaseWindow.months[phaseWindow.months.length - 1].monthLabel
        } ${phaseWindow.months[phaseWindow.months.length - 1].yearLabel}`;
  const activeError = error || phaseWindow.error || "";

  useEffect(() => {
    persistArchiveSnapshots(archiveSnapshots);
  }, [archiveSnapshots]);

  useEffect(() => {
    setArchiveSnapshots((current) => normalizeArchiveSnapshots(current));
  }, []);

  useEffect(() => {
    persistWorkspaceState({
      selectedSquadron,
      monthModeExact,
      reviewTrackingEnabled,
      sharpRows,
      selectedNames,
      pilotSettings: sanitizePilotSettingsRecord(
        pilotSettings,
        defaultDeploymentHours,
        defaultHomecycleHours
      ),
      sourceLabel,
      projectionBaseDate: projectionBaseDate.toISOString(),
      averageHomeCycleSortieLength: sortiesConfig.averageHomeCycleSortieLength,
      averageDeploymentSortieLength: sortiesConfig.averageDeploymentSortieLength,
      numberOfPilots: sortiesConfig.numberOfPilots,
      activeWorkspaceTab
    });
  }, [
    activeWorkspaceTab,
    averageDeploymentSortieLength,
    archiveSnapshots,
    averageHomeCycleSortieLength,
    defaultDeploymentHours,
    defaultHomecycleHours,
    monthModeExact,
    numberOfPilots,
    pilotSettings,
    projectionBaseDate,
    reviewTrackingEnabled,
    selectedNames,
    selectedSquadron,
    sharpRows,
    sourceLabel
  ]);

  function clearAutoCalcFeedback() {
    setAutoCalcSummary("");
  }

  function handleSetSquadron(value: string) {
    clearAutoCalcFeedback();
    setArchiveMessage("");
    setSelectedSquadron(value);
  }

  function handleSetMonthModeExact(value: boolean) {
    clearAutoCalcFeedback();
    setArchiveMessage("");
    setMonthModeExact(value);
  }

  function handleSetAverageHomeCycleSortieLength(value: number) {
    setArchiveMessage("");
    setAverageHomeCycleSortieLength((current) => sanitizePositiveNumber(value, current));
  }

  function handleSetAverageDeploymentSortieLength(value: number) {
    setArchiveMessage("");
    setAverageDeploymentSortieLength((current) => sanitizePositiveNumber(value, current));
  }

  function handleSetNumberOfPilots(value: number) {
    setArchiveMessage("");
    setNumberOfPilots((current) => sanitizePositiveInteger(value, current));
  }

  async function openWorkbook() {
    try {
      setError("");
      clearAutoCalcFeedback();
      setReviewTrackingEnabled(false);
      setArchiveMessage("");
      const response = await window.htqApi.openWorkbook();
      if (!response) return;

      const workbook = await parseWorkbookBytes(response.bytes, response.fileName);
      const initialSortiesConfig = sanitizeSortiesConfig(workbook.initialSortiesConfig);

      setSharpRows(workbook.pilots);
      setProjectionBaseDate(workbook.reportMonthDate ?? startOfMonth(new Date()));
      setSelectedSquadron(
        workbook.initialSquadron ??
          (workbook.initialPhase
            ? DEFAULT_SQUADRON_BY_PHASE[workbook.initialPhase]
            : DEFAULT_SQUADRON)
      );
      setMonthModeExact(workbook.initialMonthModeExact ?? false);
      setSelectedNames(workbook.initialSelectedNames ?? []);
      setPilotSettings(
        sanitizePilotSettingsRecord(
          workbook.initialPilotSettings,
          DEFAULT_DEPLOYMENT_HOURS,
          DEFAULT_HOMECYCLE_HOURS
        )
      );
      setDefaultDeploymentHours(DEFAULT_DEPLOYMENT_HOURS);
      setDefaultHomecycleHours(DEFAULT_HOMECYCLE_HOURS);
      setAverageHomeCycleSortieLength(initialSortiesConfig.averageHomeCycleSortieLength);
      setAverageDeploymentSortieLength(initialSortiesConfig.averageDeploymentSortieLength);
      setNumberOfPilots(initialSortiesConfig.numberOfPilots);
      setSourceLabel(response.fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open workbook.");
    }
  }

  async function exportCsv() {
    if (phaseWindow.error) {
      return;
    }

    const content = projectionsToCsv(projections, phaseWindow.months, phaseLabel, sortiesConfig);
    await window.htqApi.saveCsv({
      suggestedName: "htq-projection-export.csv",
      content
    });
  }

  async function exportPdf() {
    if (phaseWindow.error) {
      return;
    }

    const content = buildPdfReportHtml({
      phaseLabel,
      windowLabel,
      sourceLabel,
      importedCount: sharpRows.length,
      eligibleCount: culled.filter((pilot) => !pilot.over600).length,
      selectedCount: selectedConfiguredPilots.length,
      generatedAt: new Date(),
      autoCalcSummary: autoCalcSummary || undefined,
      months: phaseWindow.months,
      selectedPilots: selectedPilotsForReport,
      projections,
      sortiesConfig
    });

    await window.htqApi.savePdf({
      suggestedName: "htq-projection-report.pdf",
      html: content
    });
  }

  function togglePilot(name: string) {
    clearAutoCalcFeedback();
    setArchiveMessage("");
    setSelectedNames((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    );

    setPilotSettings((current) =>
      current[name]
        ? current
        : {
            ...current,
            [name]: createDefaultPilotSettings(defaultDeploymentHours, defaultHomecycleHours)
          }
    );
  }

  function updatePilotSettings(name: string, patch: Partial<PilotProjectionSettings>) {
    clearAutoCalcFeedback();
    setArchiveMessage("");
    setPilotSettings((current) => ({
      ...current,
      [name]: {
        ...(current[name] ?? createDefaultPilotSettings(defaultDeploymentHours, defaultHomecycleHours)),
        ...patch
      }
    }));
  }

  function selectAllEligiblePilots() {
    clearAutoCalcFeedback();
    setArchiveMessage("");
    setSelectedNames((current) => Array.from(new Set([...current, ...eligiblePilotNames])));

    setPilotSettings((current) => {
      const next = { ...current };

      for (const name of eligiblePilotNames) {
        next[name] =
          next[name] ?? createDefaultPilotSettings(defaultDeploymentHours, defaultHomecycleHours);
      }

      return next;
    });
  }

  function autoCalculateSelected() {
    if (phaseWindow.error || selectedConfiguredPilots.length === 0) {
      return;
    }

    setArchiveMessage("");
    const results = autoCalculateSelectedPilotSettings(selectedConfiguredPilots, phaseWindow.months);

    setPilotSettings((current) => {
      const next = { ...current };

      for (const result of results) {
        const existing =
          next[result.name] ??
          createDefaultPilotSettings(defaultDeploymentHours, defaultHomecycleHours);

        next[result.name] = {
          ...existing,
          targetTrainingMonth: result.targetTrainingMonth,
          ...(result.status === "calculated" ? result.recommendedSettings : {})
        };
      }

      return next;
    });

    setAutoCalcSummary(buildAutoCalcSummary(results));
    setReviewTrackingEnabled(true);
    setActiveWorkspaceTab("pilots");
  }

  function saveSnapshot() {
    if (phaseWindow.error || selectedConfiguredPilots.length === 0 || projections.length === 0) {
      return;
    }

    const snapshotReviewResults = reviewCurrentPilotSettings(
      selectedConfiguredPilots,
      phaseWindow.months
    );

    const snapshot = createArchiveSnapshot({
      reportMonthDate: projectionBaseDate,
      squadron: selectedSquadron,
      phase,
      phaseLabel,
      windowLabel,
      sourceLabel,
      monthModeExact,
      importedCount: sharpRows.length,
      eligibleCount: culled.filter((pilot) => !pilot.over600).length,
      reviewResults: snapshotReviewResults,
      selectedPilots: selectedConfiguredPilots,
      projections,
      months: phaseWindow.months
    });

    setArchiveSnapshots((current) => appendArchiveSnapshot(current, snapshot));
    setArchiveMessage(
      `Saved ${snapshot.reportMonthLabel} snapshot for ${snapshot.squadron} with ${snapshot.selectedCount} selected pilots.`
    );
    setActiveWorkspaceTab("history");
  }

  function deleteCurrentSquadronHistory() {
    const currentSquadronSnapshotCount = archiveSnapshots.filter(
      (snapshot) => snapshot.squadron === selectedSquadron
    ).length;

    if (
      currentSquadronSnapshotCount === 0 ||
      !window.confirm(
        `Delete all ${currentSquadronSnapshotCount} saved snapshots for ${selectedSquadron}?`
      )
    ) {
      return;
    }

    setArchiveSnapshots((current) =>
      current.filter((snapshot) => snapshot.squadron !== selectedSquadron)
    );
    setArchiveMessage(`Deleted saved snapshot history for ${selectedSquadron}.`);
  }

  function deleteAllHistory() {
    if (
      archiveSnapshots.length === 0 ||
      !window.confirm("Delete all saved snapshot history on this computer?")
    ) {
      return;
    }

    setArchiveSnapshots([]);
    setArchiveMessage("Deleted all saved snapshot history on this computer.");
  }

  function resetLocalWorkspace() {
    if (
      !window.confirm(
        "Reset the saved local workspace on this computer? Snapshot history will stay unless you delete it separately."
      )
    ) {
      return;
    }

    clearPersistedWorkspaceState();
    setSelectedSquadron(DEFAULT_SQUADRON);
    setDefaultDeploymentHours(DEFAULT_DEPLOYMENT_HOURS);
    setDefaultHomecycleHours(DEFAULT_HOMECYCLE_HOURS);
    setAverageHomeCycleSortieLength(DEFAULT_HOME_CYCLE_SORTIE_LENGTH);
    setAverageDeploymentSortieLength(DEFAULT_DEPLOYMENT_SORTIE_LENGTH);
    setNumberOfPilots(DEFAULT_SORTIE_PILOT_COUNT);
    setMonthModeExact(false);
    setSharpRows([]);
    setSelectedNames([]);
    setPilotSettings({});
    setSourceLabel("");
    setError("");
    setAutoCalcSummary("");
    setReviewTrackingEnabled(false);
    setActiveWorkspaceTab("pilots");
    setProjectionBaseDate(startOfMonth(new Date()));
    setArchiveMessage("Reset the saved local workspace for this computer.");
  }

  return (
    <div className="app-shell">
      <Header />
      <Controls
        squadron={selectedSquadron}
        setSquadron={handleSetSquadron}
        monthModeExact={monthModeExact}
        setMonthModeExact={handleSetMonthModeExact}
        onOpenWorkbook={openWorkbook}
        onSaveSnapshot={saveSnapshot}
        onExportCsv={exportCsv}
        onExportPdf={exportPdf}
        onAutoCalculateSelected={autoCalculateSelected}
        exportDisabled={projections.length === 0 || Boolean(phaseWindow.error)}
        autoCalculateDisabled={selectedConfiguredPilots.length === 0 || Boolean(phaseWindow.error)}
        saveSnapshotDisabled={selectedConfiguredPilots.length === 0 || Boolean(phaseWindow.error)}
        sourceLabel={sourceLabel}
      />
      {activeError ? <div className="error-banner">{activeError}</div> : null}
      {archiveMessage ? <div className="info-banner">{archiveMessage}</div> : null}
      {autoCalcSummary ? <div className="info-banner">{autoCalcSummary}</div> : null}
      <SummaryBar
        importedCount={sharpRows.length}
        eligibleCount={culled.filter((pilot) => !pilot.over600).length}
        selectedCount={selectedConfiguredPilots.length}
        phaseLabel={phaseLabel}
        windowLabel={windowLabel}
      />
      <section className="workspace-tabs-panel">
        <div className="workspace-tab-bar" role="tablist" aria-label="Workspace sections">
          <button
            className={activeWorkspaceTab === "pilots" ? "workspace-tab active" : "workspace-tab"}
            onClick={() => setActiveWorkspaceTab("pilots")}
            type="button"
            role="tab"
            aria-selected={activeWorkspaceTab === "pilots"}
          >
            <span className="workspace-tab-label">Pilot Setup</span>
            <span className="workspace-tab-meta">{selectedConfiguredPilots.length} selected</span>
          </button>
          <button
            className={activeWorkspaceTab === "forecast" ? "workspace-tab active" : "workspace-tab"}
            onClick={() => setActiveWorkspaceTab("forecast")}
            type="button"
            role="tab"
            aria-selected={activeWorkspaceTab === "forecast"}
          >
            <span className="workspace-tab-label">HTQ Forecast</span>
            <span className="workspace-tab-meta">{phaseWindow.months.length} months</span>
          </button>
          <button
            className={activeWorkspaceTab === "sorties" ? "workspace-tab active" : "workspace-tab"}
            onClick={() => setActiveWorkspaceTab("sorties")}
            type="button"
            role="tab"
            aria-selected={activeWorkspaceTab === "sorties"}
          >
            <span className="workspace-tab-label">Sorties</span>
            <span className="workspace-tab-meta">assumptions + load</span>
          </button>
          <button
            className={activeWorkspaceTab === "history" ? "workspace-tab active" : "workspace-tab"}
            onClick={() => setActiveWorkspaceTab("history")}
            type="button"
            role="tab"
            aria-selected={activeWorkspaceTab === "history"}
          >
            <span className="workspace-tab-label">History</span>
            <span className="workspace-tab-meta">{archiveSnapshots.length} saved</span>
          </button>
        </div>
      </section>

      {activeWorkspaceTab === "pilots" ? (
        <>
          <SelectedPilotSettings
            pilots={selectedPilotsForSettings}
            reviewResults={autoCalcReviewResults}
            onUpdatePilotSettings={updatePilotSettings}
          />
          <PilotSelector
            pilots={culled}
            selectedNames={selectedNames}
            onToggle={togglePilot}
            onSelectAll={selectAllEligiblePilots}
          />
        </>
      ) : null}

      {activeWorkspaceTab === "forecast" ? (
        <ProjectionTable rows={projections} months={phaseWindow.months} />
      ) : null}

      {activeWorkspaceTab === "sorties" ? (
        <SortiesTable
          rows={projections}
          months={phaseWindow.months}
          sortiesConfig={sortiesConfig}
          setAverageHomeCycleSortieLength={handleSetAverageHomeCycleSortieLength}
          setAverageDeploymentSortieLength={handleSetAverageDeploymentSortieLength}
          setNumberOfPilots={handleSetNumberOfPilots}
        />
      ) : null}

      {activeWorkspaceTab === "history" ? (
        <ArchiveHistory
          snapshots={archiveSnapshots}
          currentSquadron={selectedSquadron}
          onDeleteCurrentSquadronHistory={deleteCurrentSquadronHistory}
          onDeleteAllHistory={deleteAllHistory}
          onResetLocalWorkspace={resetLocalWorkspace}
        />
      ) : null}
    </div>
  );
}
