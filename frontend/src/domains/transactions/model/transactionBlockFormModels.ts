import {
  cloneJsonValue,
  jsonParseErrorDetail,
  jsonValueText,
  nullableNumberValue,
  plainObject,
  stringValue,
} from "../../../lib/jsonValue.js";
import { t } from "../../../lib/i18n.js";
import type {
  JsonErrorDetail,
  JsonObject,
  TxBlockEditorFormState,
  TxBlockFormModel,
  TxCommandModel,
  TxFlowModel,
  TxMultilineMode,
  TxOperationKind,
  TxOperationModel,
  TxRollbackPolicyModel,
  TxRuntimePromptModel,
  TxStepFormModel,
  TxControlModel,
  TxValidationError,
  TxWholeResourceRollbackModel,
  TxWorkflowBlockFormModel,
  TxWorkflowTemplateRefBlockModel,
} from "./types.js";

let blockEditorSequence = 0;
export function createTxWorkflowBlockEditorId(): string {
  return `tx-block-${++blockEditorSequence}`;
}

const TX_BLOCK_ROLLBACK_KINDS = new Set(["none", "per_step", "whole_resource"]);
const TX_LOOP_RESERVED = new Set([
  "vars",
  "loop",
  "connection",
  "connections",
  "now",
  "defaults",
  "true",
  "false",
  "none",
  "True",
  "False",
  "None",
  "self",
  "super",
  "if",
  "else",
  "for",
  "in",
  "not",
  "and",
  "or",
  "is",
]);
const TX_OPERATION_KINDS = new Set(["command", "flow"]);

const cloneTxJsonValue = cloneJsonValue as unknown as {
  (value: unknown): unknown;
  <T>(value: unknown, fallback: T): T;
};
function txStringListValue(source: unknown = []): string[] {
  return Array.isArray(source)
    ? source.map((entryValue) => jsonValueText(entryValue))
    : [];
}

function txStringMapValue(source: unknown = {}): Record<string, string> {
  if (!plainObject(source)) return {};
  return Object.fromEntries(
    Object.entries(source).map(([key, entryValue]) => [
      String(key),
      jsonValueText(entryValue),
    ]),
  );
}

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

function txMultilineModeValue(value: unknown): TxMultilineMode {
  if (value == null || value === "") return "split_lines";
  if (value === "split_lines" || value === "whole") return value;
  throw new Error("multiline_mode must be split_lines or whole");
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

function txRuntimePromptModelFromJson(
  source: unknown = {},
): TxRuntimePromptModel {
  const value = plainObject(source) ? source : {};
  return {
    patterns: Array.isArray(value.patterns)
      ? value.patterns.map((pattern) => String(pattern))
      : [],
    response: stringValue(value.response),
    recordInput: !!value.record_input,
    hasRecordInput: Object.hasOwn(value, "record_input"),
    extra: txObjectExtra(
      value,
      new Set(["patterns", "response", "record_input"]),
    ),
  };
}

function txRuntimePromptJsonFromModel(
  prompt: Partial<TxRuntimePromptModel> = {},
): JsonObject {
  return {
    ...(plainObject(prompt.extra) ? cloneTxJsonValue(prompt.extra, {}) : {}),
    patterns: Array.isArray(prompt.patterns)
      ? prompt.patterns.map((pattern) => String(pattern))
      : [],
    response: stringValue(prompt.response),
    record_input: !!prompt.recordInput,
  };
}

function txCommandModelFromJson(source: unknown = {}): TxCommandModel {
  const value = plainObject(source) ? source : {};
  const interactionValue = plainObject(value.interaction)
    ? value.interaction
    : {};
  return {
    mode: stringValue(value.mode),
    command: stringValue(value.command),
    multilineMode: txMultilineModeValue(value.multiline_mode),
    timeout: nullableNumberValue(value.timeout),
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

function txCommandJsonFromModel(
  command: Partial<TxCommandModel> = {},
  { includeKind = true }: { includeKind?: boolean } = {},
): JsonObject {
  const result: JsonObject = {};
  if (includeKind) result.kind = "command";
  result.mode = stringValue(command.mode);
  result.command = stringValue(command.command);
  result.multiline_mode = txMultilineModeValue(command.multilineMode);
  result.timeout = nullableNumberValue(command.timeout);
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

function txFlowModelFromJson(source: unknown = {}): TxFlowModel {
  const value = plainObject(source) ? source : {};
  return {
    steps: Array.isArray(value.steps)
      ? value.steps.map((step) => txCommandModelFromJson(step))
      : [],
    stopOnError:
      typeof value.stop_on_error === "boolean" ? value.stop_on_error : true,
    hasStopOnError: Object.hasOwn(value, "stop_on_error"),
    maxSteps: nullableNumberValue(value.max_steps),
    hasMaxSteps: Object.hasOwn(value, "max_steps"),
    extra: txObjectExtra(
      value,
      new Set(["kind", "steps", "stop_on_error", "max_steps"]),
    ),
  };
}

function txFlowJsonFromModel(flow: Partial<TxFlowModel> = {}): JsonObject {
  const result: JsonObject = {
    ...(plainObject(flow.extra) ? cloneTxJsonValue(flow.extra, {}) : {}),
    kind: "flow",
    steps: Array.isArray(flow.steps)
      ? flow.steps.map((step) =>
          txCommandJsonFromModel(step, { includeKind: false }),
        )
      : [],
  };
  result.stop_on_error = !!flow.stopOnError;
  result.max_steps = nullableNumberValue(flow.maxSteps);
  return result;
}

function txOperationModelFromJson(source: unknown = {}): TxOperationModel {
  const value = plainObject(source) ? source : {};
  const kind = stringValue(value.kind, "command");
  if (!TX_OPERATION_KINDS.has(kind)) {
    throw new Error(`unsupported transaction operation kind: ${kind}`);
  }
  return {
    kind: kind as TxOperationKind,
    command: txCommandModelFromJson(value),
    flow: txFlowModelFromJson(value),
  };
}

function txOperationJsonFromModel(
  operation: Partial<TxOperationModel> = {},
): JsonObject {
  if (operation.kind === "flow") return txFlowJsonFromModel(operation.flow);
  return txCommandJsonFromModel(operation.command, { includeKind: true });
}

function txValidationError(
  errors: TxValidationError[],
  path: string,
  messageKey: string,
): void {
  errors.push({ path, messageKey });
}

function txValidateOptionalInteger(
  errors: TxValidationError[],
  path: string,
  value: unknown,
): void {
  if (value === null) return;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    txValidationError(errors, path, "txBlockValidationNonNegativeInteger");
  }
}

function txValidatePrompts(
  errors: TxValidationError[],
  path: string,
  prompts: unknown,
): void {
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

function txValidateCommand(
  errors: TxValidationError[],
  path: string,
  command: Partial<TxCommandModel> = {},
): void {
  if (!stringValue(command.mode).trim()) {
    txValidationError(errors, `${path}.mode`, "txBlockValidationCommandMode");
  }
  if (!stringValue(command.command).trim()) {
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

function txValidateFlow(
  errors: TxValidationError[],
  path: string,
  flow: Partial<TxFlowModel> = {},
): void {
  const steps = Array.isArray(flow.steps) ? flow.steps : [];
  if (steps.length === 0) {
    txValidationError(errors, `${path}.steps`, "txBlockValidationFlowSteps");
  }
  steps.forEach((command, index) =>
    txValidateCommand(errors, `${path}.steps[${index}]`, command),
  );
  txValidateOptionalInteger(errors, `${path}.maxSteps`, flow.maxSteps);
}

function txValidateOperation(
  errors: TxValidationError[],
  path: string,
  operation: Partial<TxOperationModel> = {},
): void {
  if (operation.kind === "flow") {
    txValidateFlow(errors, `${path}.flow`, operation.flow);
    return;
  }
  txValidateCommand(errors, `${path}.command`, operation.command);
}

function txRollbackPolicyModelFromJson(policy: unknown): TxRollbackPolicyModel {
  if (policy === "per_step") return { kind: "per_step" };
  if (plainObject(policy) && plainObject(policy.whole_resource)) {
    return {
      kind: "whole_resource",
      wholeResource: {
        rollback: txOperationModelFromJson(policy.whole_resource.rollback),
        triggerStepIndex: nullableNumberValue(
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

function txRollbackPolicyJsonFromModel(
  policy: Partial<TxRollbackPolicyModel> = {},
): unknown {
  const policyKind = stringValue(policy.kind);
  const kind = TX_BLOCK_ROLLBACK_KINDS.has(policyKind) ? policyKind : "none";
  if (kind === "per_step") return "per_step";
  if (kind === "whole_resource") {
    const wholeResource: Partial<TxWholeResourceRollbackModel> =
      policy.wholeResource || {};
    const wholeResourceValue: JsonObject = {
      ...txObjectExtra(wholeResource.extra, new Set(["reason"])),
      rollback: txOperationJsonFromModel(wholeResource.rollback),
    };
    wholeResourceValue.trigger_step_index =
      nullableNumberValue(wholeResource.triggerStepIndex) ?? 0;
    return {
      whole_resource: wholeResourceValue,
    };
  }
  return "none";
}

function txControlModelFromJson<T>(
  value: JsonObject,
  collection: "blocks" | "steps",
  parse: (source: unknown) => T,
): TxControlModel<T> | undefined {
  const children = (source: unknown): T[] =>
    Array.isArray(source) ? source.map(parse) : [];
  if (value.kind === "loop")
    return {
      kind: "loop",
      iterations: stringValue(value.iterations, "1"),
      itemVariable: stringValue(value.item_variable, "item"),
      blocks: children(value[collection]),
    };
  if (value.kind === "choice")
    return {
      kind: "choice",
      name: stringValue(value.name),
      branches: (Array.isArray(value.branches)
        ? value.branches
        : [{ condition: value.condition, [collection]: value.then }]
      ).map((source) => {
        const branch = plainObject(source) ? source : {};
        return {
          editorId: createTxWorkflowBlockEditorId(),
          condition: stringValue(branch.condition),
          blocks: children(branch[collection]),
        };
      }),
      otherwise: children(value.else),
    };
  return undefined;
}

function txControlJsonFromModel<T>(
  control: TxControlModel<T>,
  collection: "blocks" | "steps",
  serialize: (model: T) => JsonObject,
): JsonObject {
  return control.kind === "loop"
    ? {
        kind: "loop",
        iterations: control.iterations,
        item_variable: control.itemVariable,
        [collection]: control.blocks.map(serialize),
      }
    : {
        kind: "choice",
        name: control.name,
        branches: control.branches.map((branch) => ({
          condition: branch.condition,
          [collection]: branch.blocks.map(serialize),
        })),
        else: control.otherwise.map(serialize),
      };
}

function txStepModelFromJson(source: unknown = {}): TxStepFormModel {
  const value = plainObject(source) ? source : {};
  const control = txControlModelFromJson(value, "steps", txStepModelFromJson);
  return {
    ...(control ? { control } : {}),
    run: txOperationModelFromJson(value.run),
    rollback: value.rollback ? txOperationModelFromJson(value.rollback) : null,
    hasRollback: Object.hasOwn(value, "rollback"),
    rollbackOnFailure: !!value.rollback_on_failure,
    hasRollbackOnFailure: Object.hasOwn(value, "rollback_on_failure"),
  };
}

function txStepJsonFromModel(step: Partial<TxStepFormModel> = {}): JsonObject {
  if (step.control)
    return txControlJsonFromModel(step.control, "steps", txStepJsonFromModel);
  return {
    run: txOperationJsonFromModel(step.run),
    rollback: step.rollback ? txOperationJsonFromModel(step.rollback) : null,
    rollback_on_failure: !!step.rollbackOnFailure,
  };
}

export function defaultTxBlockTemplatePayload(): JsonObject {
  return {
    name: "tx-block",
    rollback_policy: "none",
    steps: [
      {
        run: {
          kind: "command",
          mode: "",
          command: "",
          timeout: 30,
        },
        rollback: null,
        rollback_on_failure: false,
      },
    ],
    fail_fast: true,
  };
}

export function txBlockFormModelFromJson(
  txBlockValue: unknown = {},
): TxBlockFormModel {
  const source = plainObject(txBlockValue)
    ? txBlockValue
    : defaultTxBlockTemplatePayload();
  return {
    name: stringValue(source.name, "tx-block"),
    rollbackPolicy: txRollbackPolicyModelFromJson(source.rollback_policy),
    steps: Array.isArray(source.steps)
      ? source.steps.map((step) => txStepModelFromJson(step))
      : [],
    failFast: typeof source.fail_fast === "boolean" ? source.fail_fast : true,
    hasFailFast: Object.hasOwn(source, "fail_fast"),
  };
}

export function validateTxBlockFormModel(
  model: Partial<TxBlockFormModel> = {},
): TxValidationError[] {
  const errors: TxValidationError[] = [];
  const steps = Array.isArray(model.steps) ? model.steps : [];
  if (steps.length === 0) {
    txValidationError(errors, "steps", "txBlockValidationStepsRequired");
  }

  function validateSteps(
    items: TxStepFormModel[],
    prefix: string,
    depth: number,
  ): void {
    if (depth > 16) {
      txValidationError(errors, prefix, "txBlockValidationControlDepth");
      return;
    }
    items.forEach((step, index) => {
      const path = `${prefix}[${index}]`;
      const control = step.control;
      if (!control) {
        txValidateOperation(errors, `${path}.run`, step.run);
        if (step.rollback)
          txValidateOperation(errors, `${path}.rollback`, step.rollback);
      } else if (control.kind === "loop") {
        if (!control.iterations.trim())
          txValidationError(
            errors,
            `${path}.control.iterations`,
            "txBlockValidationLoopExpression",
          );
        if (
          !/^[A-Za-z_][A-Za-z0-9_]*$/.test(control.itemVariable) ||
          TX_LOOP_RESERVED.has(control.itemVariable)
        )
          txValidationError(
            errors,
            `${path}.control.itemVariable`,
            "txBlockValidationLoopItem",
          );
        validateSteps(control.blocks, `${path}.control.blocks`, depth + 1);
      } else {
        if (!control.branches.length)
          txValidationError(
            errors,
            `${path}.control.branches`,
            "txBlockValidationChoiceCondition",
          );
        control.branches.forEach((branch, branchIndex) => {
          if (!branch.condition.trim())
            txValidationError(
              errors,
              `${path}.control.branches[${branchIndex}].condition`,
              "txBlockValidationChoiceCondition",
            );
          validateSteps(
            branch.blocks,
            `${path}.control.branches[${branchIndex}].blocks`,
            depth + 1,
          );
        });
        validateSteps(
          control.otherwise,
          `${path}.control.otherwise`,
          depth + 1,
        );
      }
    });
  }
  validateSteps(steps, "steps", 0);

  if (model.rollbackPolicy?.kind === "whole_resource") {
    const wholeResource: Partial<TxWholeResourceRollbackModel> =
      model.rollbackPolicy.wholeResource || {};
    txValidateOperation(
      errors,
      "rollbackPolicy.wholeResource.rollback",
      wholeResource.rollback,
    );
    const triggerStepIndex = wholeResource.hasTriggerStepIndex
      ? wholeResource.triggerStepIndex
      : 0;
    if (
      typeof triggerStepIndex !== "number" ||
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

function txBlockJsonFromFormModel(
  model: Partial<TxBlockFormModel> = {},
): JsonObject {
  const result: JsonObject = {
    name: stringValue(model.name, "tx-block"),
    rollback_policy: txRollbackPolicyJsonFromModel(model.rollbackPolicy),
    steps: Array.isArray(model.steps)
      ? model.steps.map((step) => txStepJsonFromModel(step))
      : [],
    fail_fast: !!model.failFast,
  };
  return result;
}

interface TxBlockParseResult {
  error: string;
  errorDetail: JsonErrorDetail | null;
  model: TxBlockFormModel | null;
}

function txBlockFormModelFromJsonText(jsonText = ""): TxBlockParseResult {
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
    if (!plainObject(parsedValue)) {
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
  currentModel: TxBlockFormModel | null = null,
): TxBlockEditorFormState {
  const result = txBlockFormModelFromJsonText(jsonText);
  return {
    formError: result.error,
    formErrorDetail: result.errorDetail,
    formModel: result.model || currentModel,
  };
}

export function txBlockFormModelToJsonText(
  model: Partial<TxBlockFormModel> = {},
): string {
  return JSON.stringify(
    txWithoutUnsupportedLabels(txBlockJsonFromFormModel(model)),
    null,
    2,
  );
}

export function defaultTxWorkflowTemplateRefBlockPayload(): JsonObject {
  return {
    tx_block_template_name: "",
    tx_block_template_vars: {},
  };
}

export function txWorkflowTemplateRefBlockModelFromJson(
  source: unknown = {},
): TxWorkflowTemplateRefBlockModel {
  const value = plainObject(source) ? source : {};
  return {
    name: typeof value.name === "string" ? value.name : null,
    hasName: Object.hasOwn(value, "name"),
    failFast: typeof value.fail_fast === "boolean" ? value.fail_fast : true,
    hasFailFast: Object.hasOwn(value, "fail_fast"),
    txBlockTemplateName:
      typeof value.tx_block_template_name === "string"
        ? value.tx_block_template_name
        : null,
    hasTxBlockTemplateName: Object.hasOwn(value, "tx_block_template_name"),
    txBlockTemplateContent:
      typeof value.tx_block_template_content === "string"
        ? value.tx_block_template_content
        : null,
    hasTxBlockTemplateContent: Object.hasOwn(
      value,
      "tx_block_template_content",
    ),
    txBlockTemplateVars:
      value.tx_block_template_vars === null
        ? null
        : plainObject(value.tx_block_template_vars)
          ? cloneTxJsonValue(value.tx_block_template_vars, {})
          : {},
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

function txWorkflowTemplateRefBlockJsonFromModel(
  model: Partial<TxWorkflowTemplateRefBlockModel> = {},
): JsonObject {
  const result: JsonObject = {
    ...(plainObject(model.extra) ? cloneTxJsonValue(model.extra, {}) : {}),
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
    (plainObject(model.txBlockTemplateVars) &&
      Object.keys(model.txBlockTemplateVars).length > 0)
  ) {
    result.tx_block_template_vars =
      model.txBlockTemplateVars === null
        ? null
        : cloneTxJsonValue(model.txBlockTemplateVars, {});
  }
  return result;
}

export function txWorkflowBlockFormModelFromJson(
  source: unknown = {},
): TxWorkflowBlockFormModel {
  const value = plainObject(source) ? source : {};
  const hasTemplateName = value.tx_block_template_name != null;
  const hasTemplateContent = value.tx_block_template_content != null;
  const sourceKind =
    hasTemplateName || hasTemplateContent ? "template_ref" : "inline";
  return {
    editorId: createTxWorkflowBlockEditorId(),
    sourceKind,
    inlineBlock: txBlockFormModelFromJson(value),
    templateRef: txWorkflowTemplateRefBlockModelFromJson(
      sourceKind === "template_ref"
        ? value
        : defaultTxWorkflowTemplateRefBlockPayload(),
    ),
    control: txControlModelFromJson(
      value,
      "blocks",
      txWorkflowBlockFormModelFromJson,
    ),
  };
}

export function txWorkflowBlockJsonFromFormModel(
  model: Partial<TxWorkflowBlockFormModel> = {},
): JsonObject {
  if (model.control) {
    return txControlJsonFromModel(
      model.control,
      "blocks",
      txWorkflowBlockJsonFromFormModel,
    );
  }
  if (model.sourceKind === "template_ref") {
    return txWorkflowTemplateRefBlockJsonFromModel(model.templateRef || {});
  }
  return txBlockJsonFromFormModel(model.inlineBlock || {});
}
