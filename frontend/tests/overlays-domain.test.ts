import assert from "node:assert/strict";
import test from "node:test";
import {
  detailModalPresentation,
  eventEntriesPresentation,
  historyEntryOpenHandler,
} from "../src/domains/overlays/index.js";
import type { OverlayEventEntry } from "../src/domains/overlays/index.js";

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
  const opened: OverlayEventEntry[] = [];
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
