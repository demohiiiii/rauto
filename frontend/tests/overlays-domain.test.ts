import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  detailModalPresentation,
  eventEntriesPresentation,
  historyEntryOpenHandler,
} from "../src/domains/overlays/index.js";

const read = (path: string): string => readFileSync(path, "utf8");

test("overlay notifications use a typed domain runtime", () => {
  const application = read(
    "frontend/src/domains/overlays/application/toastState.ts",
  );
  const infrastructure = read(
    "frontend/src/domains/overlays/infrastructure/overlayRuntime.ts",
  );

  assert.doesNotMatch(application, /lib\/browser\.js|svelte-sonner/);
  assert.match(infrastructure, /lib\/browser\.js/);
  assert.match(infrastructure, /import\("svelte-sonner"\)/);
  assert.doesNotMatch(
    `${application}\n${infrastructure}`,
    /\bany\b|@ts-(?:ignore|nocheck)/,
  );
});

test("overlay detail state uses typed infrastructure boundaries", () => {
  const application = read(
    "frontend/src/domains/overlays/application/detailState.ts",
  );
  const infrastructure = read(
    "frontend/src/domains/overlays/infrastructure/overlayDetailRuntime.ts",
  );

  assert.doesNotMatch(
    application,
    /lib\/browser\.js|lib\/svelte\.js|modules\/orchestration/,
  );
  assert.match(infrastructure, /lib\/browser\.js/);
  assert.match(infrastructure, /lib\/svelte\.js/);
  assert.match(infrastructure, /modules\/orchestration/);
});

test("record drawer state uses typed browser infrastructure boundaries", () => {
  const application = read(
    "frontend/src/domains/overlays/application/drawerState.ts",
  );
  const infrastructure = read(
    "frontend/src/domains/overlays/infrastructure/overlayDrawerRuntime.ts",
  );

  assert.doesNotMatch(
    application,
    /lib\/browser\.js|dashboard\/model\/navigation/,
  );
  assert.match(infrastructure, /lib\/browser\.js/);
  assert.match(infrastructure, /dashboard\/model\/navigation\.js/);
  assert.doesNotMatch(
    `${application}\n${infrastructure}`,
    /\bany\b|@ts-(?:ignore|nocheck)/,
  );
});

test("event detail presentation retains statistics and indexed actions", () => {
  const entries = [
    { event: { kind: "connection_established" } },
    {
      event: {
        command: "show version",
        kind: "command_output",
        success: false,
      },
    },
  ];
  const presentation = eventEntriesPresentation(entries);
  const opened: unknown[] = [];
  const openEntry = historyEntryOpenHandler(entries, (entry) =>
    opened.push(entry),
  );

  assert.deepEqual(presentation.stats, {
    commandEvents: 1,
    failedEvents: 1,
    kinds: 2,
    total: 2,
  });
  assert.equal(presentation.entryRows[1]?.commandText, "show version");
  openEntry(1);
  openEntry(9);
  assert.deepEqual(opened, [entries[1]]);
});

test("detail modal presentation selects each structured detail kind", () => {
  const history = detailModalPresentation({
    content: "",
    detailPayload: { entries: [], meta: { operation: "exec" } },
    kind: "historyDetail",
    open: true,
    title: "History",
  });
  const orchestration = detailModalPresentation({
    content: "",
    detailPayload: { kind: "stage" },
    kind: "orchestrationDetail",
    open: true,
    title: "Stage",
  });
  const connectionImport = detailModalPresentation({
    content: "",
    detailPayload: { failed: 0, failures: [] },
    kind: "connectionImportDetail",
    open: true,
    title: "Import",
  });

  assert.equal(history.detailModalContentDisplay.showHistoryDetail, true);
  assert.equal(
    orchestration.orchestrationDetailRendererId,
    "orchestrationStageDetail",
  );
  assert.equal(
    connectionImport.detailModalContentDisplay.showConnectionImportDetail,
    true,
  );
});

test("migrated legacy overlay modules stay removed", () => {
  for (const path of [
    "frontend/src/modules/overlays/overlays.js",
    "frontend/src/modules/overlays/overlaysToastState.js",
    "frontend/src/modules/overlays/overlaysDetail.js",
    "frontend/src/modules/overlays/overlaysDrawerState.js",
  ]) {
    assert.equal(existsSync(path), false, path);
  }
});
