import assert from "node:assert/strict";
import test from "node:test";
import {
  commandOutputText,
  downloadCommandOutput,
} from "../src/domains/execution/index.js";
import { executionResultRuntime } from "../src/domains/execution/infrastructure/executionResultRuntime.js";

test("text downloads preserve multiline output and device/command boundaries including failures", async (t) => {
  const entries = [
    {
      device: "linux-192_0_2_1",
      command: "uptime",
      output: "运行中\nload: 0.1\n",
      all: "uptime\n运行中\n$",
      success: true,
    },
    {
      device: "edge-b",
      command: "show version",
      output: "failed",
      all: "show version\npermission denied",
      error: "connection lost",
      success: false,
    },
  ];
  const expected =
    "=== linux-192_0_2_1 ===\n$ uptime\n运行中\nload: 0.1\n\n\n=== edge-b ===\n$ show version\nshow version\npermission denied\nconnection lost";
  assert.equal(commandOutputText(entries), expected);
  const download = t.mock.method(executionResultRuntime, "download", () => {});
  await downloadCommandOutput(entries, "batch-show-output");
  assert.equal(download.mock.callCount(), 1);
  const [blob, filename] = download.mock.calls[0].arguments;
  assert.ok(blob);
  assert.ok(filename);
  assert.equal(blob.type, "text/plain;charset=utf-8");
  assert.equal(await blob.text(), expected);
  assert.match(filename, /^batch-show-output-.*\.txt$/);
  await downloadCommandOutput([]);
  assert.equal(download.mock.callCount(), 1);
});

test("text download failures notify the user without propagating into execution", async (t) => {
  t.mock.method(executionResultRuntime, "download", () => {
    throw new Error("download unavailable");
  });
  const notify = t.mock.method(
    executionResultRuntime,
    "notifyError",
    async () => {},
  );
  await downloadCommandOutput([{ command: "uptime", output: "running" }]);
  assert.equal(notify.mock.calls[0].arguments[0], "download unavailable");
});
