import { setConnectionDeviceProfiles } from "$domains/connections/index.js";

let cachedDeviceProfiles: string[] = [];
let customShowObjectsChangedHandler: (() => void | Promise<void>) | null = null;

function normalizeProfileNames(profiles: string[]): string[] {
  return profiles
    .map((name) => name.trim())
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

export function setCachedDeviceProfiles(profiles: string[]): string[] {
  cachedDeviceProfiles = normalizeProfileNames(profiles);
  setConnectionDeviceProfiles(cachedDeviceProfiles);
  return cachedDeviceProfiles;
}
