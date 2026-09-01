import { setConnectionDeviceProfiles } from "../../../modules/connections/connections.js";

let cachedDeviceProfiles: string[] = [];
let customShowObjectsChangedHandler: (() => unknown) | null = null;

function normalizeProfileNames(profiles: unknown): string[] {
  return (Array.isArray(profiles) ? profiles : [])
    .map((name) => String(name || "").trim())
    .filter((name, index, values) => !!name && values.indexOf(name) === index);
}

export function setCustomShowObjectsChangedCallback(
  onChanged: unknown = null,
): void {
  customShowObjectsChangedHandler =
    typeof onChanged === "function" ? (onChanged as () => unknown) : null;
}

export function notifyCustomShowObjectsChanged(): unknown {
  return customShowObjectsChangedHandler?.();
}

export function getCachedDeviceProfiles(): string[] {
  return cachedDeviceProfiles;
}

export function setCachedDeviceProfiles(profiles: unknown): string[] {
  cachedDeviceProfiles = normalizeProfileNames(profiles);
  setConnectionDeviceProfiles(cachedDeviceProfiles);
  return cachedDeviceProfiles;
}
