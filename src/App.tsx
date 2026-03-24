import { useMemo, useState } from "react";
import { Header } from "./components/Header";
import { Controls } from "./components/Controls";
import { SummaryBar } from "./components/SummaryBar";
import { PilotSelector } from "./components/PilotSelector";
import { ProjectionTable } from "./components/ProjectionTable";
import { SelectedPilotSettings } from "./components/SelectedPilotSettings";
import { SortiesTable } from "./components/SortiesTable";
import { autoCalculateSelectedPilotSettings } from "./core/autoCalculate";
import {
  DEFAULT_TARGET_TRAINING_MONTH,
  DEFAULT_DEPLOYMENT_HOURS,
  DEFAULT_DEPLOYMENT_SORTIE_LENGTH,
  DEFAULT_HOMECYCLE_HOURS,
  DEFAULT_HOME_CYCLE_SORTIE_LENGTH,
  DEFAULT_SORTIE_PILOT_COUNT,
  PHASE_LABELS
} from "./core/constants";
import { buildCulledData } from "./core/culledData";
import { startOfMonth } from "./core/date";
import { buildProjectionMonths } from "./core/phasePatterns";
import { parseWorkbookBytes } from "./core/parseWorkbook";
import { buildPdfReportHtml } from "./core/pdfReport";
import { projectHoursToQualify, projectionsToCsv } from "./core/projectionEngine";
import type {
  AutoCalcResult,
  PhaseKey,
  PilotProjectionSettings,
  SharpPilot,
  SortiesConfig
} from "./types/pilot";

type WorkspaceTabKey = "pilots" | "forecast" | "sorties";

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
    return `Auto-calculated all ${results.length} selected pilots within the 20-60 deployed and 10-20 homecycle limits.`;
  }

  return `Auto-calculated ${calculatedCount} of ${results.length} selected pilots. Review the highlighted pilots in Selected Pilot Settings.`;
}

export default function App() {
  const [phase, setPhase] = useState<PhaseKey>("A");
  const [defaultDeploymentHours, setDefaultDeploymentHours] = useState(DEFAULT_DEPLOYMENT_HOURS);
  const [defaultHomecycleHours, setDefaultHomecycleHours] = useState(DEFAULT_HOMECYCLE_HOURS);
  const [averageHomeCycleSortieLength, setAverageHomeCycleSortieLength] = useState(
    DEFAULT_HOME_CYCLE_SORTIE_LENGTH
  );
  const [averageDeploymentSortieLength, setAverageDeploymentSortieLength] = useState(
    DEFAULT_DEPLOYMENT_SORTIE_LENGTH
  );
  const [numberOfPilots, setNumberOfPilots] = useState(DEFAULT_SORTIE_PILOT_COUNT);
  const [monthModeExact, setMonthModeExact] = useState(false);
  const [sharpRows, setSharpRows] = useState<SharpPilot[]>([]);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [pilotSettings, setPilotSettings] = useState<Record<string, PilotProjectionSettings>>({});
  const [sourceLabel, setSourceLabel] = useState("");
  const [error, setError] = useState("");
  const [autoCalcSummary, setAutoCalcSummary] = useState("");
  const [autoCalcReviewResults, setAutoCalcReviewResults] = useState<AutoCalcResult[]>([]);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTabKey>("pilots");
  const [projectionBaseDate] = useState(() => startOfMonth(new Date()));

  const sortiesConfig = useMemo<SortiesConfig>(
    () => ({
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

  const selectedConfiguredPilots = useMemo(
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

  const selectedPilotsForSettings = useMemo(
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

  const phaseLabel = PHASE_LABELS[phase];
  const windowLabel =
    phaseWindow.months.length === 0
      ? "Unavailable"
      : `${phaseWindow.months[0].monthLabel} ${phaseWindow.months[0].yearLabel} to ${
          phaseWindow.months[phaseWindow.months.length - 1].monthLabel
        } ${phaseWindow.months[phaseWindow.months.length - 1].yearLabel}`;
  const activeError = error || phaseWindow.error || "";

  async function openWorkbook() {
    try {
      setError("");
      setAutoCalcSummary("");
      setAutoCalcReviewResults([]);
      const response = await window.htqApi.openWorkbook();
      if (!response) return;

      const workbook = parseWorkbookBytes(response.bytes);

      setSharpRows(workbook.pilots);
      setPhase(workbook.initialPhase ?? "A");
      setMonthModeExact(workbook.initialMonthModeExact ?? false);
      setSelectedNames(workbook.initialSelectedNames ?? []);
      setPilotSettings(workbook.initialPilotSettings ?? {});
      setDefaultDeploymentHours(DEFAULT_DEPLOYMENT_HOURS);
      setDefaultHomecycleHours(DEFAULT_HOMECYCLE_HOURS);
      setAverageHomeCycleSortieLength(
        workbook.initialSortiesConfig?.averageHomeCycleSortieLength ??
          DEFAULT_HOME_CYCLE_SORTIE_LENGTH
      );
      setAverageDeploymentSortieLength(
        workbook.initialSortiesConfig?.averageDeploymentSortieLength ??
          DEFAULT_DEPLOYMENT_SORTIE_LENGTH
      );
      setNumberOfPilots(
        workbook.initialSortiesConfig?.numberOfPilots ?? DEFAULT_SORTIE_PILOT_COUNT
      );
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
      selectedPilots: selectedPilotsForSettings,
      projections,
      sortiesConfig
    });

    await window.htqApi.savePdf({
      suggestedName: "htq-projection-report.pdf",
      html: content
    });
  }

  function togglePilot(name: string) {
    setAutoCalcSummary("");
    setAutoCalcReviewResults([]);
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
    setAutoCalcSummary("");
    setPilotSettings((current) => ({
      ...current,
      [name]: {
        ...(current[name] ?? createDefaultPilotSettings(defaultDeploymentHours, defaultHomecycleHours)),
        ...patch
      }
    }));
  }

  function selectAllEligiblePilots() {
    setAutoCalcSummary("");
    setAutoCalcReviewResults([]);
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

  function applyDefaultsToSelected() {
    setAutoCalcSummary("");
    setAutoCalcReviewResults([]);
    setPilotSettings((current) => {
      const next = { ...current };

      for (const name of selectedNames) {
        next[name] = {
          ...(next[name] ?? createDefaultPilotSettings(defaultDeploymentHours, defaultHomecycleHours)),
          deploymentHours: defaultDeploymentHours,
          frtpHours: defaultHomecycleHours
        };
      }

      return next;
    });
  }

  function autoCalculateSelected() {
    if (phaseWindow.error || selectedConfiguredPilots.length === 0) {
      return;
    }

    const results = autoCalculateSelectedPilotSettings(selectedConfiguredPilots, phaseWindow.months);
    const unresolved = results.filter((result) => result.status !== "calculated");

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
    setAutoCalcReviewResults(unresolved);
    setActiveWorkspaceTab("pilots");
  }

  return (
    <div className="app-shell">
      <Header />
      <Controls
        phase={phase}
        setPhase={setPhase}
        defaultDeploymentHours={defaultDeploymentHours}
        setDefaultDeploymentHours={setDefaultDeploymentHours}
        defaultHomecycleHours={defaultHomecycleHours}
        setDefaultHomecycleHours={setDefaultHomecycleHours}
        monthModeExact={monthModeExact}
        setMonthModeExact={setMonthModeExact}
        onOpenWorkbook={openWorkbook}
        onExportCsv={exportCsv}
        onExportPdf={exportPdf}
        onApplyDefaultsToSelected={applyDefaultsToSelected}
        onAutoCalculateSelected={autoCalculateSelected}
        exportDisabled={projections.length === 0 || Boolean(phaseWindow.error)}
        applyDefaultsDisabled={selectedConfiguredPilots.length === 0}
        autoCalculateDisabled={selectedConfiguredPilots.length === 0 || Boolean(phaseWindow.error)}
        sourceLabel={sourceLabel}
      />
      {activeError ? <div className="error-banner">{activeError}</div> : null}
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
          setAverageHomeCycleSortieLength={setAverageHomeCycleSortieLength}
          setAverageDeploymentSortieLength={setAverageDeploymentSortieLength}
          setNumberOfPilots={setNumberOfPilots}
        />
      ) : null}
    </div>
  );
}
