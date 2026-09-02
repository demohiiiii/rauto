import { setConnectionDeviceProfiles } from "$domains/connections/index.js";

let cachedDeviceProfiles: string[] = [];
let customShowObjectsChangedHandler: (() => void | Promise<void>) | null = null;

function normalizeProfileNames(profiles: unknown): string[] {
  return (Array.isArray(profiles) ? profiles : [])
    .map((name) => String(name || "").trim())
    .filter((name, index, values) => !!name && values.indexOf(name) === index);
}

export function setCustomShowObjectsChangedCallback(
  onChanged: (() => void | Promise<void>) | null = null,
): void {
  customShowObjectsChangedHandler = onChanged;
}

export function notifyCustomShowObjectsChanged(): void | Promise<void> {
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
