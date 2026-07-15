import {
  cloneJsonValue,
  jsonParseErrorDetail,
  jsonValueText,
  nullableNumberValue,
  plainObject,
  stringValue,
} from "../lib/jsonValue.js";
import { t } from "../lib/i18n.js";

const TX_BLOCK_ROLLBACK_KINDS = new Set(["none", "per_step", "whole_resource"]);
const TX_OPERATION_KINDS = new Set(["command", "flow"]);

const cloneTxJsonValue = cloneJsonValue;
const txPlainObject = plainObject;
const txStringValue = stringValue;
const txNullableNumberValue = nullableNumberValue;
const txJsonValueText = jsonValueText;

function txStringListValue(source = []) {
  return Array.isArray(source)
    ? source.map((entryValue) => txJsonValueText(entryValue))
    : [];
}

function txStringMapValue(source = {}) {
  if (!txPlainObject(source)) return {};
  return Object.fromEntries(
    Object.entries(source).map(([key, entryValue]) => [
      String(key),
      txJsonValueText(entryValue),
    ]),
  );
}

function txObjectExtra(source, knownKeys) {
  if (!txPlainObject(source)) return {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => !knownKeys.has(key))
      .map(([key, value]) => [key, cloneTxJsonValue(value)]),
  );
}

function txMultilineModeValue(value) {
  if (value == null || value === "") return "split_lines";
  if (value === "split_lines" || value === "whole") return value;
  throw new Error("multiline_mode must be split_lines or whole");
}

function txWithoutUnsupportedLabels(value) {
  if (Array.isArray(value)) return value.map(txWithoutUnsupportedLabels);
  if (!txPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.endsWith("_label"))
      .map(([key, entryValue]) => [
        key,
        txWithoutUnsupportedLabels(entryValue),
      ]),
  );
}

function txRuntimePromptModelFromJson(source = {}) {
  const value = txPlainObject(source) ? source : {};
  return {
    patterns: Array.isArray(value.patterns)
      ? value.patterns.map((pattern) => String(pattern))
      : [],
    response: txStringValue(value.response),
    recordInput: !!value.record_input,
    hasRecordInput: Object.hasOwn(value, "record_input"),
    extra: txObjectExtra(
      value,
      new Set(["patterns", "response", "record_input"]),
    ),
  };
}

function txRuntimePromptJsonFromModel(prompt = {}) {
  return {
    ...(txPlainObject(prompt.extra) ? cloneTxJsonValue(prompt.extra, {}) : {}),
    patterns: Array.isArray(prompt.patterns)
      ? prompt.patterns.map((pattern) => String(pattern))
      : [],
    response: txStringValue(prompt.response),
    record_input: !!prompt.recordInput,
  };
}

function txCommandModelFromJson(source = {}) {
  const value = txPlainObject(source) ? source : {};
  const interactionValue = txPlainObject(value.interaction)
    ? value.interaction
    : {};
  return {
    mode: txStringValue(value.mode),
    command: txStringValue(value.command),
    multilineMode: txMultilineModeValue(value.multiline_mode),
    timeout: txNullableNumberValue(value.timeout),
    hasTimeout: Object.hasOwn(value, "timeout"),
    dynParams: txStringMapValue(value.dyn_params),
    hasDynParams: Object.hasOwn(value, "dyn_params"),
    interaction: {
      prompts: Array.isArray(interactionValue.prompts)
        ? interactionValue.prompts.map((prompt) =>
            txRuntimePromptModelFromJson(prompt),
          )
        : [],
      hasPrompts: Object.hasOwn(interactionValue, "prompts"),
      extra: txObjectExtra(
        interactionValue,
        new Set(["prompts", "interaction_label"]),
      ),
    },
    hasInteraction: Object.hasOwn(value, "interaction"),
    extra: {},
  };
}

function txCommandJsonFromModel(command = {}, { includeKind = true } = {}) {
  const result = {};
  if (includeKind) result.kind = "command";
  result.mode = txStringValue(command.mode);
  result.command = txStringValue(command.command);
  result.multiline_mode = txMultilineModeValue(command.multilineMode);
  result.timeout = txNullableNumberValue(command.timeout);
  result.dyn_params = txStringMapValue(command.dynParams);
  result.interaction = {
    ...txObjectExtra(
      command.interaction?.extra,
      new Set(["interaction_label"]),
    ),
    prompts: Array.isArray(command.interaction?.prompts)
      ? command.interaction.prompts.map((prompt) =>
          txRuntimePromptJsonFromModel(prompt),
        )
      : [],
  };
  return result;
}

function txFlowModelFromJson(source = {}) {
  const value = txPlainObject(source) ? source : {};
  return {
    steps: Array.isArray(value.steps)
      ? value.steps.map((step) => txCommandModelFromJson(step))
      : [],
    stopOnError:
      typeof value.stop_on_error === "boolean" ? value.stop_on_error : true,
    hasStopOnError: Object.hasOwn(value, "stop_on_error"),
    maxSteps: txNullableNumberValue(value.max_steps),
    hasMaxSteps: Object.hasOwn(value, "max_steps"),
    extra: txObjectExtra(
      value,
      new Set(["kind", "steps", "stop_on_error", "max_steps"]),
    ),
  };
}

function txFlowJsonFromModel(flow = {}) {
  const result = {
    ...(txPlainObject(flow.extra) ? cloneTxJsonValue(flow.extra, {}) : {}),
    kind: "flow",
    steps: Array.isArray(flow.steps)
      ? flow.steps.map((step) =>
          txCommandJsonFromModel(step, { includeKind: false }),
        )
      : [],
  };
  result.stop_on_error = !!flow.stopOnError;
  result.max_steps = txNullableNumberValue(flow.maxSteps);
  return result;
}

function txOperationModelFromJson(source = {}) {
  const value = txPlainObject(source) ? source : {};
  const kind = value.kind ?? "command";
  if (!TX_OPERATION_KINDS.has(kind)) {
    throw new Error(`unsupported transaction operation kind: ${kind}`);
  }
  return {
    kind,
    command: txCommandModelFromJson(value),
    flow: txFlowModelFromJson(value),
  };
}

function txOperationJsonFromModel(operation = {}) {
  if (operation.kind === "flow") return txFlowJsonFromModel(operation.flow);
  return txCommandJsonFromModel(operation.command, { includeKind: true });
}

function txValidationError(errors, path, messageKey) {
  errors.push({ path, messageKey });
}

function txValidateOptionalInteger(errors, path, value) {
  if (value === null) return;
  if (!Number.isSafeInteger(value) || value < 0) {
    txValidationError(errors, path, "txBlockValidationNonNegativeInteger");
  }
}

function txValidatePrompts(errors, path, prompts) {
  if (!Array.isArray(prompts)) return;
  prompts.forEach((prompt, index) => {
    if (!Array.isArray(prompt.patterns) || prompt.patterns.length === 0) {
      txValidationError(
        errors,
        `${path}[${index}].patterns`,
        "txBlockValidationPromptPatterns",
      );
    }
  });
}

function txValidateCommand(errors, path, command = {}) {
  if (!txStringValue(command.mode).trim()) {
    txValidationError(errors, `${path}.mode`, "txBlockValidationCommandMode");
  }
  if (!txStringValue(command.command).trim()) {
    txValidationError(
      errors,
      `${path}.command`,
      "txBlockValidationCommandText",
    );
  }
  txValidateOptionalInteger(errors, `${path}.timeout`, command.timeout);
  txValidatePrompts(
    errors,
    `${path}.interaction.prompts`,
    command.interaction?.prompts,
  );
}

function txValidateFlow(errors, path, flow = {}) {
  const steps = Array.isArray(flow.steps) ? flow.steps : [];
  if (steps.length === 0) {
    txValidationError(errors, `${path}.steps`, "txBlockValidationFlowSteps");
  }
  steps.forEach((command, index) =>
    txValidateCommand(errors, `${path}.steps[${index}]`, command),
  );
  txValidateOptionalInteger(errors, `${path}.maxSteps`, flow.maxSteps);
}

function txValidateOperation(errors, path, operation = {}) {
  if (operation.kind === "flow") {
    txValidateFlow(errors, `${path}.flow`, operation.flow);
    return;
  }
  txValidateCommand(errors, `${path}.command`, operation.command);
}

function txRollbackPolicyModelFromJson(policy) {
  if (policy === "per_step") return { kind: "per_step" };
  if (txPlainObject(policy) && txPlainObject(policy.whole_resource)) {
    return {
      kind: "whole_resource",
      wholeResource: {
        rollback: txOperationModelFromJson(policy.whole_resource.rollback),
        triggerStepIndex: txNullableNumberValue(
          policy.whole_resource.trigger_step_index,
        ),
        hasTriggerStepIndex: Object.hasOwn(
          policy.whole_resource,
          "trigger_step_index",
        ),
        extra: txObjectExtra(
          policy.whole_resource,
          new Set(["rollback", "trigger_step_index", "reason"]),
        ),
      },
    };
  }
  return { kind: "none" };
}

function txRollbackPolicyJsonFromModel(policy = {}) {
  const kind = TX_BLOCK_ROLLBACK_KINDS.has(policy.kind) ? policy.kind : "none";
  if (kind === "per_step") return "per_step";
  if (kind === "whole_resource") {
    const wholeResource = policy.wholeResource || {};
    const wholeResourceValue = {
      ...txObjectExtra(wholeResource.extra, new Set(["reason"])),
      rollback: txOperationJsonFromModel(wholeResource.rollback),
    };
    wholeResourceValue.trigger_step_index =
      txNullableNumberValue(wholeResource.triggerStepIndex) ?? 0;
    return {
      whole_resource: wholeResourceValue,
    };
  }
  return "none";
}

function txStepModelFromJson(source = {}) {
  const value = txPlainObject(source) ? source : {};
  return {
    run: txOperationModelFromJson(value.run),
    rollback: value.rollback ? txOperationModelFromJson(value.rollback) : null,
    hasRollback: Object.hasOwn(value, "rollback"),
    rollbackOnFailure: !!value.rollback_on_failure,
    hasRollbackOnFailure: Object.hasOwn(value, "rollback_on_failure"),
  };
}

function txStepJsonFromModel(step = {}) {
  return {
    run: txOperationJsonFromModel(step.run),
    rollback: step.rollback ? txOperationJsonFromModel(step.rollback) : null,
    rollback_on_failure: !!step.rollbackOnFailure,
  };
}

export function defaultTxBlockTemplatePayload() {
  return {
    name: "tx-block",
    rollback_policy: "none",
    steps: [
      {
        run: {
          kind: "command",
          mode: "",
          command: "show version",
          timeout: 30,
        },
        rollback: null,
        rollback_on_failure: false,
      },
    ],
    fail_fast: true,
  };
}

export function txBlockFormModelFromJson(txBlockValue = {}) {
  const source = txPlainObject(txBlockValue)
    ? txBlockValue
    : defaultTxBlockTemplatePayload();
  return {
    name: txStringValue(source.name, "tx-block"),
    rollbackPolicy: txRollbackPolicyModelFromJson(source.rollback_policy),
    steps: Array.isArray(source.steps)
      ? source.steps.map((step) => txStepModelFromJson(step))
      : [],
    failFast: typeof source.fail_fast === "boolean" ? source.fail_fast : true,
    hasFailFast: Object.hasOwn(source, "fail_fast"),
  };
}

export function validateTxBlockFormModel(model = {}) {
  const errors = [];
  const steps = Array.isArray(model.steps) ? model.steps : [];
  if (steps.length === 0) {
    txValidationError(errors, "steps", "txBlockValidationStepsRequired");
  }

  steps.forEach((step, index) => {
    txValidateOperation(errors, `steps[${index}].run`, step.run);
    if (step.rollback) {
      txValidateOperation(errors, `steps[${index}].rollback`, step.rollback);
    }
  });

  if (model.rollbackPolicy?.kind === "whole_resource") {
    const wholeResource = model.rollbackPolicy.wholeResource || {};
    txValidateOperation(
      errors,
      "rollbackPolicy.wholeResource.rollback",
      wholeResource.rollback,
    );
    const triggerStepIndex = wholeResource.hasTriggerStepIndex
      ? wholeResource.triggerStepIndex
      : 0;
    if (
      !Number.isInteger(triggerStepIndex) ||
      triggerStepIndex < 0 ||
      triggerStepIndex >= steps.length
    ) {
      txValidationError(
        errors,
        "rollbackPolicy.wholeResource.triggerStepIndex",
        "txBlockValidationTriggerRange",
      );
    }
  }

  return errors;
}

function txBlockJsonFromFormModel(model = {}) {
  const result = {
    name: txStringValue(model.name, "tx-block"),
    rollback_policy: txRollbackPolicyJsonFromModel(model.rollbackPolicy),
    steps: Array.isArray(model.steps)
      ? model.steps.map((step) => txStepJsonFromModel(step))
      : [],
    fail_fast: !!model.failFast,
  };
  return result;
}

function txBlockFormModelFromJsonText(jsonText = "") {
  if (typeof jsonText !== "string" || !jsonText.trim()) {
    const message = t("txBlockJsonRequired");
    return {
      error: message,
      errorDetail: { message, line: null, column: null },
      model: null,
    };
  }
  try {
    const parsedValue = JSON.parse(jsonText);
    if (!txPlainObject(parsedValue)) {
      const message = t("txBlockJsonInvalidShape");
      return {
        error: message,
        errorDetail: { message, line: null, column: null },
        model: null,
      };
    }
    return {
      error: "",
      errorDetail: null,
      model: txBlockFormModelFromJson(parsedValue),
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

export function txBlockEditorFormStateFromJsonText(
  jsonText = "",
  currentModel = null,
) {
  const result = txBlockFormModelFromJsonText(jsonText);
  return {
    formError: result.error,
    formErrorDetail: result.errorDetail,
    formModel: result.model || currentModel,
  };
}

export function txBlockFormModelToJsonText(model = {}) {
  return JSON.stringify(
    txWithoutUnsupportedLabels(txBlockJsonFromFormModel(model)),
    null,
    2,
  );
}

export function defaultTxWorkflowTemplateRefBlockPayload() {
  return {
    tx_block_template_name: "",
    tx_block_template_vars: {},
  };
}

export function txWorkflowTemplateRefBlockModelFromJson(source = {}) {
  const value = txPlainObject(source) ? source : {};
  return {
    name: value.name ?? null,
    hasName: Object.hasOwn(value, "name"),
    failFast: typeof value.fail_fast === "boolean" ? value.fail_fast : true,
    hasFailFast: Object.hasOwn(value, "fail_fast"),
    txBlockTemplateName: value.tx_block_template_name ?? null,
    hasTxBlockTemplateName: Object.hasOwn(value, "tx_block_template_name"),
    txBlockTemplateContent: value.tx_block_template_content ?? null,
    hasTxBlockTemplateContent: Object.hasOwn(
      value,
      "tx_block_template_content",
    ),
    txBlockTemplateVars: cloneTxJsonValue(value.tx_block_template_vars, {}),
    hasTxBlockTemplateVars: Object.hasOwn(value, "tx_block_template_vars"),
    extra: txObjectExtra(
      value,
      new Set([
        "name",
        "fail_fast",
        "tx_block_template_name",
        "tx_block_template_content",
        "tx_block_template_vars",
      ]),
    ),
  };
}

function txWorkflowTemplateRefBlockJsonFromModel(model = {}) {
  const result = {
    ...(txPlainObject(model.extra) ? cloneTxJsonValue(model.extra, {}) : {}),
  };
  if (model.hasName || model.name !== null) {
    result.name = model.name ?? null;
  }
  if (model.hasFailFast || model.failFast !== true) {
    result.fail_fast = !!model.failFast;
  }
  if (model.hasTxBlockTemplateName || model.txBlockTemplateName !== null) {
    result.tx_block_template_name = model.txBlockTemplateName ?? null;
  }
  if (
    model.hasTxBlockTemplateContent ||
    model.txBlockTemplateContent !== null
  ) {
    result.tx_block_template_content = model.txBlockTemplateContent ?? null;
  }
  if (
    model.hasTxBlockTemplateVars ||
    (txPlainObject(model.txBlockTemplateVars) &&
      Object.keys(model.txBlockTemplateVars).length > 0)
  ) {
    result.tx_block_template_vars = cloneTxJsonValue(
      model.txBlockTemplateVars,
      {},
    );
  }
  return result;
}

export function txWorkflowBlockFormModelFromJson(source = {}) {
  const value = txPlainObject(source) ? source : {};
  const hasTemplateName = value.tx_block_template_name != null;
  const hasTemplateContent = value.tx_block_template_content != null;
  const sourceKind =
    hasTemplateName || hasTemplateContent ? "template_ref" : "inline";
  return {
    sourceKind,
    inlineBlock: txBlockFormModelFromJson(value),
    templateRef: txWorkflowTemplateRefBlockModelFromJson(
      sourceKind === "template_ref"
        ? value
        : defaultTxWorkflowTemplateRefBlockPayload(),
    ),
  };
}

export function txWorkflowBlockJsonFromFormModel(model = {}) {
  if (model.sourceKind === "template_ref") {
    return txWorkflowTemplateRefBlockJsonFromModel(model.templateRef || {});
  }
  return txBlockJsonFromFormModel(model.inlineBlock || {});
}
