export function readBooleanPreference(key, fallback = false) {
  if (!key) return fallback;

  try {
    const saved = window.localStorage.getItem(key);
    return saved === null ? fallback : JSON.parse(saved) === true;
  } catch {
    return fallback;
  }
}

export function saveBooleanPreference(key, value) {
  if (!key) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(Boolean(value)));
  } catch {
    // The preference remains active for this visit if browser storage is unavailable.
  }
}
