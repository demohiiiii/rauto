import { t } from "../../../lib/i18n.js";
import type {
  StandardBatchRetryFields,
  StandardCommandFlowExecutionInput,
  StandardCommandFlowExecutionPayload,
  StandardCommandFlowExecutionSourceInput,
  StandardCommandFlowNormalizedExecutionSource,
  StandardCommandFlowSourcePayload,
  StandardCommandFlowTextfsmFields,
  StandardCommandFlowTextfsmPayload,
} from "./types.js";

const FLOW_BUILTIN_PREFIX = "builtin:";

function parseBuiltinFlowTemplateValue(value: string): string | null {
  const raw = value.trim();
  if (!raw.toLowerCase().startsWith(FLOW_BUILTIN_PREFIX)) return null;
  const name = raw.slice(FLOW_BUILTIN_PREFIX.length).trim();
  return name || null;
}

export function normalizeCommandFlowExecutionSource(
  source: StandardCommandFlowExecutionSourceInput = { kind: "saved" },
): StandardCommandFlowNormalizedExecutionSource {
  if (source.kind === "temporary") {
    const content = source.content ?? "";
    if (!content.trim()) {
      throw new Error(t("flowDraftContentRequired"));
    }
    return { content, kind: "temporary" };
  }

  const templateSelection = (source.templateSelection ?? "").trim();
  if (!templateSelection) {
    throw new Error(t("flowTemplateNameRequired"));
  }
  return {
    builtinTemplateName: parseBuiltinFlowTemplateValue(templateSelection),
    kind: "saved",
    templateSelection,
  };
}

export function buildCommandFlowExecutionPayload(
  {
    connection,
    recordLevel,
    source,
    textfsm = {},
    vars,
  }: StandardCommandFlowExecutionInput = {},
  retryFields: StandardBatchRetryFields = {},
): StandardCommandFlowExecutionPayload {
  const normalizedSource = normalizeCommandFlowExecutionSource(source);
  let sourcePayload: StandardCommandFlowSourcePayload;
  if (normalizedSource.kind === "temporary") {
    sourcePayload = { content: normalizedSource.content };
  } else if (normalizedSource.builtinTemplateName) {
    sourcePayload = {
      builtin_template_name: normalizedSource.builtinTemplateName,
      template_name: null,
    };
  } else {
    sourcePayload = {
      builtin_template_name: null,
      template_name: normalizedSource.templateSelection,
    };
  }
  return {
    ...sourcePayload,
    vars: vars ?? null,
    ...textfsm,
    ...retryFields,
    connection,
    record_level: recordLevel,
  };
}

export function standardCommandFlowTextfsmPayload(
  fields: StandardCommandFlowTextfsmFields = {},
): StandardCommandFlowTextfsmPayload {
  return {
    textfsm_template: fields.template?.trim() || null,
    parse_textfsm: !!fields.enabled,
    textfsm_platform: fields.platform?.trim() || null,
    textfsm_strict_errors: !!fields.strictErrors,
  };
}
