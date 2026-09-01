import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { get } from "svelte/store";
import {
  createTransferPageWorkspace,
  newTransferState,
  transferUploadPayload,
  validateTransferUploadPayload,
} from "../src/domains/transfer/index.ts";

function read(path) {
  return readFileSync(path, "utf8");
}

test("transfer page uses the transfer domain boundary", () => {
  const page = read("frontend/src/pages/TransferPage.svelte");
  const domainIndex = read("frontend/src/domains/transfer/index.ts");
  const application = read(
    "frontend/src/domains/transfer/application/createTransferPageWorkspace.ts",
  );
  const runtime = read(
    "frontend/src/domains/transfer/infrastructure/transferRuntime.ts",
  );
  const viteConfig = read("vite.config.js");

  assert.match(page, /<script lang="ts">/);
  assert.match(page, /\$domains\/transfer\/index\.js/);
  assert.doesNotMatch(page, /modules\/operations\/transfer/);
  assert.match(domainIndex, /application\/createTransferPageWorkspace\.js/);
  assert.match(application, /transferApi/);
  assert.match(application, /transferRuntime/);
  assert.match(runtime, /\$domains\/connections\/index\.js/);
  assert.match(runtime, /\$domains\/overlays\/index\.js/);
  assert.doesNotMatch(viteConfig, /\["transfer\.js"/);
});

test("transfer upload payload preserves defaults and normalizes form text", () => {
  const state = {
    ...newTransferState(),
    bufferSize: "invalid",
    localPath: "  configs/router.cfg  ",
    remotePath: "  /tmp/router.cfg  ",
    showProgress: true,
    timeoutSecs: "invalid",
  };

  assert.deepEqual(
    transferUploadPayload(state, { connection_name: "router-1" }, "full"),
    {
      buffer_size: null,
      connection: { connection_name: "router-1" },
      local_path: "configs/router.cfg",
      record_level: "full",
      remote_path: "/tmp/router.cfg",
      show_progress: true,
      timeout_secs: 300,
    },
  );

  state.bufferSize = "65536";
  state.timeoutSecs = "0";
  const payload = transferUploadPayload(state, {}, "key-events-only");
  assert.equal(payload.buffer_size, 65536);
  assert.equal(payload.timeout_secs, 0);
});

test("transfer upload validation reports each required path", () => {
  const payload = transferUploadPayload(newTransferState(), {}, "full");
  assert.throws(
    () =>
      validateTransferUploadPayload(payload, {
        localPathRequired: "local required",
        remotePathRequired: "remote required",
      }),
    /local required/,
  );

  payload.local_path = "config.txt";
  assert.throws(
    () =>
      validateTransferUploadPayload(payload, {
        localPathRequired: "local required",
        remotePathRequired: "remote required",
      }),
    /remote required/,
  );
});

test("transfer workspace does not upload without a selected target", async () => {
  let uploadCalls = 0;
  const workspace = createTransferPageWorkspace({
    api: {
      async executeUpload() {
        uploadCalls += 1;
        return { ok: true };
      },
    },
    runtime: {
      ensureConnectionTargetSelected: () => false,
    },
  });

  const result = await workspace.runUpload();
  assert.equal(result, null);
  assert.equal(uploadCalls, 0);
  assert.equal(get(workspace.transferStateStore).uploadLoading, false);
});

test("transfer workspace executes once and forwards recording results", async () => {
  let resolveUpload;
  let uploadCalls = 0;
  const payloads = [];
  const recordings = [];
  const workspace = createTransferPageWorkspace({
    api: {
      executeUpload(payload) {
        uploadCalls += 1;
        payloads.push(payload);
        return new Promise((resolve) => {
          resolveUpload = resolve;
        });
      },
    },
    runtime: {
      applyRecording: (result) => recordings.push(result.recording_jsonl),
      connectionPayload: () => ({ connection_name: "router-1" }),
      ensureConnectionTargetSelected: () => true,
      recordLevelPayload: () => "full",
    },
  });

  workspace.updateLocalPath("config.txt");
  workspace.updateRemotePath("/tmp/config.txt");
  workspace.updateBufferSize("4096");
  workspace.updateTimeoutSecs("60");
  workspace.updateShowProgress(true);

  const first = workspace.runUpload();
  const duplicate = workspace.runUpload();
  assert.equal(uploadCalls, 1);
  assert.equal(get(workspace.transferStateStore).uploadLoading, true);

  resolveUpload({
    local_path: "config.txt",
    ok: true,
    recording_jsonl: "recording",
    remote_path: "/tmp/config.txt",
  });
  const [result, duplicateResult] = await Promise.all([first, duplicate]);

  assert.equal(result.ok, true);
  assert.equal(duplicateResult, undefined);
  assert.deepEqual(payloads, [
    {
      buffer_size: 4096,
      connection: { connection_name: "router-1" },
      local_path: "config.txt",
      record_level: "full",
      remote_path: "/tmp/config.txt",
      show_progress: true,
      timeout_secs: 60,
    },
  ]);
  assert.deepEqual(recordings, ["recording"]);
  assert.equal(get(workspace.transferStateStore).uploadLoading, false);
  assert.equal(get(workspace.transferStateStore).status?.tone, "success");
});
