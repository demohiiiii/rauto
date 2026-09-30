import {
  cloneJsonValue,
  jsonParseErrorDetail,
  plainObject,
  stringValue,
} from "../../../lib/jsonValue.js";
import { t } from "../../../lib/i18n.js";
import {
  txWorkflowBlockFormModelFromJson,
  txWorkflowBlockJsonFromFormModel,
} from "./transactionBlockFormModels.js";
import type {
  JsonErrorDetail,
  JsonObject,
  TxWorkflowEditorFormState,
  TxWorkflowFormModel,
} from "./types.js";

const cloneTxJsonValue = cloneJsonValue as unknown as {
  (value: unknown): unknown;
  <T>(value: unknown, fallback: T): T;
};
function txObjectExtra(
  source: unknown,
  knownKeys: ReadonlySet<string>,
): JsonObject {
  if (!plainObject(source)) return {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => !knownKeys.has(key))
      .map(([key, value]) => [key, cloneTxJsonValue(value)]),
  );
}

function txWithoutUnsupportedLabels(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(txWithoutUnsupportedLabels);
  if (!plainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.endsWith("_label"))
      .map(([key, entryValue]) => [
        key,
        txWithoutUnsupportedLabels(entryValue),
      ]),
  );
}

export function defaultTxWorkflowTemplatePayload(): JsonObject {
  return {
    name: "",
    fail_fast: true,
    blocks: [],
  };
}

export function txWorkflowFormModelFromJson(
  txWorkflowValue: unknown = {},
): TxWorkflowFormModel {
  const source = plainObject(txWorkflowValue)
    ? txWorkflowValue
    : defaultTxWorkflowTemplatePayload();
  return {
    name: stringValue(source.name, "tx-workflow"),
    failFast: typeof source.fail_fast === "boolean" ? source.fail_fast : true,
    hasFailFast: Object.hasOwn(source, "fail_fast"),
    blocks: Array.isArray(source.blocks)
      ? source.blocks.map((block) => txWorkflowBlockFormModelFromJson(block))
      : [],
    extra: txObjectExtra(source, new Set(["name", "fail_fast", "blocks"])),
  };
}

function txWorkflowJsonFromFormModel(
  model: Partial<TxWorkflowFormModel> = {},
): JsonObject {
  const result: JsonObject = {
    ...(plainObject(model.extra) ? cloneTxJsonValue(model.extra, {}) : {}),
    name: stringValue(model.name, "tx-workflow"),
    blocks: Array.isArray(model.blocks)
      ? model.blocks.map((block) => txWorkflowBlockJsonFromFormModel(block))
      : [],
  };
  if (model.hasFailFast || model.failFast !== true) {
    result.fail_fast = !!model.failFast;
  }
  return result;
}

interface TxWorkflowParseResult {
  error: string;
  errorDetail: JsonErrorDetail | null;
  model: TxWorkflowFormModel | null;
}

function txWorkflowFormModelFromJsonText(jsonText = ""): TxWorkflowParseResult {
  if (typeof jsonText !== "string" || !jsonText.trim()) {
    const message = t("txWorkflowJsonRequired");
    return {
      error: message,
      errorDetail: { message, line: null, column: null },
      model: null,
    };
  }
  try {
    const parsedValue = JSON.parse(jsonText);
    if (!plainObject(parsedValue)) {
      const message = t("txWorkflowLoadInvalidJsonShape");
      return {
        error: message,
        errorDetail: { message, line: null, column: null },
        model: null,
      };
    }
    return {
      error: "",
      errorDetail: null,
      model: txWorkflowFormModelFromJson(parsedValue),
    };
  } catch (error) {
    const errorDetail = jsonParseErrorDetail(jsonText, error);
    return {
      error: errorDetail.message,
      errorDetail,
      model: null,
    };
  }
}

export function txWorkflowEditorFormStateFromJsonText(
  jsonText = "",
  currentModel: TxWorkflowFormModel | null = null,
): TxWorkflowEditorFormState {
  const result = txWorkflowFormModelFromJsonText(jsonText);
  return {
    formError: result.error,
    formErrorDetail: result.errorDetail,
    formModel: result.model || currentModel,
  };
}

export function txWorkflowFormModelToJsonText(
  model: Partial<TxWorkflowFormModel> = {},
): string {
  return JSON.stringify(
    txWithoutUnsupportedLabels(txWorkflowJsonFromFormModel(model)),
    null,
    2,
  );
}
