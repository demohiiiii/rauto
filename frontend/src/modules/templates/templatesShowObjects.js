import { setConnectionDeviceProfiles } from "../connections/connections.js";

let cachedDeviceProfiles = [];
let customShowObjectsChangedHandler = null;

function normalizeProfileNames(profiles) {
  return (Array.isArray(profiles) ? profiles : [])
    .map((name) => String(name || "").trim())
    .filter((name, index, values) => !!name && values.indexOf(name) === index);
}

export function setCustomShowObjectsChangedCallback(onChanged = null) {
  customShowObjectsChangedHandler =
    typeof onChanged === "function" ? onChanged : null;
}

export function notifyCustomShowObjectsChanged() {
  if (typeof customShowObjectsChangedHandler === "function") {
    return customShowObjectsChangedHandler();
  }
}

export function getCachedDeviceProfiles() {
  return cachedDeviceProfiles;
}

export function setCachedDeviceProfiles(profiles) {
  cachedDeviceProfiles = normalizeProfileNames(profiles);
  setConnectionDeviceProfiles(cachedDeviceProfiles);
  return cachedDeviceProfiles;
}
