import { useDeferredValue, useMemo, useState } from "react";
import {
  formatOptionalTrainingMonth,
  formatPilotLevel
} from "../core/display";
import type { CulledPilot } from "../types/pilot";

type Props = {
  pilots: CulledPilot[];
  selectedNames: string[];
  onToggle: (name: string) => void;
  onSelectAll: () => void;
};

function formatMaybeNumber(value: number | null): string {
  return value == null ? "" : value.toFixed(1);
}

export function PilotSelector({ pilots, selectedNames, onToggle, onSelectAll }: Props) {
  const [search, setSearch] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const eligible = useMemo(() => pilots.filter((pilot) => !pilot.over600), [pilots]);
  const selectedSet = useMemo(() => new Set(selectedNames), [selectedNames]);

  const visiblePilots = useMemo(() => {
    return eligible
      .filter((pilot) => {
        if (selectedOnly && !selectedSet.has(pilot.name)) {
          return false;
        }

        if (!deferredSearch) {
          return true;
        }

        const searchText = [
          pilot.name,
          pilot.level,
          formatPilotLevel(pilot.level),
          pilot.trainingMonth != null ? String(pilot.trainingMonth) : "",
          formatOptionalTrainingMonth(pilot.trainingMonth, ""),
          pilot.pilotHours.toFixed(1)
        ]
          .join(" ")
          .toLowerCase();

        return searchText.includes(deferredSearch);
      })
      .sort((left, right) => {
        const leftSelected = selectedSet.has(left.name) ? 1 : 0;
        const rightSelected = selectedSet.has(right.name) ? 1 : 0;

        if (leftSelected !== rightSelected) {
          return rightSelected - leftSelected;
        }

        return left.name.localeCompare(right.name);
      });
  }, [deferredSearch, eligible, selectedOnly, selectedSet]);
  const allEligibleSelected = eligible.length > 0 && eligible.every((pilot) => selectedSet.has(pilot.name));

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Selection</p>
          <h2>Pilot Selection</h2>
        </div>
        <p className="panel-subtitle">
          Search and select eligible pilots. Selected pilots stay pinned to the top.
        </p>
      </div>

      <div className="pilot-toolbar">
        <input
          className="search-input"
          type="search"
          placeholder="Search by name, level, or training month"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className={selectedOnly ? "button button-secondary is-active" : "button button-secondary"}
          type="button"
          onClick={() => setSelectedOnly((current) => !current)}
        >
          {selectedOnly ? "Showing Selected" : "Selected Only"}
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={onSelectAll}
          disabled={allEligibleSelected}
        >
          {allEligibleSelected ? "All Selected" : "Select All"}
        </button>
        <div className="section-pill">{visiblePilots.length} shown</div>
      </div>

      {visiblePilots.length === 0 ? (
        <p className="empty-state">No eligible pilots match the current search or filter.</p>
      ) : (
        <div className="pilot-grid">
          {visiblePilots.map((pilot) => {
            const isSelected = selectedNames.includes(pilot.name);

            return (
              <button
                key={pilot.name}
                className={isSelected ? "pilot-card selected" : "pilot-card"}
                onClick={() => onToggle(pilot.name)}
                type="button"
              >
                <div className="pilot-card-top">
                  <div>
                    <div className="pilot-name">{pilot.name}</div>
                    <div className="pilot-subtitle">
                      {pilot.level ? formatPilotLevel(pilot.level) : "Unknown level"}
                    </div>
                  </div>
                  <span className={isSelected ? "status-pill selected" : "status-pill"}>
                    {isSelected ? "Selected" : "Click to add"}
                  </span>
                </div>

                <div className="pilot-metrics">
                  <div className="pilot-metric">
                    <span className="metric-label">Current Hours</span>
                    <strong>{pilot.pilotHours.toFixed(1)}</strong>
                  </div>
                  <div className="pilot-metric">
                    <span className="metric-label">Training Month</span>
                    <strong>{formatOptionalTrainingMonth(pilot.trainingMonth)}</strong>
                  </div>
                  <div className="pilot-metric">
                    <span className="metric-label">Need / Mo To 600</span>
                    <strong>{formatMaybeNumber(pilot.hrsPerMonthTo600) || "--"}</strong>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
