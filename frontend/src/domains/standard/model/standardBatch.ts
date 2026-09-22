import type {
  CommandOutputEntry,
  ParsedOutputSheet,
} from "$domains/execution/index.js";
import type {
  StandardBatchExecPayload,
  StandardBatchInteractivePayload,
  StandardBatchTargetPayload,
  StandardCommandExecutionPayload,
  StandardInteractiveExecutionPayload,
  StandardBatchExecResponse,
  StandardBatchInteractiveTargetResponse,
} from "./types.js";

export function normalizeBatchExecMaxParallel(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function buildBatchCommandDeliveryPayload(
  payload: StandardCommandExecutionPayload,
  targets: StandardBatchTargetPayload,
): StandardBatchExecPayload {
  const {
    connection: _connection,
    dry_run: _dryRun,
    template_dir: _templateDir,
    ...command
  } = payload;
  return { ...command, ...targets };
}

export function buildBatchInteractiveDeliveryPayload(
  payload: StandardInteractiveExecutionPayload,
  targets: StandardBatchTargetPayload,
): StandardBatchInteractivePayload {
  const {
    connection: _connection,
    template_name,
    builtin_template_name,
    content,
    ...fields
  } = payload;
  const source =
    content !== undefined
      ? { content }
      : builtin_template_name
        ? { builtin_template_name }
        : { template_name: template_name || "" };
  return { ...fields, ...source, ...targets };
}

export function batchCommandDeliveryRows(
  response: StandardBatchExecResponse,
): StandardBatchInteractiveTargetResponse[] {
  return response.results.map((row) => ({
    target: row.target,
    host: row.host,
    profile: row.profile,
    error: row.error,
    success:
      !row.error &&
      (row.exit_code === null || row.exit_code === 0) &&
      row.outputs.every((output) => output.success),
    outputs: row.outputs,
  }));
}

export function batchDeliveryOutputEntries(
  rows: StandardBatchInteractiveTargetResponse[],
): CommandOutputEntry[] {
  return rows.flatMap<CommandOutputEntry>((row) =>
    row.outputs.length
      ? row.outputs.map((output) => ({ ...output, device: row.target }))
      : [
          {
            command: "",
            output: row.error || "",
            error: row.error,
            device: row.target,
          },
        ],
  );
}

export function batchDeliverySheets(
  rows: StandardBatchInteractiveTargetResponse[],
): ParsedOutputSheet[] {
  return rows.flatMap((row) =>
    row.outputs.flatMap((output) =>
      output.parsed_output == null
        ? []
        : [
            {
              name: `${row.target} ${output.command}`,
              parsed_output: output.parsed_output,
            },
          ],
    ),
  );
}
