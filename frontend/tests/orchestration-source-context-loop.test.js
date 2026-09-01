import assert from "node:assert/strict";
import test from "node:test";
import { createOrchestrationTxWorkflowSourceWorkspace } from "../src/domains/orchestration/index.js";

test("tx workflow source context ignores repeated identical context", () => {
  const workspace = createOrchestrationTxWorkflowSourceWorkspace();
  const sourceBindings = {};
  const txWorkflow = {
    workflow: {
      jobs: [],
    },
  };
  let sourceDisplayNotifications = 0;
  const unsubscribe = workspace.sourceDisplayStateStore.subscribe(() => {
    sourceDisplayNotifications += 1;
  });

  workspace.setSourceContext({
    sourceBindings,
    sourceValue: "",
    txWorkflow,
  });
  const notificationsAfterFirstContext = sourceDisplayNotifications;

  workspace.setSourceContext({
    sourceBindings,
    sourceValue: "",
    txWorkflow,
  });

  unsubscribe();
  assert.equal(
    sourceDisplayNotifications,
    notificationsAfterFirstContext,
    "reapplying the same source context should not notify source display subscribers",
  );
});

test("tx workflow source handlers use the latest source bindings", () => {
  const firstValues = [];
  const secondValues = [];
  const workspace = createOrchestrationTxWorkflowSourceWorkspace({
    setJsonText: (value) => firstValues.push(value),
  });

  workspace.setSourceContext({
    sourceBindings: {
      setJsonText: (value) => secondValues.push(value),
    },
  });
  workspace.embeddedJsonChangeHandler()(
    JSON.stringify({ name: "updated", blocks: [] }),
  );

  assert.deepEqual(firstValues, []);
  assert.equal(secondValues.length, 1);
  assert.match(secondValues[0], /"updated"/);
});
