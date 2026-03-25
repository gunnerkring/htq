import type { PhaseKey } from "./pilot";

export type ArchivedPilotProjection = {
  name: string;
  identityKey: string;
  level: string;
  currentHours: number;
  startTrainingMonth: number | null;
  targetTrainingMonth: number;
  threshold: number;
  waiver550: boolean;
  tttWaiver: boolean;
  deploymentHours: number;
  frtpHours: number;
  qualifiesInWindow: boolean;
  qualifiesByEndOfMonthIndex: number | null;
  qualificationDate: string | null;
  qualificationLabel: string | null;
  needsReview: boolean;
  reviewMessage: string | null;
};

export type ProjectionArchiveSnapshot = {
  id: string;
  savedAt: string;
  reportMonth: string;
  reportMonthLabel: string;
  squadron: string;
  phase: PhaseKey;
  phaseLabel: string;
  windowLabel: string;
  sourceLabel: string;
  monthModeExact: boolean;
  importedCount: number;
  eligibleCount: number;
  selectedCount: number;
  qualifiedCount: number;
  reviewCount: number;
  pilots: ArchivedPilotProjection[];
};

export type ArchiveTrendItemType =
  | "improved"
  | "slipped"
  | "newly-qualified"
  | "lost-qualification"
  | "review-opened"
  | "review-resolved"
  | "added"
  | "removed";

export type ArchiveTrendItem = {
  type: ArchiveTrendItemType;
  name: string;
  detail: string;
};

export type ArchiveInsightTone = "positive" | "warning" | "neutral";

export type ArchiveInsight = {
  tone: ArchiveInsightTone;
  title: string;
  detail: string;
};

export type ArchiveTrendSummary = {
  previousSnapshot: ProjectionArchiveSnapshot | null;
  qualifiedDelta: number;
  reviewDelta: number;
  improvedCount: number;
  slippedCount: number;
  reviewOpenedCount: number;
  reviewResolvedCount: number;
  addedCount: number;
  removedCount: number;
  notableItems: ArchiveTrendItem[];
};

export type ArchiveHistoryAnalysis = {
  snapshotCount: number;
  oldestSnapshot: ProjectionArchiveSnapshot | null;
  latestSnapshot: ProjectionArchiveSnapshot | null;
  netQualifiedDelta: number;
  netReviewDelta: number;
  continuingPilotCount: number;
  rankChangeCount: number;
  earlierCount: number;
  laterCount: number;
  newlyQualifiedSinceStartCount: number;
  lostQualificationSinceStartCount: number;
  repeatedSlipCount: number;
  persistentReviewCount: number;
  insights: ArchiveInsight[];
};

export type ArchiveRequirementPoint = {
  snapshotId: string;
  reportMonth: string;
  reportMonthLabel: string;
  isPresent: boolean;
  requiredHoursPerMonth: number | null;
  targetTrainingMonth: number;
  threshold: number;
  qualifiesInWindow: boolean;
  currentHours: number;
  trainingMonth: number | null;
};

export type ArchiveRequirementRow = {
  identityKey: string;
  displayName: string;
  latestName: string;
  latestTargetTrainingMonth: number | null;
  latestQualificationLabel: string | null;
  points: ArchiveRequirementPoint[];
};
