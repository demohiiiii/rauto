import assert from "node:assert/strict";
import test from "node:test";
import type { OutputAsset, OutputChunk, RolldownOutput } from "rolldown";
import { build } from "vite";

const INITIAL_JAVASCRIPT_BUDGET = 350 * 1024;
const MAX_LAZY_ENTRY_REQUESTS = 32;
const CODEMIRROR_MODULE_PATTERN =
  /[\\/]node_modules[\\/](?:@codemirror|@lezer|codemirror|svelte-codemirror-editor)[\\/]/;
const LAZY_ONLY_MODULE_PATTERNS = [
  CODEMIRROR_MODULE_PATTERN,
  /[\\/]domains[\\/]command[\\/]presentation[\\/]components[\\/]/,
  /[\\/]domains[\\/]orchestration[\\/]presentation[\\/]components[\\/]/,
  /[\\/]domains[\\/]transactions[\\/]presentation[\\/]components[\\/]/,
];
const NON_EDITOR_LAZY_ENTRIES = [
  "BackupWorkspace",
  "BatchPage",
  "BlacklistWorkspace",
  "ConfigFetchWorkspace",
  "ConfigHistoryPage",
  "ConnectionModal",
  "CredentialsWorkspace",
  "DashboardBody",
  "DetailModal",
  "DeviceDiscoveryPage",
  "EntryDrawer",
  "InventoryWorkspace",
  "ProfilesWorkspace",
  "RecordDrawer",
  "ReplayWorkspace",
  "SavedConnectionEditModal",
  "SchedulesWorkspace",
  "ShowWorkspace",
  "TasksWorkspace",
  "TransferWorkspace",
];

function staticDependencies(
  entryFiles: string[],
  chunks: ReadonlyMap<string, OutputChunk>,
): Set<string> {
  const visited = new Set<string>();
  const pending = [...entryFiles];

  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || visited.has(file)) continue;

    visited.add(file);
    pending.push(...(chunks.get(file)?.imports ?? []));
  }

  return visited;
}

test("production entry keeps editors behind lazy imports and within its size budget", async () => {
  const result = await build({
    configFile: "./vite.config.js",
    logLevel: "silent",
    build: { write: false },
  });
  assert.equal(Array.isArray(result), false);

  const output = (result as RolldownOutput).output;
  const chunks = new Map<string, OutputChunk>(
    output
      .filter((item): item is OutputChunk => item.type === "chunk")
      .map((chunk) => [chunk.fileName, chunk]),
  );
  const html = output.find(
    (item): item is OutputAsset =>
      item.type === "asset" && item.fileName === "index.html",
  );
  assert.ok(html);
  const htmlSource =
    typeof html.source === "string"
      ? html.source
      : new TextDecoder().decode(html.source);

  const entryFiles = [
    ...htmlSource.matchAll(/<script[^>]+src="\/static\/([^"]+\.js)"/g),
  ].map(([, file]) => file);
  assert.equal(entryFiles.length, 1);

  const initialGraph = [...staticDependencies(entryFiles, chunks)].sort();
  const initialChunks = initialGraph
    .map((file) => chunks.get(file))
    .filter((chunk): chunk is OutputChunk => Boolean(chunk));
  assert.equal(initialChunks.length, initialGraph.length);

  const initialModuleIds = initialChunks.flatMap((chunk) =>
    Object.keys(chunk.modules),
  );
  const lazyModuleIds = [...chunks.entries()]
    .filter(([file]) => !initialGraph.includes(file))
    .flatMap(([, chunk]) => Object.keys(chunk.modules));

  for (const pattern of LAZY_ONLY_MODULE_PATTERNS) {
    assert.equal(
      initialModuleIds.some((id) => pattern.test(id)),
      false,
    );
    assert.equal(
      lazyModuleIds.some((id) => pattern.test(id)),
      true,
    );
  }

  const initialBytes = initialChunks.reduce(
    (total, chunk) => total + chunk.code.length,
    0,
  );
  assert.ok(
    initialBytes <= INITIAL_JAVASCRIPT_BUDGET,
    `initial JavaScript is ${initialBytes} bytes; budget is ${INITIAL_JAVASCRIPT_BUDGET}`,
  );

  const initialFiles = new Set(initialGraph);
  const lazyEntryFiles = [
    ...new Set(initialChunks.flatMap((chunk) => chunk.dynamicImports)),
  ];
  for (const lazyEntryFile of lazyEntryFiles) {
    const lazyGraph = [...staticDependencies([lazyEntryFile], chunks)];
    const additionalRequests = lazyGraph.filter(
      (file) => !initialFiles.has(file),
    ).length;
    assert.ok(
      additionalRequests <= MAX_LAZY_ENTRY_REQUESTS,
      `${lazyEntryFile} loads ${additionalRequests} JavaScript chunks; budget is ${MAX_LAZY_ENTRY_REQUESTS}`,
    );
  }

  for (const entryName of NON_EDITOR_LAZY_ENTRIES) {
    const entryFile = lazyEntryFiles.find((file) => file.includes(entryName));
    assert.ok(entryFile, `missing lazy entry for ${entryName}`);
    const moduleIds = [...staticDependencies([entryFile], chunks)].flatMap(
      (file) => Object.keys(chunks.get(file)?.modules ?? {}),
    );
    assert.equal(
      moduleIds.some((id) => CODEMIRROR_MODULE_PATTERN.test(id)),
      false,
      `${entryName} unexpectedly loads CodeMirror`,
    );
  }
});
