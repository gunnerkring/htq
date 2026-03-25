import { formatPilotDisplayName, getPilotIdentityKey } from "./display";
import { computeRequiredHoursPerMonth as computeRequirementHoursPerMonth } from "./requirements";
import type {
  AutoCalcResult,
  CulledPilot,
  PilotProjectionSettings,
  PhaseKey,
  ProjectionMonth,
  ProjectionRow
} from "../types/pilot";
import type {
  ArchivedPilotProjection,
  ArchiveHistoryAnalysis,
  ArchiveInsight,
  ArchiveRequirementPoint,
  ArchiveRequirementRow,
  ArchiveTrendItem,
  ArchiveTrendItemType,
  ArchiveTrendSummary,
  ProjectionArchiveSnapshot
} from "../types/archive";

const ARCHIVE_STORAGE_KEY = "htq-projection-archive-v1";
const MAX_ARCHIVE_SNAPSHOTS = 120;

type SnapshotPilotInput = {
  pilot: CulledPilot;
  settings: PilotProjectionSettings;
};

type CreateArchiveSnapshotInput = {
  savedAt?: Date;
  reportMonthDate: Date;
  squadron: string;
  phase: PhaseKey;
  phaseLabel: string;
  windowLabel: string;
  sourceLabel: string;
  monthModeExact: boolean;
  importedCount: number;
  eligibleCount: number;
  reviewResults: AutoCalcResult[];
  selectedPilots: SnapshotPilotInput[];
  projections: ProjectionRow[];
  months: ProjectionMonth[];
};

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

function normalizeReportMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function createSnapshotId(savedAt: Date): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${savedAt.getTime()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortSnapshots(
  left: ProjectionArchiveSnapshot,
  right: ProjectionArchiveSnapshot
): number {
  const leftReportMonth = Date.parse(left.reportMonth || left.savedAt);
  const rightReportMonth = Date.parse(right.reportMonth || right.savedAt);

  if (leftReportMonth !== rightReportMonth) {
    return rightReportMonth - leftReportMonth;
  }

  return Date.parse(right.savedAt) - Date.parse(left.savedAt);
}

function formatQualificationLabel(month: ProjectionMonth | null): string | null {
  if (!month) {
    return null;
  }

  return `${month.monthLabel} ${month.yearLabel}`;
}

function buildArchivedPilotProjection(
  input: SnapshotPilotInput,
  projection: ProjectionRow | undefined,
  months: ProjectionMonth[],
  reviewResult: AutoCalcResult | undefined
): ArchivedPilotProjection {
  const qualificationMonth =
    projection?.qualifiesByEndOfMonthIndex != null
      ? months[projection.qualifiesByEndOfMonthIndex]
      : null;

  return {
    name: input.pilot.name,
    identityKey: getPilotIdentityKey(input.pilot.name),
    level: input.pilot.level,
    currentHours: input.pilot.pilotHours,
    startTrainingMonth: input.pilot.trainingMonth,
    targetTrainingMonth: input.settings.targetTrainingMonth,
    threshold: projection?.threshold ?? (input.settings.waiver550 ? 550 : 600),
    waiver550: input.settings.waiver550,
    tttWaiver: input.settings.tttWaiver,
    deploymentHours: input.settings.deploymentHours,
    frtpHours: input.settings.frtpHours,
    qualifiesInWindow: qualificationMonth != null,
    qualifiesByEndOfMonthIndex: projection?.qualifiesByEndOfMonthIndex ?? null,
    qualificationDate: qualificationMonth?.date.toISOString() ?? null,
    qualificationLabel: formatQualificationLabel(qualificationMonth),
    needsReview: Boolean(reviewResult),
    reviewMessage: reviewResult?.message ?? null
  };
}

function getQualificationTimestamp(pilot: ArchivedPilotProjection): number | null {
  if (!pilot.qualificationDate) {
    return null;
  }

  const timestamp = Date.parse(pilot.qualificationDate);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getQualificationDescription(pilot: ArchivedPilotProjection): string {
  return pilot.qualificationLabel ? `end of ${pilot.qualificationLabel}` : "not qualify within the current window";
}

function getReportMonthTimestamp(snapshot: ProjectionArchiveSnapshot): number {
  return Date.parse(snapshot.reportMonth || snapshot.savedAt);
}

function formatIdentityLabel(
  identityKey: string,
  latestByIdentity: Map<string, ArchivedPilotProjection>,
  fallbackByIdentity: Map<string, ArchivedPilotProjection>
): string {
  const pilot = latestByIdentity.get(identityKey) ?? fallbackByIdentity.get(identityKey);
  return formatPilotDisplayName(pilot?.name ?? identityKey);
}

function getPilotRankToken(name: string): string {
  const segments = name
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return (segments[segments.length - 1] ?? "").toUpperCase();
}

function computeRequiredHoursPerMonth(pilot: ArchivedPilotProjection): number | null {
  return computeRequirementHoursPerMonth({
    currentHours: pilot.currentHours,
    threshold: pilot.threshold,
    currentTrainingMonth: pilot.startTrainingMonth,
    targetTrainingMonth: pilot.targetTrainingMonth
  });
}

function buildRequirementPoint(
  snapshot: ProjectionArchiveSnapshot,
  pilot: ArchivedPilotProjection
): ArchiveRequirementPoint {
  return {
    snapshotId: snapshot.id,
    reportMonth: snapshot.reportMonth,
    reportMonthLabel: snapshot.reportMonthLabel,
    isPresent: true,
    requiredHoursPerMonth: computeRequiredHoursPerMonth(pilot),
    targetTrainingMonth: pilot.targetTrainingMonth,
    threshold: pilot.threshold,
    qualifiesInWindow: pilot.qualifiesInWindow,
    currentHours: pilot.currentHours,
    trainingMonth: pilot.startTrainingMonth
  };
}

function buildMissingRequirementPoint(
  snapshot: ProjectionArchiveSnapshot
): ArchiveRequirementPoint {
  return {
    snapshotId: snapshot.id,
    reportMonth: snapshot.reportMonth,
    reportMonthLabel: snapshot.reportMonthLabel,
    isPresent: false,
    requiredHoursPerMonth: null,
    targetTrainingMonth: 0,
    threshold: 0,
    qualifiesInWindow: false,
    currentHours: 0,
    trainingMonth: null
  };
}

function itemPriority(type: ArchiveTrendItemType): number {
  const priorities: Record<ArchiveTrendItemType, number> = {
    "lost-qualification": 0,
    slipped: 1,
    "review-opened": 2,
    improved: 3,
    "newly-qualified": 4,
    "review-resolved": 5,
    added: 6,
    removed: 7
  };

  return priorities[type];
}

export function loadArchiveSnapshots(): ProjectionArchiveSnapshot[] {
  try {
    const raw = window.localStorage.getItem(ARCHIVE_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeArchiveSnapshots(parsed as ProjectionArchiveSnapshot[]);
  } catch {
    return [];
  }
}

export function normalizeArchiveSnapshots(
  snapshots: ProjectionArchiveSnapshot[]
): ProjectionArchiveSnapshot[] {
  return snapshots
      .map((snapshot) => ({
        ...snapshot,
        reportMonth: snapshot.reportMonth || snapshot.savedAt
      }))
      .map((snapshot) => ({
        ...snapshot,
        pilots: snapshot.pilots.map((pilot) => {
          const legacyPilot = pilot as ArchivedPilotProjection & {
            qualifiesInMonthIndex?: number | null;
          };

          return {
            ...pilot,
            identityKey: pilot.identityKey || getPilotIdentityKey(pilot.name),
            qualifiesByEndOfMonthIndex:
              pilot.qualifiesByEndOfMonthIndex ?? legacyPilot.qualifiesInMonthIndex ?? null
          };
        })
      }))
      .sort(sortSnapshots);
}

export function persistArchiveSnapshots(snapshots: ProjectionArchiveSnapshot[]): void {
  try {
    window.localStorage.setItem(
      ARCHIVE_STORAGE_KEY,
      JSON.stringify(snapshots.slice(0, MAX_ARCHIVE_SNAPSHOTS))
    );
  } catch {
    // Ignore storage failures so the forecast workflow stays usable.
  }
}

export function appendArchiveSnapshot(
  snapshots: ProjectionArchiveSnapshot[],
  snapshot: ProjectionArchiveSnapshot
): ProjectionArchiveSnapshot[] {
  return [...snapshots, snapshot].sort(sortSnapshots).slice(0, MAX_ARCHIVE_SNAPSHOTS);
}

export function createArchiveSnapshot(
  input: CreateArchiveSnapshotInput
): ProjectionArchiveSnapshot {
  const savedAt = input.savedAt ?? new Date();
  const projectionByName = new Map(input.projections.map((projection) => [projection.name, projection]));
  const reviewByName = new Map(input.reviewResults.map((result) => [result.name, result]));
  const pilots = input.selectedPilots
    .map((pilotInput) =>
      buildArchivedPilotProjection(
        pilotInput,
        projectionByName.get(pilotInput.pilot.name),
        input.months,
        reviewByName.get(pilotInput.pilot.name)
      )
    )
    .sort((left, right) => formatPilotDisplayName(left.name).localeCompare(formatPilotDisplayName(right.name)));

  return {
    id: createSnapshotId(savedAt),
    savedAt: savedAt.toISOString(),
    reportMonth: normalizeReportMonth(input.reportMonthDate).toISOString(),
    reportMonthLabel: formatMonthYear(input.reportMonthDate),
    squadron: input.squadron,
    phase: input.phase,
    phaseLabel: input.phaseLabel,
    windowLabel: input.windowLabel,
    sourceLabel: input.sourceLabel,
    monthModeExact: input.monthModeExact,
    importedCount: input.importedCount,
    eligibleCount: input.eligibleCount,
    selectedCount: input.selectedPilots.length,
    qualifiedCount: pilots.filter((pilot) => pilot.qualifiesInWindow).length,
    reviewCount: pilots.filter((pilot) => pilot.needsReview).length,
    pilots
  };
}

export function buildArchiveTrendSummary(
  latestSnapshot: ProjectionArchiveSnapshot,
  previousSnapshot: ProjectionArchiveSnapshot | null
): ArchiveTrendSummary {
  if (!previousSnapshot) {
    return {
      previousSnapshot: null,
      qualifiedDelta: 0,
      reviewDelta: 0,
      improvedCount: 0,
      slippedCount: 0,
      reviewOpenedCount: 0,
      reviewResolvedCount: 0,
      addedCount: 0,
      removedCount: 0,
      notableItems: []
    };
  }

  const previousPilotsByIdentity = new Map(
    previousSnapshot.pilots.map((pilot) => [pilot.identityKey, pilot])
  );
  const currentPilotsByIdentity = new Map(
    latestSnapshot.pilots.map((pilot) => [pilot.identityKey, pilot])
  );
  const notableItems: ArchiveTrendItem[] = [];

  let improvedCount = 0;
  let slippedCount = 0;
  let reviewOpenedCount = 0;
  let reviewResolvedCount = 0;
  let addedCount = 0;
  let removedCount = 0;

  for (const currentPilot of latestSnapshot.pilots) {
    const previousPilot = previousPilotsByIdentity.get(currentPilot.identityKey);

    if (!previousPilot) {
      addedCount += 1;
      notableItems.push({
        type: "added",
        name: currentPilot.name,
        detail: `${formatPilotDisplayName(currentPilot.name)} was added to the projected roster.`
      });
      continue;
    }

    const currentQualificationTimestamp = getQualificationTimestamp(currentPilot);
    const previousQualificationTimestamp = getQualificationTimestamp(previousPilot);

    if (previousQualificationTimestamp == null && currentQualificationTimestamp != null) {
      improvedCount += 1;
      notableItems.push({
        type: "newly-qualified",
        name: currentPilot.name,
        detail: `${formatPilotDisplayName(currentPilot.name)} now qualifies by ${getQualificationDescription(currentPilot)}.`
      });
    } else if (previousQualificationTimestamp != null && currentQualificationTimestamp == null) {
      slippedCount += 1;
      notableItems.push({
        type: "lost-qualification",
        name: currentPilot.name,
        detail: `${formatPilotDisplayName(currentPilot.name)} no longer qualifies within the forecast window.`
      });
    } else if (
      previousQualificationTimestamp != null &&
      currentQualificationTimestamp != null &&
      previousQualificationTimestamp !== currentQualificationTimestamp
    ) {
      if (currentQualificationTimestamp < previousQualificationTimestamp) {
        improvedCount += 1;
        notableItems.push({
          type: "improved",
          name: currentPilot.name,
          detail: `${formatPilotDisplayName(currentPilot.name)} moved from ${getQualificationDescription(previousPilot)} to ${getQualificationDescription(currentPilot)}.`
        });
      } else {
        slippedCount += 1;
        notableItems.push({
          type: "slipped",
          name: currentPilot.name,
          detail: `${formatPilotDisplayName(currentPilot.name)} slipped from ${getQualificationDescription(previousPilot)} to ${getQualificationDescription(currentPilot)}.`
        });
      }
    }

    if (!previousPilot.needsReview && currentPilot.needsReview) {
      reviewOpenedCount += 1;
      notableItems.push({
        type: "review-opened",
        name: currentPilot.name,
        detail: `${formatPilotDisplayName(currentPilot.name)} now needs review: ${currentPilot.reviewMessage ?? "settings need adjustment"}.`
      });
    } else if (previousPilot.needsReview && !currentPilot.needsReview) {
      reviewResolvedCount += 1;
      notableItems.push({
        type: "review-resolved",
        name: currentPilot.name,
        detail: `${formatPilotDisplayName(currentPilot.name)} no longer needs adjustment.`
      });
    }
  }

  for (const previousPilot of previousSnapshot.pilots) {
    if (currentPilotsByIdentity.has(previousPilot.identityKey)) {
      continue;
    }

    removedCount += 1;
    notableItems.push({
      type: "removed",
      name: previousPilot.name,
      detail: `${formatPilotDisplayName(previousPilot.name)} is no longer in the projected roster.`
    });
  }

  return {
    previousSnapshot,
    qualifiedDelta: latestSnapshot.qualifiedCount - previousSnapshot.qualifiedCount,
    reviewDelta: latestSnapshot.reviewCount - previousSnapshot.reviewCount,
    improvedCount,
    slippedCount,
    reviewOpenedCount,
    reviewResolvedCount,
    addedCount,
    removedCount,
    notableItems: notableItems.sort((left, right) => itemPriority(left.type) - itemPriority(right.type))
  };
}

export function buildArchiveHistoryAnalysis(
  snapshots: ProjectionArchiveSnapshot[]
): ArchiveHistoryAnalysis {
  if (snapshots.length === 0) {
    return {
      snapshotCount: 0,
      oldestSnapshot: null,
      latestSnapshot: null,
      netQualifiedDelta: 0,
      netReviewDelta: 0,
      continuingPilotCount: 0,
      rankChangeCount: 0,
      earlierCount: 0,
      laterCount: 0,
      newlyQualifiedSinceStartCount: 0,
      lostQualificationSinceStartCount: 0,
      repeatedSlipCount: 0,
      persistentReviewCount: 0,
      insights: []
    };
  }

  const timeline = [...snapshots].sort(
    (left, right) => getReportMonthTimestamp(left) - getReportMonthTimestamp(right)
  );
  const oldestSnapshot = timeline[0] ?? null;
  const latestSnapshot = timeline[timeline.length - 1] ?? null;

  if (!oldestSnapshot || !latestSnapshot) {
    return {
      snapshotCount: snapshots.length,
      oldestSnapshot,
      latestSnapshot,
      netQualifiedDelta: 0,
      netReviewDelta: 0,
      continuingPilotCount: 0,
      rankChangeCount: 0,
      earlierCount: 0,
      laterCount: 0,
      newlyQualifiedSinceStartCount: 0,
      lostQualificationSinceStartCount: 0,
      repeatedSlipCount: 0,
      persistentReviewCount: 0,
      insights: []
    };
  }

  const oldestByIdentity = new Map(oldestSnapshot.pilots.map((pilot) => [pilot.identityKey, pilot]));
  const latestByIdentity = new Map(latestSnapshot.pilots.map((pilot) => [pilot.identityKey, pilot]));
  const allByIdentity = new Map<string, ArchivedPilotProjection>();
  const ranksByIdentity = new Map<string, Set<string>>();
  const reviewCountByIdentity = new Map<string, number>();
  const slipCountByIdentity = new Map<string, number>();

  for (const snapshot of timeline) {
    for (const pilot of snapshot.pilots) {
      allByIdentity.set(pilot.identityKey, pilot);

      const existingRanks = ranksByIdentity.get(pilot.identityKey) ?? new Set<string>();
      existingRanks.add(getPilotRankToken(pilot.name));
      ranksByIdentity.set(pilot.identityKey, existingRanks);

      if (pilot.needsReview) {
        reviewCountByIdentity.set(
          pilot.identityKey,
          (reviewCountByIdentity.get(pilot.identityKey) ?? 0) + 1
        );
      }
    }
  }

  for (let index = 1; index < timeline.length; index += 1) {
    const previousSnapshot = timeline[index - 1];
    const currentSnapshot = timeline[index];
    const previousByIdentity = new Map(
      previousSnapshot.pilots.map((pilot) => [pilot.identityKey, pilot])
    );

    for (const currentPilot of currentSnapshot.pilots) {
      const previousPilot = previousByIdentity.get(currentPilot.identityKey);

      if (!previousPilot) {
        continue;
      }

      const previousTimestamp = getQualificationTimestamp(previousPilot);
      const currentTimestamp = getQualificationTimestamp(currentPilot);

      if (
        previousTimestamp != null &&
        currentTimestamp != null &&
        currentTimestamp > previousTimestamp
      ) {
        slipCountByIdentity.set(
          currentPilot.identityKey,
          (slipCountByIdentity.get(currentPilot.identityKey) ?? 0) + 1
        );
      }
    }
  }

  let continuingPilotCount = 0;
  let earlierCount = 0;
  let laterCount = 0;
  let newlyQualifiedSinceStartCount = 0;
  let lostQualificationSinceStartCount = 0;

  for (const latestPilot of latestSnapshot.pilots) {
    const oldestPilot = oldestByIdentity.get(latestPilot.identityKey);

    if (!oldestPilot) {
      continue;
    }

    continuingPilotCount += 1;

    const oldestTimestamp = getQualificationTimestamp(oldestPilot);
    const latestTimestamp = getQualificationTimestamp(latestPilot);

    if (oldestTimestamp == null && latestTimestamp != null) {
      newlyQualifiedSinceStartCount += 1;
    } else if (oldestTimestamp != null && latestTimestamp == null) {
      lostQualificationSinceStartCount += 1;
    } else if (oldestTimestamp != null && latestTimestamp != null) {
      if (latestTimestamp < oldestTimestamp) {
        earlierCount += 1;
      } else if (latestTimestamp > oldestTimestamp) {
        laterCount += 1;
      }
    }
  }

  const rankChangedIdentityKeys = Array.from(ranksByIdentity.entries())
    .filter(([, ranks]) => ranks.size > 1)
    .map(([identityKey]) => identityKey);
  const repeatedSlipIdentityKeys = Array.from(slipCountByIdentity.entries())
    .filter(([, count]) => count >= 2)
    .map(([identityKey]) => identityKey);
  const persistentReviewIdentityKeys = Array.from(reviewCountByIdentity.entries())
    .filter(([, count]) => count >= 2)
    .map(([identityKey]) => identityKey);

  const insights: ArchiveInsight[] = [];

  insights.push({
    tone: "neutral",
    title: "History Span",
    detail: `${timeline.length} saved reports from ${oldestSnapshot.reportMonthLabel} to ${latestSnapshot.reportMonthLabel}.`
  });

  if (latestSnapshot.qualifiedCount !== oldestSnapshot.qualifiedCount) {
    insights.push({
      tone: latestSnapshot.qualifiedCount > oldestSnapshot.qualifiedCount ? "positive" : "warning",
      title: "Qualification Trend",
      detail: `${latestSnapshot.qualifiedCount} pilots qualify in the current window, ${latestSnapshot.qualifiedCount > oldestSnapshot.qualifiedCount ? "up" : "down"} ${Math.abs(latestSnapshot.qualifiedCount - oldestSnapshot.qualifiedCount)} from ${oldestSnapshot.reportMonthLabel}.`
    });
  } else {
    insights.push({
      tone: "neutral",
      title: "Qualification Trend",
      detail: `Qualified-in-window count is steady at ${latestSnapshot.qualifiedCount} from ${oldestSnapshot.reportMonthLabel} through ${latestSnapshot.reportMonthLabel}.`
    });
  }

  if (continuingPilotCount > 0) {
    insights.push({
      tone: laterCount > earlierCount ? "warning" : earlierCount > laterCount ? "positive" : "neutral",
      title: "Continuing Roster",
      detail: `${continuingPilotCount} of ${latestSnapshot.selectedCount} current pilots were already in the first saved report; ${earlierCount} are qualifying earlier overall and ${laterCount} are qualifying later.`
    });
  }

  if (rankChangedIdentityKeys.length > 0) {
    const names = rankChangedIdentityKeys
      .slice(0, 3)
      .map((identityKey) => formatIdentityLabel(identityKey, latestByIdentity, allByIdentity))
      .join(", ");

    insights.push({
      tone: "neutral",
      title: "Rank Changes",
      detail: `${rankChangedIdentityKeys.length} pilots changed rank while staying linked in history, including ${names}${rankChangedIdentityKeys.length > 3 ? ", and others" : ""}.`
    });
  }

  if (repeatedSlipIdentityKeys.length > 0) {
    const names = repeatedSlipIdentityKeys
      .slice(0, 3)
      .map((identityKey) => formatIdentityLabel(identityKey, latestByIdentity, allByIdentity))
      .join(", ");

    insights.push({
      tone: "warning",
      title: "Recurring Slip",
      detail: `${repeatedSlipIdentityKeys.length} pilots slipped in two or more report-to-report comparisons, led by ${names}${repeatedSlipIdentityKeys.length > 3 ? ", and others" : ""}.`
    });
  }

  if (persistentReviewIdentityKeys.length > 0) {
    const names = persistentReviewIdentityKeys
      .slice(0, 3)
      .map((identityKey) => formatIdentityLabel(identityKey, latestByIdentity, allByIdentity))
      .join(", ");

    insights.push({
      tone: "warning",
      title: "Recurring Review",
      detail: `${persistentReviewIdentityKeys.length} pilots needed review in multiple saved reports, including ${names}${persistentReviewIdentityKeys.length > 3 ? ", and others" : ""}.`
    });
  } else if (timeline.length > 1) {
    insights.push({
      tone: "positive",
      title: "Recurring Review",
      detail: "No pilot has needed review in more than one saved report so far."
    });
  }

  if (newlyQualifiedSinceStartCount > 0 || lostQualificationSinceStartCount > 0) {
    insights.push({
      tone: lostQualificationSinceStartCount > 0 ? "warning" : "positive",
      title: "Window Coverage",
      detail: `${newlyQualifiedSinceStartCount} continuing pilots moved into the qualification window since ${oldestSnapshot.reportMonthLabel}, while ${lostQualificationSinceStartCount} fell out of it.`
    });
  }

  return {
    snapshotCount: timeline.length,
    oldestSnapshot,
    latestSnapshot,
    netQualifiedDelta: latestSnapshot.qualifiedCount - oldestSnapshot.qualifiedCount,
    netReviewDelta: latestSnapshot.reviewCount - oldestSnapshot.reviewCount,
    continuingPilotCount,
    rankChangeCount: rankChangedIdentityKeys.length,
    earlierCount,
    laterCount,
    newlyQualifiedSinceStartCount,
    lostQualificationSinceStartCount,
    repeatedSlipCount: repeatedSlipIdentityKeys.length,
    persistentReviewCount: persistentReviewIdentityKeys.length,
    insights
  };
}

export function buildArchiveRequirementRows(
  snapshots: ProjectionArchiveSnapshot[]
): ArchiveRequirementRow[] {
  if (snapshots.length === 0) {
    return [];
  }

  const timeline = [...snapshots].sort(
    (left, right) => getReportMonthTimestamp(left) - getReportMonthTimestamp(right)
  );
  const latestSnapshot = timeline[timeline.length - 1];
  const latestByIdentity = new Map(latestSnapshot?.pilots.map((pilot) => [pilot.identityKey, pilot]) ?? []);
  const pilotBySnapshotAndIdentity = new Map<string, Map<string, ArchivedPilotProjection>>();
  const latestKnownByIdentity = new Map<string, ArchivedPilotProjection>();

  for (const snapshot of timeline) {
    pilotBySnapshotAndIdentity.set(
      snapshot.id,
      new Map(snapshot.pilots.map((pilot) => [pilot.identityKey, pilot]))
    );
  }

  for (const snapshot of [...timeline].reverse()) {
    for (const pilot of snapshot.pilots) {
      if (!latestKnownByIdentity.has(pilot.identityKey)) {
        latestKnownByIdentity.set(pilot.identityKey, pilot);
      }
    }
  }

  return (latestSnapshot?.pilots ?? [])
    .map((pilot) => {
      const latestPilot = latestByIdentity.get(pilot.identityKey) ?? latestKnownByIdentity.get(pilot.identityKey);
      const points = timeline.map((snapshot) => {
        const archivedPilot = pilotBySnapshotAndIdentity.get(snapshot.id)?.get(pilot.identityKey);

        return archivedPilot
          ? buildRequirementPoint(snapshot, archivedPilot)
          : buildMissingRequirementPoint(snapshot);
      });

      return {
        identityKey: pilot.identityKey,
        displayName: formatPilotDisplayName(latestPilot?.name ?? pilot.name),
        latestName: latestPilot?.name ?? pilot.name,
        latestTargetTrainingMonth: latestPilot?.targetTrainingMonth ?? null,
        latestQualificationLabel: latestPilot?.qualificationLabel ?? null,
        points
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}
