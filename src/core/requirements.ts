type RequiredHoursPerMonthInput = {
  currentHours: number;
  threshold: number;
  currentTrainingMonth: number | null;
  targetTrainingMonth: number;
};

export function getInclusiveMonthsRemaining(
  currentTrainingMonth: number,
  targetTrainingMonth: number
): number;
export function getInclusiveMonthsRemaining(
  currentTrainingMonth: number | null,
  targetTrainingMonth: number
): number | null;
export function getInclusiveMonthsRemaining(
  currentTrainingMonth: number | null,
  targetTrainingMonth: number
): number | null {
  if (currentTrainingMonth == null) {
    return null;
  }

  return targetTrainingMonth - currentTrainingMonth + 1;
}

export function computeRequiredHoursPerMonth({
  currentHours,
  threshold,
  currentTrainingMonth,
  targetTrainingMonth
}: RequiredHoursPerMonthInput): number | null {
  if (currentHours >= threshold) {
    return 0;
  }

  const monthsRemaining = getInclusiveMonthsRemaining(currentTrainingMonth, targetTrainingMonth);

  if (monthsRemaining == null || monthsRemaining <= 0) {
    return null;
  }

  return (threshold - currentHours) / monthsRemaining;
}
