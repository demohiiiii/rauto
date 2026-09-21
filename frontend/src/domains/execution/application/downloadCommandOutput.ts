import { t } from "../../../lib/i18n.js";
import { executionResultRuntime } from "../infrastructure/executionResultRuntime.js";
import { commandOutputText } from "../model/commandOutput.js";
import type { CommandOutputEntry } from "../model/types.js";

export async function downloadCommandOutput(
  entries: readonly CommandOutputEntry[],
  filename = "command-output",
): Promise<void> {
  if (!entries.length) return;
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    executionResultRuntime.download(
      new Blob([commandOutputText(entries)], {
        type: "text/plain;charset=utf-8",
      }),
      `${filename}-${timestamp}.txt`,
    );
  } catch (error) {
    await executionResultRuntime.notifyError(
      error instanceof Error ? error.message : t("requestFailed"),
    );
  }
}
