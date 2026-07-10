import {
  cloneJsonValue,
  jsonValueText,
  nullableNumberValue,
  plainObject,
  stringValue,
} from "../lib/jsonValue.js";

const TX_BLOCK_ROLLBACK_KINDS = new Set(["none", "per_step", "whole_resource"]);
const TX_OPERATION_KINDS = new Set(["command", "flow", "template"]);

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
  const result = {
    ...(txPlainObject(prompt.extra) ? cloneTxJsonValue(prompt.extra, {}) : {}),
    patterns: Array.isArray(prompt.patterns)
      ? prompt.patterns.map((pattern) => String(pattern))
      : [],
    response: txStringValue(prompt.response),
  };
  if (prompt.hasRecordInput || prompt.recordInput) {
    result.record_input = !!prompt.recordInput;
  }
  return result;
}

function txCommandModelFromJson(source = {}) {
  const value = txPlainObject(source) ? source : {};
  const interactionValue = txPlainObject(value.interaction)
    ? value.interaction
    : {};
  return {
    mode: txStringValue(value.mode),
    command: txStringValue(value.command),
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
      extra: txObjectExtra(interactionValue, new Set(["prompts"])),
    },
    hasInteraction: Object.hasOwn(value, "interaction"),
    extra: txObjectExtra(
      value,
      new Set([
        "kind",
        "mode",
        "command",
        "timeout",
        "dyn_params",
        "interaction",
      ]),
    ),
  };
}

function txCommandJsonFromModel(command = {}, { includeKind = true } = {}) {
  const result = {
    ...(txPlainObject(command.extra)
      ? cloneTxJsonValue(command.extra, {})
      : {}),
  };
  if (includeKind) result.kind = "command";
  result.mode = txStringValue(command.mode);
  result.command = txStringValue(command.command);
  if (command.hasTimeout || command.timeout !== null) {
    result.timeout = txNullableNumberValue(command.timeout);
  }
  if (
    command.hasDynParams ||
    (txPlainObject(command.dynParams) &&
      Object.keys(command.dynParams).length > 0)
  ) {
    result.dyn_params = txStringMapValue(command.dynParams);
  }
  if (
    command.hasInteraction ||
    (txPlainObject(command.interaction) &&
      Array.isArray(command.interaction.prompts) &&
      command.interaction.prompts.length > 0) ||
    (txPlainObject(command.interaction) &&
      txPlainObject(command.interaction.extra) &&
      Object.keys(command.interaction.extra).length > 0)
  ) {
    const interactionValue = {
      ...(txPlainObject(command.interaction.extra)
        ? cloneTxJsonValue(command.interaction.extra, {})
        : {}),
    };
    if (
      command.interaction?.hasPrompts ||
      (Array.isArray(command.interaction?.prompts) &&
        command.interaction.prompts.length > 0)
    ) {
      interactionValue.prompts = Array.isArray(command.interaction.prompts)
        ? command.interaction.prompts.map((prompt) =>
            txRuntimePromptJsonFromModel(prompt),
          )
        : [];
    }
    result.interaction = interactionValue;
  }
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
  if (flow.hasStopOnError || flow.stopOnError !== true) {
    result.stop_on_error = !!flow.stopOnError;
  }
  if (flow.hasMaxSteps || flow.maxSteps !== null) {
    result.max_steps = txNullableNumberValue(flow.maxSteps);
  }
  return result;
}

function txTemplateVarModelFromJson(source = {}) {
  const value = txPlainObject(source) ? source : {};
  return {
    name: txStringValue(value.name),
    label: value.label ?? null,
    hasLabel: Object.hasOwn(value, "label"),
    description: value.description ?? null,
    hasDescription: Object.hasOwn(value, "description"),
    type: txStringValue(value.type, "string"),
    hasType: Object.hasOwn(value, "type"),
    required: !!value.required,
    hasRequired: Object.hasOwn(value, "required"),
    placeholder: value.placeholder ?? null,
    hasPlaceholder: Object.hasOwn(value, "placeholder"),
    options: txStringListValue(value.options),
    hasOptions: Object.hasOwn(value, "options"),
    defaultValue: Object.hasOwn(value, "default")
      ? cloneTxJsonValue(value.default)
      : null,
    hasDefault: Object.hasOwn(value, "default"),
    extra: txObjectExtra(
      value,
      new Set([
        "name",
        "label",
        "description",
        "type",
        "required",
        "placeholder",
        "options",
        "default",
      ]),
    ),
  };
}

function txTemplateVarJsonFromModel(variable = {}) {
  const result = {
    ...(txPlainObject(variable.extra)
      ? cloneTxJsonValue(variable.extra, {})
      : {}),
    name: txStringValue(variable.name),
  };
  if (variable.hasLabel || variable.label !== null) {
    result.label = variable.label ?? null;
  }
  if (variable.hasDescription || variable.description !== null) {
    result.description = variable.description ?? null;
  }
  if (variable.hasType || variable.type !== "string") {
    result.type = txStringValue(variable.type, "string");
  }
  if (variable.hasRequired || variable.required) {
    result.required = !!variable.required;
  }
  if (variable.hasPlaceholder || variable.placeholder !== null) {
    result.placeholder = variable.placeholder ?? null;
  }
  if (
    variable.hasOptions ||
    (Array.isArray(variable.options) && variable.options.length > 0)
  ) {
    result.options = txStringListValue(variable.options);
  }
  if (variable.hasDefault || variable.defaultValue !== null) {
    result.default = cloneTxJsonValue(variable.defaultValue);
  }
  return result;
}

function txTemplatePromptModelFromJson(source = {}) {
  const value = txPlainObject(source) ? source : {};
  return {
    patterns: Array.isArray(value.patterns)
      ? value.patterns.map((pattern) => String(pattern))
      : [],
    response: txStringValue(value.response),
    appendNewline: !!value.append_newline,
    hasAppendNewline: Object.hasOwn(value, "append_newline"),
    recordInput: !!value.record_input,
    hasRecordInput: Object.hasOwn(value, "record_input"),
    extra: txObjectExtra(
      value,
      new Set(["patterns", "response", "append_newline", "record_input"]),
    ),
  };
}

function txTemplatePromptJsonFromModel(prompt = {}) {
  const result = {
    ...(txPlainObject(prompt.extra) ? cloneTxJsonValue(prompt.extra, {}) : {}),
    patterns: Array.isArray(prompt.patterns)
      ? prompt.patterns.map((pattern) => String(pattern))
      : [],
    response: txStringValue(prompt.response),
  };
  if (prompt.hasAppendNewline || prompt.appendNewline) {
    result.append_newline = !!prompt.appendNewline;
  }
  if (prompt.hasRecordInput || prompt.recordInput) {
    result.record_input = !!prompt.recordInput;
  }
  return result;
}

function txTemplateStepModelFromJson(source = {}) {
  const value = txPlainObject(source) ? source : {};
  return {
    command: txStringValue(value.command),
    mode: value.mode ?? null,
    hasMode: Object.hasOwn(value, "mode"),
    timeoutSecs: txNullableNumberValue(value.timeout_secs),
    hasTimeoutSecs: Object.hasOwn(value, "timeout_secs"),
    prompts: Array.isArray(value.prompts)
      ? value.prompts.map((prompt) => txTemplatePromptModelFromJson(prompt))
      : [],
    hasPrompts: Object.hasOwn(value, "prompts"),
    extra: txObjectExtra(
      value,
      new Set(["command", "mode", "timeout_secs", "prompts"]),
    ),
  };
}

function txTemplateStepJsonFromModel(step = {}) {
  const result = {
    ...(txPlainObject(step.extra) ? cloneTxJsonValue(step.extra, {}) : {}),
    command: txStringValue(step.command),
  };
  if (step.hasMode || step.mode !== null) {
    result.mode = step.mode ?? null;
  }
  if (step.hasTimeoutSecs || step.timeoutSecs !== null) {
    result.timeout_secs = txNullableNumberValue(step.timeoutSecs);
  }
  if (
    step.hasPrompts ||
    (Array.isArray(step.prompts) && step.prompts.length > 0)
  ) {
    result.prompts = Array.isArray(step.prompts)
      ? step.prompts.map((prompt) => txTemplatePromptJsonFromModel(prompt))
      : [];
  }
  return result;
}

function txTemplateOperationModelFromJson(source = {}) {
  const value = txPlainObject(source) ? source : {};
  const template = txPlainObject(value.template) ? value.template : {};
  const runtime = txPlainObject(value.runtime) ? value.runtime : {};
  return {
    currentConnectionAlias: value.current_connection_alias ?? null,
    hasCurrentConnectionAlias: Object.hasOwn(value, "current_connection_alias"),
    hasRuntime: Object.hasOwn(value, "runtime"),
    template: {
      name: txStringValue(template.name),
      description: template.description ?? null,
      hasDescription: Object.hasOwn(template, "description"),
      vars: Array.isArray(template.vars)
        ? template.vars.map((variable) => txTemplateVarModelFromJson(variable))
        : [],
      hasVars: Object.hasOwn(template, "vars"),
      stopOnError:
        typeof template.stop_on_error === "boolean"
          ? template.stop_on_error
          : true,
      hasStopOnError: Object.hasOwn(template, "stop_on_error"),
      defaultMode: template.default_mode ?? null,
      hasDefaultMode: Object.hasOwn(template, "default_mode"),
      steps: Array.isArray(template.steps)
        ? template.steps.map((step) => txTemplateStepModelFromJson(step))
        : [],
      hasSteps: Object.hasOwn(template, "steps"),
      extra: txObjectExtra(
        template,
        new Set([
          "name",
          "description",
          "vars",
          "stop_on_error",
          "default_mode",
          "steps",
        ]),
      ),
    },
    runtime: {
      defaultMode: runtime.default_mode ?? null,
      hasDefaultMode: Object.hasOwn(runtime, "default_mode"),
      connectionName: runtime.connection_name ?? null,
      hasConnectionName: Object.hasOwn(runtime, "connection_name"),
      host: runtime.host ?? null,
      hasHost: Object.hasOwn(runtime, "host"),
      username: runtime.username ?? null,
      hasUsername: Object.hasOwn(runtime, "username"),
      deviceProfile: runtime.device_profile ?? null,
      hasDeviceProfile: Object.hasOwn(runtime, "device_profile"),
      vars: cloneTxJsonValue(runtime.vars, {}),
      hasVars: Object.hasOwn(runtime, "vars"),
      extra: txObjectExtra(
        runtime,
        new Set([
          "default_mode",
          "connection_name",
          "host",
          "username",
          "device_profile",
          "vars",
        ]),
      ),
    },
    extra: txObjectExtra(
      value,
      new Set(["kind", "current_connection_alias", "template", "runtime"]),
    ),
  };
}

function txTemplateOperationJsonFromModel(templateOperation = {}) {
  const template = templateOperation.template || {};
  const runtime = templateOperation.runtime || {};
  const result = {
    ...(txPlainObject(templateOperation.extra)
      ? cloneTxJsonValue(templateOperation.extra, {})
      : {}),
    kind: "template",
    template: {
      ...(txPlainObject(template.extra)
        ? cloneTxJsonValue(template.extra, {})
        : {}),
      name: txStringValue(template.name),
    },
  };
  if (template.hasDescription || template.description !== null) {
    result.template.description = template.description ?? null;
  }
  if (
    templateOperation.hasCurrentConnectionAlias ||
    templateOperation.currentConnectionAlias !== null
  ) {
    result.current_connection_alias =
      templateOperation.currentConnectionAlias ?? null;
  }
  if (
    template.hasVars ||
    (Array.isArray(template.vars) && template.vars.length > 0)
  ) {
    result.template.vars = Array.isArray(template.vars)
      ? template.vars.map((variable) => txTemplateVarJsonFromModel(variable))
      : [];
  }
  if (template.hasStopOnError || template.stopOnError !== true) {
    result.template.stop_on_error = !!template.stopOnError;
  }
  if (template.hasDefaultMode || template.defaultMode !== null) {
    result.template.default_mode = template.defaultMode ?? null;
  }
  if (
    template.hasSteps ||
    (Array.isArray(template.steps) && template.steps.length > 0)
  ) {
    result.template.steps = Array.isArray(template.steps)
      ? template.steps.map((step) => txTemplateStepJsonFromModel(step))
      : [];
  }
  const runtimeValue = {
    ...(txPlainObject(runtime.extra)
      ? cloneTxJsonValue(runtime.extra, {})
      : {}),
  };
  if (runtime.hasDefaultMode || runtime.defaultMode !== null) {
    runtimeValue.default_mode = runtime.defaultMode ?? null;
  }
  if (runtime.hasConnectionName || runtime.connectionName !== null) {
    runtimeValue.connection_name = runtime.connectionName ?? null;
  }
  if (runtime.hasHost || runtime.host !== null) {
    runtimeValue.host = runtime.host ?? null;
  }
  if (runtime.hasUsername || runtime.username !== null) {
    runtimeValue.username = runtime.username ?? null;
  }
  if (runtime.hasDeviceProfile || runtime.deviceProfile !== null) {
    runtimeValue.device_profile = runtime.deviceProfile ?? null;
  }
  if (
    runtime.hasVars ||
    (txPlainObject(runtime.vars) && Object.keys(runtime.vars).length > 0)
  ) {
    runtimeValue.vars = cloneTxJsonValue(runtime.vars, {});
  }
  if (templateOperation.hasRuntime || Object.keys(runtimeValue).length > 0) {
    result.runtime = runtimeValue;
  }
  return result;
}

function txOperationModelFromJson(source = {}) {
  const value = txPlainObject(source) ? source : {};
  const kind = TX_OPERATION_KINDS.has(value.kind) ? value.kind : "command";
  return {
    kind,
    command: txCommandModelFromJson(value),
    flow: txFlowModelFromJson(value),
    template: txTemplateOperationModelFromJson(value),
  };
}

function txOperationJsonFromModel(operation = {}) {
  if (operation.kind === "flow") return txFlowJsonFromModel(operation.flow);
  if (operation.kind === "template") {
    return txTemplateOperationJsonFromModel(operation.template);
  }
  return txCommandJsonFromModel(operation.command, { includeKind: true });
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
          new Set(["rollback", "trigger_step_index"]),
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
      ...(txPlainObject(wholeResource.extra)
        ? cloneTxJsonValue(wholeResource.extra, {})
        : {}),
      rollback: txOperationJsonFromModel(wholeResource.rollback),
    };
    if (
      wholeResource.hasTriggerStepIndex ||
      wholeResource.triggerStepIndex !== null
    ) {
      wholeResourceValue.trigger_step_index = txNullableNumberValue(
        wholeResource.triggerStepIndex,
      );
    }
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
    extra: txObjectExtra(
      value,
      new Set(["run", "rollback", "rollback_on_failure"]),
    ),
  };
}

function txStepJsonFromModel(step = {}) {
  const result = {
    ...(txPlainObject(step.extra) ? cloneTxJsonValue(step.extra, {}) : {}),
    run: txOperationJsonFromModel(step.run),
  };
  if (step.hasRollback || step.rollback) {
    result.rollback = step.rollback
      ? txOperationJsonFromModel(step.rollback)
      : null;
  }
  if (step.hasRollbackOnFailure || step.rollbackOnFailure) {
    result.rollback_on_failure = !!step.rollbackOnFailure;
  }
  return result;
}

export function defaultTxBlockTemplatePayload() {
  return {
    name: "tx-block",
    rollback_policy: "none",
    steps: [
      {
        run: {
          kind: "command",
          mode: "User",
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

export function defaultFullTxBlockTemplatePayload() {
  return {
    name: "tx-block-full",
    fail_fast: true,
    root_label: "full-draft",
    rollback_policy: {
      whole_resource: {
        trigger_step_index: 0,
        reason: "rollback when the resource-level validation fails",
        rollback: {
          kind: "command",
          mode: "Enable",
          command: "configure replace flash:backup.cfg force",
          timeout: 60,
          rollback_label: "whole-resource-rollback",
          dyn_params: {
            enable_password: "",
            sudo_password: "",
          },
          interaction: {
            interaction_label: "whole-resource-confirm",
            prompts: [
              {
                patterns: ["confirm", "Continue?"],
                response: "yes",
                record_input: false,
                prompt_label: "whole-resource-confirm-prompt",
              },
            ],
          },
        },
      },
    },
    steps: [
      {
        step_label: "command-step",
        rollback_on_failure: true,
        run: {
          kind: "command",
          mode: "Enable",
          command: "show running-config",
          timeout: 30,
          command_label: "collect-running-config",
          dyn_params: {
            enable_password: "",
            sudo_password: "",
          },
          interaction: {
            interaction_label: "command-confirm",
            prompts: [
              {
                patterns: ["confirm", "Continue?"],
                response: "yes",
                record_input: false,
                prompt_label: "command-confirm-prompt",
              },
            ],
          },
        },
        rollback: {
          kind: "command",
          mode: "Enable",
          command: "clear logging",
          timeout: 30,
          rollback_label: "command-step-rollback",
        },
      },
      {
        step_label: "flow-step",
        rollback_on_failure: false,
        run: {
          kind: "flow",
          stop_on_error: true,
          max_steps: 2,
          flow_label: "precheck-flow",
          steps: [
            {
              mode: "Enable",
              command: "show ip route",
              timeout: 30,
              flow_step_label: "route-check",
            },
            {
              mode: "Enable",
              command: "show interfaces status",
              timeout: 30,
              flow_step_label: "interface-check",
            },
          ],
        },
        rollback: null,
      },
      {
        step_label: "template-step",
        rollback_on_failure: false,
        run: {
          kind: "template",
          current_connection_alias: "",
          template_operation_label: "template-operation",
          template: {
            name: "saved-template",
            description: "",
            stop_on_error: true,
            default_mode: "Enable",
            template_definition_label: "template-definition",
            vars: [
              {
                name: "hostname",
                label: "Hostname",
                description: "",
                type: "string",
                required: true,
                placeholder: "",
                options: ["edge-01", "edge-02"],
                default: "edge-01",
                variable_label: "hostname-var",
              },
            ],
            steps: [
              {
                command: "show running-config interface ${hostname}",
                mode: "Enable",
                timeout_secs: 30,
                template_step_label: "template-step-1",
                prompts: [
                  {
                    patterns: ["confirm"],
                    response: "yes",
                    append_newline: true,
                    record_input: false,
                    prompt_label: "template-confirm-prompt",
                  },
                ],
              },
            ],
          },
          runtime: {
            default_mode: "Enable",
            connection_name: "",
            host: "",
            username: "",
            device_profile: "",
            runtime_label: "runtime-override",
            vars: {
              dry_run: true,
              retries: 1,
            },
          },
        },
        rollback: null,
      },
    ],
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
    extra: txObjectExtra(
      source,
      new Set(["name", "rollback_policy", "steps", "fail_fast"]),
    ),
  };
}

function txBlockJsonFromFormModel(model = {}) {
  const result = {
    ...(txPlainObject(model.extra) ? cloneTxJsonValue(model.extra, {}) : {}),
    name: txStringValue(model.name, "tx-block"),
    rollback_policy: txRollbackPolicyJsonFromModel(model.rollbackPolicy),
    steps: Array.isArray(model.steps)
      ? model.steps.map((step) => txStepJsonFromModel(step))
      : [],
  };
  if (model.hasFailFast || model.failFast !== true) {
    result.fail_fast = !!model.failFast;
  }
  return result;
}

function txBlockFormModelFromJsonText(jsonText = "") {
  if (typeof jsonText !== "string" || !jsonText.trim()) {
    return { error: "", model: null };
  }
  try {
    return {
      error: "",
      model: txBlockFormModelFromJson(JSON.parse(jsonText)),
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

export function txBlockEditorFormStateFromJsonText(
  jsonText = "",
  currentModel = null,
) {
  const result = txBlockFormModelFromJsonText(jsonText);
  return {
    formError: result.error,
    formModel: result.model || currentModel,
  };
}

export function txBlockFormModelToJsonText(model = {}) {
  return JSON.stringify(txBlockJsonFromFormModel(model), null, 2);
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
