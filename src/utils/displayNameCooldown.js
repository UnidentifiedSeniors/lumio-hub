const DISPLAY_NAME_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function getDisplayNameChangeState(changedAt) {
  const changedAtMs = Date.parse(changedAt || "");
  if (!Number.isFinite(changedAtMs)) {
    return { availableAt: null, canChange: true };
  }

  const availableAt = new Date(changedAtMs + DISPLAY_NAME_COOLDOWN_MS);
  return { availableAt, canChange: Date.now() >= availableAt.getTime() };
}

export function formatDisplayNameChangeTime(availableAt) {
  if (!availableAt) return "";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(availableAt);
}
