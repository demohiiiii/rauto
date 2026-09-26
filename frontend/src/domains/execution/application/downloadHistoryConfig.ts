import {
  downloadConfigFetchResult,
  type ConfigFetchContentView,
} from "$domains/config-fetch/index.js";
import type {
  ExecutionHistoryEntry,
  ExecutionHistoryOutput,
} from "../model/executionHistory.js";
import { executionResultFailed } from "../model/executionResult.js";

export function downloadHistoryConfig(
  entry: ExecutionHistoryEntry,
  output: ExecutionHistoryOutput,
  view: ConfigFetchContentView,
): boolean {
  if (entry.feature !== "config-fetch" || executionResultFailed(output))
    return false;
  return downloadConfigFetchResult(
    {
      target: output.device,
      host: output.host ?? "",
      profile: output.profile ?? "",
      kind: output.config_kind ?? "config",
      command: output.command,
      content: output.output ?? null,
      normalized_content: output.normalized_content,
      fetched_at: output.fetched_at ?? entry.startedAt,
      sha256: output.sha256 ?? null,
      normalized_sha256: output.normalized_sha256 ?? null,
      all: output.all ?? null,
      error: output.error ?? null,
    },
    view,
  );
}
