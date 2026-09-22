import { t } from "../../../lib/i18n.js";
import type {
  StandardBatchRetryFields,
  StandardInteractiveExecutionInput,
  StandardInteractiveExecutionPayload,
  StandardInteractiveExecutionSourceInput,
  StandardInteractiveNormalizedExecutionSource,
  StandardInteractiveSourcePayload,
  StandardInteractiveTextfsmFields,
  StandardInteractiveTextfsmPayload,
} from "./types.js";

const INTERACTIVE_BUILTIN_PREFIX = "builtin:";

function parseBuiltinInteractiveTemplateValue(value: string): string | null {
  const raw = value.trim();
  if (!raw.toLowerCase().startsWith(INTERACTIVE_BUILTIN_PREFIX)) return null;
  const name = raw.slice(INTERACTIVE_BUILTIN_PREFIX.length).trim();
  return name || null;
}

export function normalizeInteractiveExecutionSource(
  source: StandardInteractiveExecutionSourceInput = { kind: "saved" },
): StandardInteractiveNormalizedExecutionSource {
  if (source.kind === "temporary") {
    const content = source.content ?? "";
    if (!content.trim()) {
      throw new Error(t("interactiveDraftContentRequired"));
    }
    return { content, kind: "temporary" };
  }

  const templateSelection = (source.templateSelection ?? "").trim();
  if (!templateSelection) {
    throw new Error(t("interactiveTemplateNameRequired"));
  }
  return {
    builtinTemplateName:
      parseBuiltinInteractiveTemplateValue(templateSelection),
    kind: "saved",
    templateSelection,
  };
}

export function buildInteractiveExecutionPayload(
  {
    connection,
    recordLevel,
    source,
    textfsm = {},
    vars,
  }: StandardInteractiveExecutionInput = {},
  retryFields: StandardBatchRetryFields = {},
): StandardInteractiveExecutionPayload {
  const normalizedSource = normalizeInteractiveExecutionSource(source);
  let sourcePayload: StandardInteractiveSourcePayload;
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

export function standardInteractiveTextfsmPayload(
  fields: StandardInteractiveTextfsmFields = {},
): StandardInteractiveTextfsmPayload {
  return {
    textfsm_template: fields.template?.trim() || null,
    parse_textfsm: !!fields.enabled,
    textfsm_strict_errors: !!fields.strictErrors,
  };
}
