import { safeString } from "../../../lib/ui.js";
import type {
  BatchShowTargetSelection,
  ShowConnectionSummary,
  ShowObjectDefinition,
  ShowObjectsPayload,
} from "./types.js";

export function normalizeBatchMaxParallel(value: unknown): number | null {
  const parsed = Number.parseInt(safeString(value).trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizedSelectionSet(values: unknown = []): Set<string> {
  return new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => safeString(value).trim())
      .filter(Boolean),
  );
}

export function resolveBatchShowTargetConnections({
  connections = [],
  groups = [],
  labels = [],
  targets = [],
}: BatchShowTargetSelection = {}): ShowConnectionSummary[] {
  const targetNames = normalizedSelectionSet(targets);
  const groupNames = normalizedSelectionSet(groups);
  const labelNames = normalizedSelectionSet(labels);
  return connections.filter((connection) => {
    const name = safeString(connection.name).trim();
    const connectionGroups = Array.isArray(connection.groups)
      ? connection.groups
      : [];
    const connectionLabels = Array.isArray(connection.labels)
      ? connection.labels
      : [];
    return (
      targetNames.has(name) ||
      connectionGroups.some((group) =>
        groupNames.has(safeString(group).trim()),
      ) ||
      connectionLabels.some((label) => labelNames.has(safeString(label).trim()))
    );
  });
}

export function intersectBatchShowObjectPayloads(
  payloads: ShowObjectsPayload[] = [],
): ShowObjectDefinition[] {
  if (!payloads.length) return [];
  const firstObjects = Array.isArray(payloads[0]?.objects)
    ? payloads[0].objects
    : [];
  const remainingObjectSets = payloads
    .slice(1)
    .map(
      (payload) =>
        new Set(
          (Array.isArray(payload.objects) ? payload.objects : [])
            .map((object) => safeString(object.object).trim())
            .filter(Boolean),
        ),
    );
  const seenObjects = new Set<string>();
  return firstObjects.filter((object) => {
    const objectName = safeString(object.object).trim();
    if (!objectName || seenObjects.has(objectName)) return false;
    seenObjects.add(objectName);
    return remainingObjectSets.every((objectSet) => objectSet.has(objectName));
  });
}

export function showConnectionTargetIdentity(target: unknown = {}): string {
  const candidate =
    target && typeof target === "object"
      ? (target as Record<string, unknown>)
      : {};
  const details =
    candidate.details && typeof candidate.details === "object"
      ? (candidate.details as Record<string, unknown>)
      : {};
  return [
    safeString(candidate.kind || "none"),
    safeString(details.name),
    safeString(details.host),
    safeString(details.profile || details.device_profile),
  ].join("|");
}
