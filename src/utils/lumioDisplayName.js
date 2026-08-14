export const LUMIO_DISPLAY_NAME_MAX_LENGTH = 15;
export const LUMIO_DISPLAY_NAME_MIN_LENGTH = 3;

export function validateLumioDisplayName(value) {
  const name = value.trim();

  if (!/^[A-Za-z]+$/.test(name)) {
    return "Use letters only — no spaces, numbers, or symbols.";
  }

  if (name.length < LUMIO_DISPLAY_NAME_MIN_LENGTH || name.length > LUMIO_DISPLAY_NAME_MAX_LENGTH) {
    return `Use ${LUMIO_DISPLAY_NAME_MIN_LENGTH}–${LUMIO_DISPLAY_NAME_MAX_LENGTH} letters.`;
  }

  return null;
}
