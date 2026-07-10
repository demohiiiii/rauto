import { cloneJsonValue, plainObject, stringValue } from "../lib/jsonValue.js";
import {
  txWorkflowBlockFormModelFromJson,
  txWorkflowBlockJsonFromFormModel,
} from "./transactionBlockFormModels.js";

const cloneTxJsonValue = cloneJsonValue;
const txPlainObject = plainObject;
const txStringValue = stringValue;

function txObjectExtra(source, knownKeys) {
  if (!txPlainObject(source)) return {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => !knownKeys.has(key))
      .map(([key, value]) => [key, cloneTxJsonValue(value)]),
  );
}

export function defaultTxWorkflowTemplatePayload() {
  return {
    name: "linux-safe-deploy-demo",
    fail_fast: true,
    blocks: [
      {
        name: "precheck",
        rollback_policy: "none",
        fail_fast: true,
        steps: [
          {
            run: {
              kind: "command",
              mode: "User",
              command: "uname -a",
              timeout: 30,
            },
            rollback: null,
            rollback_on_failure: false,
          },
          {
            run: {
              kind: "command",
              mode: "User",
              command: "date",
              timeout: 30,
            },
            rollback: null,
            rollback_on_failure: false,
          },
        ],
      },
      {
        name: "apply-change",
        rollback_policy: "per_step",
        fail_fast: true,
        steps: [
          {
            run: {
              kind: "command",
              mode: "User",
              command: "mkdir -p /tmp/rauto-demo",
              timeout: 30,
            },
            rollback: {
              kind: "command",
              mode: "User",
              command: "rm -rf /tmp/rauto-demo",
              timeout: 30,
            },
            rollback_on_failure: false,
          },
          {
            run: {
              kind: "command",
              mode: "User",
              command: "echo version=2026.04.17 > /tmp/rauto-demo/release.txt",
              timeout: 30,
            },
            rollback: {
              kind: "command",
              mode: "User",
              command: "rm -f /tmp/rauto-demo/release.txt",
              timeout: 30,
            },
            rollback_on_failure: true,
          },
        ],
      },
      {
        name: "verify",
        rollback_policy: {
          whole_resource: {
            rollback: {
              kind: "command",
              mode: "User",
              command: "rm -rf /tmp/rauto-demo",
              timeout: 30,
            },
            trigger_step_index: 0,
          },
        },
        fail_fast: false,
        steps: [
          {
            run: {
              kind: "command",
              mode: "User",
              command: "ls -lah /tmp/rauto-demo",
              timeout: 30,
            },
            rollback: null,
            rollback_on_failure: false,
          },
        ],
      },
    ],
  };
}

export function txWorkflowFormModelFromJson(txWorkflowValue = {}) {
  const source = txPlainObject(txWorkflowValue)
    ? txWorkflowValue
    : defaultTxWorkflowTemplatePayload();
  return {
    name: txStringValue(source.name, "tx-workflow"),
    failFast: typeof source.fail_fast === "boolean" ? source.fail_fast : true,
    hasFailFast: Object.hasOwn(source, "fail_fast"),
    blocks: Array.isArray(source.blocks)
      ? source.blocks.map((block) => txWorkflowBlockFormModelFromJson(block))
      : [],
    extra: txObjectExtra(source, new Set(["name", "fail_fast", "blocks"])),
  };
}

function txWorkflowJsonFromFormModel(model = {}) {
  const result = {
    ...(txPlainObject(model.extra) ? cloneTxJsonValue(model.extra, {}) : {}),
    name: txStringValue(model.name, "tx-workflow"),
    blocks: Array.isArray(model.blocks)
      ? model.blocks.map((block) => txWorkflowBlockJsonFromFormModel(block))
      : [],
  };
  if (model.hasFailFast || model.failFast !== true) {
    result.fail_fast = !!model.failFast;
  }
  return result;
}

function txWorkflowFormModelFromJsonText(jsonText = "") {
  if (typeof jsonText !== "string" || !jsonText.trim()) {
    return { error: "", model: null };
  }
  try {
    return {
      error: "",
      model: txWorkflowFormModelFromJson(JSON.parse(jsonText)),
    };
  } catch (error) {
    return {
      error:
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : String(error || ""),
      model: null,
    };
  }
}

export function txWorkflowEditorFormStateFromJsonText(
  jsonText = "",
  currentModel = null,
) {
  const result = txWorkflowFormModelFromJsonText(jsonText);
  return {
    formError: result.error,
    formModel: result.model || currentModel,
  };
}

export function txWorkflowFormModelToJsonText(model = {}) {
  return JSON.stringify(txWorkflowJsonFromFormModel(model), null, 2);
}
