export function formatPilotLevel(level: string): string {
  const normalizedLevel = level.trim();

  if (normalizedLevel === "1") {
    return "3P";
  }

  if (normalizedLevel === "2") {
    return "2P";
  }

  return level;
}

function splitPilotName(name: string): string[] {
  return name
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function formatPilotDisplayName(name: string): string {
  const segments = splitPilotName(name);

  if (segments.length < 2) {
    return name;
  }

  const surname = segments[0];
  const rank = segments[segments.length - 1];

  return `${rank} ${surname}`;
}

export function getPilotIdentityKey(name: string): string {
  const segments = splitPilotName(name);

  if (segments.length >= 3) {
    return segments
      .slice(0, -1)
      .join(", ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  return name.replace(/\s+/g, " ").trim().toUpperCase();
}

export function formatTrainingMonth(value: number): string {
  return `Month ${value}`;
}

export function formatOptionalTrainingMonth(
  value: number | null,
  emptyLabel = "--"
): string {
  return value == null ? emptyLabel : formatTrainingMonth(value);
}

export function formatTrainingMonthProgress(
  value: number | "Q" | ""
): string {
  if (value === "Q") {
    return "Qualified";
  }

  if (value === "") {
    return "";
  }

  return formatTrainingMonth(value);
}
