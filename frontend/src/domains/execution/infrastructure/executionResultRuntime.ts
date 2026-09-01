import { downloadBlob, safeString } from "../../../lib/ui.js";
import {
  activeConnectionTarget,
  currentTemporaryConnectionDetails,
} from "../../../modules/connections/connections.js";
import type { ExecutionResultRuntime } from "../model/types.js";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function currentDeviceName(): string {
  const target = record(activeConnectionTarget());
  const details = record(target.details);
  const fromTarget = safeString(details.name || details.host || "").trim();
  if (fromTarget && fromTarget !== "-") return fromTarget;

  const temporary = record(currentTemporaryConnectionDetails());
  const fromTemporary = safeString(
    temporary.name || temporary.host || "",
  ).trim();
  return fromTemporary && fromTemporary !== "-" ? fromTemporary : "device";
}

export const executionResultRuntime: ExecutionResultRuntime = {
  deviceName: currentDeviceName,
  download: downloadBlob,
  async notifyError(message) {
    const { showToast } = await import("../../../modules/overlays/overlays.js");
    return showToast(message, "error");
  },
};
