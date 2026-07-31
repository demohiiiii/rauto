import { safeString } from "../../lib/ui.js";

export function profileModeExpressionOptions(modeOptions = []) {
  const seen = new Set();
  return (Array.isArray(modeOptions) ? modeOptions : [])
    .map((mode) => safeString(mode).trim())
    .filter((mode) => {
      const normalized = mode.toLowerCase();
      if (!mode || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

export function profileModeExpressionCandidates(value = "") {
  return safeString(value)
    .split(/[|,]/)
    .map((mode) => mode.trim())
    .filter(Boolean);
}

export function profileModeExpressionMatchesOptions(
  value = "",
  modeOptions = [],
) {
  const candidates = profileModeExpressionCandidates(value).map((mode) =>
    mode.toLowerCase(),
  );
  if (!candidates.length) return false;
  const normalizedOptions = profileModeExpressionOptions(modeOptions).map(
    (mode) => mode.toLowerCase(),
  );
  return candidates.every((mode) => normalizedOptions.includes(mode));
}

export function profileModeExpressionSelectedOptions(
  value = "",
  modeOptions = [],
) {
  const candidates = profileModeExpressionCandidates(value).map((mode) =>
    mode.toLowerCase(),
  );
  if (!candidates.length) return [];
  return profileModeExpressionOptions(modeOptions).filter((mode) =>
    candidates.includes(mode.toLowerCase()),
  );
}

export function profileModeExpressionUnmatchedCandidates(
  value = "",
  modeOptions = [],
) {
  const normalizedOptions = new Set(
    profileModeExpressionOptions(modeOptions).map((mode) => mode.toLowerCase()),
  );
  return profileModeExpressionCandidates(value).filter(
    (mode) => !normalizedOptions.has(mode.toLowerCase()),
  );
}

export function profileModeExpressionFromSelection(
  selectedValues = [],
  currentValue = "",
  modeOptions = [],
) {
  const selectedSet = new Set(
    (Array.isArray(selectedValues) ? selectedValues : [])
      .map((mode) => safeString(mode).trim().toLowerCase())
      .filter(Boolean),
  );
  const selectedModes = profileModeExpressionOptions(modeOptions).filter(
    (mode) => selectedSet.has(mode.toLowerCase()),
  );
  return [
    ...selectedModes,
    ...profileModeExpressionUnmatchedCandidates(currentValue, modeOptions),
  ].join(",");
}

export function profileModeExpressionSuggestions(
  modeOptions = [],
  currentValue = "",
) {
  const suggestions = profileModeExpressionOptions(modeOptions);
  const current = safeString(currentValue).trim();
  if (current && !suggestions.some((mode) => mode === current)) {
    suggestions.push(current);
  }
  return suggestions;
}
