import type { CommandOutputEntry } from "./types.js";
import {
  executionResultFailed,
  executionResultOutputText,
} from "./executionResult.js";

export function commandOutputText(
  entries: readonly CommandOutputEntry[],
): string {
  return entries
    .map((entry) => {
      const output = executionResultOutputText(entry, "output", {
        preferTranscript: executionResultFailed(entry),
      });
      const lines = [
        ...(entry.device ? [`=== ${entry.device} ===`] : []),
        ...(entry.command ? [`$ ${entry.command}`] : []),
        output,
      ];
      if (entry.error && !output.includes(entry.error)) lines.push(entry.error);
      return lines.join("\n");
    })
    .join("\n\n");
}
