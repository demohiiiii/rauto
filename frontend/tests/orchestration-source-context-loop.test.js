import assert from "node:assert/strict";
import test from "node:test";
import { createOrchestrationTxWorkflowSourceWorkspace } from "../src/modules/orchestrationEditorState.js";

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
