import { executionHistoryExportSheets } from "../src/domains/execution/model/executionHistoryExport.js";
import { downloadHistoryConfig } from "../src/domains/execution/application/downloadHistoryConfig.js";
import { configFetchRuntime } from "../src/domains/config-fetch/infrastructure/configFetchRuntime.js";
import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import { createExecutionHistory } from "../src/domains/execution/application/executionHistory.js";
import {
  executionHistoryFunctions,
  filterExecutionHistory,
  historyLimit,
} from "../src/domains/execution/model/executionHistory.js";
import {
  parseExecutionHistory,
  migrateShowExecutionHistory,
} from "../src/domains/execution/infrastructure/executionHistoryPersistence.js";

function history() {
  let tick = 0;
  return createExecutionHistory({
    now: () => new Date(1700000000000 + tick++).toISOString(),
  });
}
test("retention is per function and combines single and batch runs", () => {
  const ledger = history();
  for (const feature of executionHistoryFunctions) {
    for (let i = 0; i < 12; i++) {
      const id = ledger.start(feature, i % 2 ? "batch" : "single");
      ledger.finish(id, [{ device: "r1", command: String(i), success: true }]);
    }
  }
  assert.equal(get(ledger.state).entries.length, 40);
  for (const feature of executionHistoryFunctions) {
    const runs = filterExecutionHistory(get(ledger.state).entries, [feature]);
    assert.equal(runs.length, 10);
    assert.equal(runs[0].outputs[0].command, "11");
    assert.equal(runs.at(-1)?.outputs[0].command, "2");
  }
  ledger.setLimit(2);
  assert.equal(get(ledger.state).entries.length, 8);
  assert.equal(
    filterExecutionHistory(get(ledger.state).entries, [
      "command",
      "interactive",
    ]).length,
    4,
  );
  assert.equal(
    filterExecutionHistory(get(ledger.state).entries, executionHistoryFunctions)
      .length,
    8,
  );
  assert.equal(filterExecutionHistory(get(ledger.state).entries, []).length, 0);
  assert.equal(historyLimit(undefined), 10);
  assert.equal(historyLimit(101), 100);
  assert.equal(historyLimit(0), 1);
});
test("concurrent runs complete by id and preserve immutable output snapshots", () => {
  const ledger = history();
  const old = ledger.start("command", "single");
  const latest = ledger.start("command", "batch");
  ledger.finish(latest, [
    { device: "second", command: "ls", success: false, error: "denied" },
  ]);
  const output = {
    device: "first",
    command: "ps",
    output: "snapshot",
    parsed_output: [{ x: "before" }],
    success: true,
    recording_jsonl: "not retained",
  };
  ledger.finish(old, [output]);
  output.output = "edited";
  output.parsed_output[0].x = "after";
  const runs = get(ledger.state).entries;
  assert.equal(runs[0].id, latest);
  assert.equal(runs[0].status, "error");
  assert.equal(runs[1].outputs[0].output, "snapshot");
  assert.deepEqual(runs[1].outputs[0].parsed_output, [{ x: "before" }]);
  assert.equal("recording_jsonl" in runs[1].outputs[0], false);
});
test("late completions cannot restore evicted history; failures retain diagnostic output", () => {
  const ledger = history();
  ledger.setLimit(1);
  const old = ledger.start("show", "single");
  const current = ledger.start("show", "batch");
  ledger.finish(old, []);
  assert.equal(get(ledger.state).entries.length, 1);
  assert.equal(get(ledger.state).entries[0].id, current);
  ledger.finish(current, [
    { device: "r1", command: "show", output: "partial" },
  ]);
  ledger.fail(current, "disconnected");
  assert.equal(get(ledger.state).entries[0].message, "disconnected");
  assert.equal(get(ledger.state).entries[0].outputs[0].output, "partial");
});
test("history survives session reload and marks outstanding runs interrupted", () => {
  let saved = "";
  const ledger = createExecutionHistory({
    persist: (snapshot) => (saved = JSON.stringify(snapshot)),
  });
  const id = ledger.start("interactive", "single", true);
  ledger.finish(id, [
    {
      device: "linux",
      command: "ls",
      parsed_output: [{ name: "a" }],
      success: true,
    },
  ]);
  ledger.start("config-fetch", "batch");
  const restored = createExecutionHistory({
    initial: parseExecutionHistory(saved),
  });
  const runs = get(restored.state).entries;
  assert.equal(
    runs.find((row) => row.feature === "config-fetch")?.status,
    "interrupted",
  );
  assert.equal(
    runs.find((row) => row.feature === "interactive")?.outputs[0].device,
    "linux",
  );
  assert.equal(
    runs.find((row) => row.feature === "interactive")?.textfsmEnabled,
    true,
  );
  assert.equal(
    runs.find((row) => row.feature === "config-fetch")?.textfsmEnabled,
    false,
  );
  assert.equal(get(restored.state).limit, 10);
});
test("invalid session data is rejected without breaking the history viewer", () => {
  assert.deepEqual(parseExecutionHistory("{broken"), {
    entries: [],
    limit: 10,
  });
  const ledger = history();
  const id = ledger.start("show", "single");
  ledger.finish(id, [{ device: "r1", command: "show", success: true }]);
  const valid = get(ledger.state).entries[0];
  const input = {
    limit: 500,
    entries: [
      valid,
      valid,
      {
        ...valid,
        id: "bad",
        outputs: [{ device: "r1", command: "show", output: {} }],
      },
      { ...valid, id: "date", startedAt: "invalid" },
      { ...valid, id: "unknown", feature: "typo" },
    ],
  };
  const parsed = parseExecutionHistory(JSON.stringify(input));
  assert.equal(parsed.limit, 100);
  assert.equal(parsed.entries.length, 1);
});
test("legacy show sessions migrate into the shared function limit without connection secrets", () => {
  const startedAt = "2026-09-24T00:00:00.000Z";
  const migrated = migrateShowExecutionHistory(
    JSON.stringify({
      limit: 1,
      single: [
        {
          id: "old",
          startedAt,
          completedAt: startedAt,
          result: {
            kind: "result",
            basePayload: {
              connection: { connection_name: "router", password: "secret" },
            },
            results: [
              {
                command: "show version",
                output: "v1",
                success: true,
                recording_jsonl: "secret",
              },
            ],
          },
        },
      ],
      batch: [],
    }),
  );
  assert.equal(migrated.entries[0].outputs[0].device, "router");
  assert.equal(JSON.stringify(migrated).includes("secret"), false);
  assert.equal(migrated.limit, 1);
});
test("storage failures leave execution history usable in memory", () => {
  const ledger = createExecutionHistory({
    persist: () => {
      throw new Error("quota exceeded");
    },
  });
  const id = ledger.start("command", "single");
  ledger.finish(id, [
    { device: "r1", command: "ls", success: true },
    { device: "r2", command: "ls", success: false },
  ]);
  assert.equal(get(ledger.state).entries[0].status, "warning");
});

test("batch history Excel keeps device identity and parsed field collisions", () => {
  const ledger = history();
  for (const feature of ["show", "command", "interactive"] as const) {
    const id = ledger.start(feature, "batch", true);
    ledger.finish(
      id,
      ["router-a", "router-b"].map((device) => ({
        device,
        profile: "cisco_ios",
        object: "version",
        command: "show version",
        parsed_output: [{ VERSION: "1", device: "parsed-device" }],
        success: true,
      })),
    );
    const entry = get(ledger.state).entries.find((row) => row.id === id)!;
    const original = JSON.stringify(entry);
    const sheets = executionHistoryExportSheets(entry);
    if (feature === "show") {
      assert.deepEqual(sheets, [
        {
          name: "version",
          parsed_output: ["router-a", "router-b"].map((device) => ({
            VERSION: "1",
            device,
            parsed_device: "parsed-device",
            profile: "cisco_ios",
            command: "show version",
            object: "version",
          })),
        },
      ]);
    } else {
      assert.deepEqual(
        sheets.map((sheet) => sheet.name),
        ["router-a show version", "router-b show version"],
      );
      assert.deepEqual(sheets[0].parsed_output, [
        { VERSION: "1", device: "parsed-device" },
      ]);
    }
    assert.equal(JSON.stringify(entry), original);
  }
});

test("single history Excel preserves command sheets", () => {
  const ledger = history();
  const id = ledger.start("command", "single", true);
  ledger.finish(id, [
    {
      device: "router-a",
      command: "show version",
      parsed_output: [{ VERSION: "1" }],
    },
  ]);
  assert.deepEqual(executionHistoryExportSheets(get(ledger.state).entries[0]), [
    { name: "show version", parsed_output: [{ VERSION: "1" }] },
  ]);
});

test("restored configuration history downloads selected raw and normalized files verbatim", async (t) => {
  const downloads: { blob: Blob; filename: string }[] = [];
  t.mock.method(
    configFetchRuntime,
    "download",
    (blob: Blob, filename: string) => downloads.push({ blob, filename }),
  );
  const ledger = history();
  const id = ledger.start("config-fetch", "batch");
  ledger.finish(
    id,
    ["router-a", "router-b"].map((device) => ({
      device,
      command: "show running-config",
      config_kind: "running",
      fetched_at: "2026-09-26T00:00:00Z",
      output: `! raw\nhostname ${device}\n`,
      normalized_content: `hostname ${device}\n`,
      success: true,
    })),
  );
  const entry = parseExecutionHistory(JSON.stringify(get(ledger.state)))
    .entries[0];
  const output = entry.outputs[1];
  assert.equal(output.config_kind, "running");
  assert.equal(downloadHistoryConfig(entry, output, "raw"), true);
  assert.equal(downloadHistoryConfig(entry, output, "normalized"), true);
  assert.equal(await downloads[0].blob.text(), "! raw\nhostname router-b\n");
  assert.equal(downloads[0].filename, "router-b_running_20260926T000000Z.cfg");
  assert.equal(await downloads[1].blob.text(), "hostname router-b\n");
  assert.equal(
    downloads[1].filename,
    "router-b_running_normalized_20260926T000000Z.cfg",
  );
  assert.equal(
    downloadHistoryConfig(entry, { ...output, error: "failed" }, "raw"),
    false,
  );
  assert.equal(
    downloadHistoryConfig(entry, { ...output, success: false }, "raw"),
    false,
  );
  assert.equal(
    downloadHistoryConfig(
      entry,
      { ...output, normalized_content: null },
      "normalized",
    ),
    false,
  );
  assert.equal(downloads.length, 2);
  assert.equal(
    downloadHistoryConfig(
      entry,
      { ...output, config_kind: undefined, fetched_at: undefined },
      "raw",
    ),
    true,
  );
  assert.match(downloads[2].filename, /^router-b_config_.*\.cfg$/);
});
