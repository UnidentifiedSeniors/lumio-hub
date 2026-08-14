export const DATE_FORMAT_OPTIONS = [
  { value: "month_day_year", label: "Jan 8, 2026" },
  { value: "month_day_year_numeric", label: "01/08/2026" },
  { value: "day_month_year", label: "08/01/2026" },
  { value: "year_month_day", label: "2026-01-08" },
];

const DEFAULT_DATE_PREFERENCES = {
  dateFormat: "month_day_year",
  includeTime: false,
};

export function getDatePreferences(profile) {
  const requestedFormat = profile?.date_format;
  const hasKnownFormat = DATE_FORMAT_OPTIONS.some((option) => option.value === requestedFormat);

  return {
    dateFormat: hasKnownFormat ? requestedFormat : DEFAULT_DATE_PREFERENCES.dateFormat,
    includeTime: profile?.date_include_time === true,
  };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDatePart(date, dateFormat) {
  if (dateFormat === "year_month_day") {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  if (dateFormat === "day_month_year") {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }

  if (dateFormat === "month_day_year_numeric") {
    return new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatLumioDate(value, preferences, { forceTime = false } = {}) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const resolvedPreferences = {
    ...DEFAULT_DATE_PREFERENCES,
    ...preferences,
  };
  const datePart = formatDatePart(date, resolvedPreferences.dateFormat);

  if (!forceTime && !resolvedPreferences.includeTime) return datePart;

  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${datePart} · ${timePart}`;
}
