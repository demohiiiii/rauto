import { safeString } from "../../../lib/ui.js";
import type { ConnectionTargetState } from "$domains/connections/index.js";
import type {
  BatchShowTargetSelection,
  ShowConnectionSummary,
  ShowObjectDefinition,
  ShowObjectsPayload,
} from "./types.js";

export function normalizeBatchMaxParallel(value: string): number | null {
  const parsed = Number.parseInt(safeString(value).trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizedSelectionSet(values: string[] = []): Set<string> {
  return new Set(values.map((value) => value.trim()).filter(Boolean));
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
    const name = connection.name?.trim() ?? "";
    const connectionGroups = connection.groups ?? [];
    const connectionLabels = connection.labels ?? [];
    return (
      targetNames.has(name) ||
      connectionGroups.some((group) => groupNames.has(group.trim())) ||
      connectionLabels.some((label) => labelNames.has(label.trim()))
    );
  });
}

export function intersectBatchShowObjectPayloads(
  payloads: ShowObjectsPayload[] = [],
): ShowObjectDefinition[] {
  if (!payloads.length) return [];
  const firstObjects = payloads[0].objects;
  const remainingObjectSets = payloads
    .slice(1)
    .map(
      (payload) =>
        new Set(
          payload.objects.map((object) => object.object.trim()).filter(Boolean),
        ),
    );
  const seenObjects = new Set<string>();
  return firstObjects.filter((object) => {
    const objectName = object.object.trim();
    if (!objectName || seenObjects.has(objectName)) return false;
    seenObjects.add(objectName);
    return remainingObjectSets.every((objectSet) => objectSet.has(objectName));
  });
}

export function showConnectionTargetIdentity(
  target: ConnectionTargetState,
): string {
  const details = target.details ?? {};
  return [
    safeString(target.kind || "none"),
    safeString(details.name),
    safeString(details.host),
    safeString(details.profile || details.device_profile),
  ].join("|");
}
