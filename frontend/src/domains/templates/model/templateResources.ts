import {
  commandFlowTemplateModelFromToml,
  commandFlowTemplateModelToToml,
} from "$domains/command/index.js";
import type { ConfigCommandRow } from "$domains/config-fetch/index.js";
import type {
  DeviceProfilesOverview,
  ProfileModes,
} from "$domains/profiles/index.js";
import type { JsonValue } from "$lib/jsonValue.js";
import { tr } from "../../../lib/i18n.js";
import type {
  TemplateManagerKind,
  TemplateManagerSection,
  TemplateResourceApiMeta,
  TemplateResourceDefinition,
  TemplateResourceMeta,
} from "./types.js";

export const TEMPLATE_MANAGER_KIND = Object.freeze({
  command: "command",
  flow: "flow",
  txBlock: "tx-block",
  txWorkflow: "tx-workflow",
  orchestration: "orchestration",
  textfsm: "textfsm",
  textfsmMappings: "textfsm-mappings",
  showObjects: "show-objects",
  configCatalog: "config-catalog",
} as const);

export const templateManagerSections = Object.freeze<TemplateManagerSection[]>([
  {
    key: TEMPLATE_MANAGER_KIND.command,
    group: "execution",
    labelKey: "templateManagerCommandTitle",
    descriptionKey: "templateManagerCommandDescription",
  },
  {
    key: TEMPLATE_MANAGER_KIND.flow,
    group: "execution",
    labelKey: "templateManagerFlowTitle",
    descriptionKey: "templateManagerFlowDescription",
  },
  {
    key: TEMPLATE_MANAGER_KIND.txBlock,
    group: "transaction",
    labelKey: "templateManagerTxBlockTitle",
    descriptionKey: "templateManagerTxBlockDescription",
  },
  {
    key: TEMPLATE_MANAGER_KIND.txWorkflow,
    group: "transaction",
    labelKey: "templateManagerTxWorkflowTitle",
    descriptionKey: "templateManagerTxWorkflowDescription",
  },
  {
    key: TEMPLATE_MANAGER_KIND.orchestration,
    group: "transaction",
    labelKey: "templateManagerOrchestrationTitle",
    descriptionKey: "templateManagerOrchestrationDescription",
  },
  {
    key: TEMPLATE_MANAGER_KIND.textfsm,
    group: "parsing",
    labelKey: "templateManagerTextfsmTitle",
    descriptionKey: "templateManagerTextfsmDescription",
  },
  {
    key: TEMPLATE_MANAGER_KIND.configCatalog,
    group: "parsing",
    labelKey: "templateManagerConfigCatalogTitle",
    descriptionKey: "templateManagerConfigCatalogDescription",
  },
  {
    key: TEMPLATE_MANAGER_KIND.textfsmMappings,
    group: "parsing",
    labelKey: "templateManagerMappingTitle",
    descriptionKey: "templateManagerMappingDescription",
  },
  {
    key: TEMPLATE_MANAGER_KIND.showObjects,
    group: "parsing",
    labelKey: "templateManagerShowObjectTitle",
    descriptionKey: "templateManagerShowObjectDescription",
  },
]);

export const contentTemplateKinds = new Set<TemplateManagerKind>([
  TEMPLATE_MANAGER_KIND.command,
  TEMPLATE_MANAGER_KIND.flow,
  TEMPLATE_MANAGER_KIND.txBlock,
  TEMPLATE_MANAGER_KIND.txWorkflow,
  TEMPLATE_MANAGER_KIND.orchestration,
  TEMPLATE_MANAGER_KIND.textfsm,
]);

export const templateResourceDefinitions = Object.freeze<
  Partial<Record<TemplateManagerKind, TemplateResourceDefinition>>
>({
  [TEMPLATE_MANAGER_KIND.command]: {
    apiBase: "/api/templates",
    format: "jinja",
    contentType: "text/plain",
  },
  [TEMPLATE_MANAGER_KIND.flow]: {
    apiBase: "/api/flow-templates",
    builtinApiBase: "/api/flow-templates/builtins",
    format: "toml",
    contentType: "application/toml",
  },
  [TEMPLATE_MANAGER_KIND.txBlock]: {
    apiBase: "/api/tx-block-templates",
    format: "json",
    contentType: "application/json",
  },
  [TEMPLATE_MANAGER_KIND.txWorkflow]: {
    apiBase: "/api/tx-workflow-templates",
    format: "json",
    contentType: "application/json",
  },
  [TEMPLATE_MANAGER_KIND.orchestration]: {
    apiBase: "/api/orchestration-templates",
    format: "json",
    contentType: "application/json",
  },
  [TEMPLATE_MANAGER_KIND.textfsm]: {
    apiBase: "/api/textfsm/templates",
    format: "textfsm",
    contentType: "text/plain",
  },
});

export const trimmedText = (value: string): string => value.trim();

export function uniqueNames(values: string[] = []): string[] {
  return values
    .map((value) => value.trim())
    .filter((value, index, names) => value && names.indexOf(value) === index);
}

export function profileNamesFromOverview(
  payload: DeviceProfilesOverview,
): string[] {
  return uniqueNames([
    ...payload.builtins.map((profile) => profile.name),
    ...payload.custom.map((profile) => profile.name),
  ]);
}

const DEFAULT_CONFIG_CATALOG_KINDS = Object.freeze(["running", "startup"]);

export function configCatalogKindNames(
  commandRows: ConfigCommandRow[] = [],
): string[] {
  return uniqueNames([
    ...DEFAULT_CONFIG_CATALOG_KINDS,
    ...commandRows.map((command) => command.kind),
  ]);
}

export function profileModeNames(payload: ProfileModes): string[] {
  return uniqueNames(payload.modes);
}

export function resourceKey(name: string, builtin = false): string {
  return `${builtin ? "builtin" : "custom"}:${trimmedText(name)}`;
}

export function normalizeResourceMeta(
  meta: TemplateResourceApiMeta,
  builtin = false,
): TemplateResourceMeta {
  const name = meta.name.trim();
  return {
    ...meta,
    name,
    kind: meta.kind.trim(),
    key: resourceKey(name, builtin),
    builtin,
    source: builtin ? "builtin" : meta.source.trim() || "custom",
    content_type: meta.content_type.trim(),
  };
}

function jsonTemplateContent(
  name: string,
  value: Record<string, JsonValue>,
): string {
  return JSON.stringify({ ...value, name }, null, 2);
}

export function defaultTemplateResourceContent(
  kind: TemplateManagerKind,
  name = "",
): string {
  const safeName = trimmedText(name) || "new-template";
  if (kind === TEMPLATE_MANAGER_KIND.command) return "show version";
  if (kind === TEMPLATE_MANAGER_KIND.flow) {
    return `name = ${JSON.stringify(safeName)}\nstop_on_error = true\n\n[[steps]]\ncommand = "show version"\nmultiline_mode = "split_lines"\n`;
  }
  if (kind === TEMPLATE_MANAGER_KIND.txBlock) {
    return jsonTemplateContent(safeName, {
      rollback_policy: "none",
      steps: [
        {
          run: {
            kind: "command",
            mode: "",
            command: "show version",
            multiline_mode: "split_lines",
            timeout: 30,
          },
          rollback: null,
          rollback_on_failure: false,
        },
      ],
      fail_fast: true,
    });
  }
  if (kind === TEMPLATE_MANAGER_KIND.txWorkflow) {
    return jsonTemplateContent(safeName, {
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
                mode: "",
                command: "show version",
                multiline_mode: "split_lines",
                timeout: 30,
              },
              rollback: null,
              rollback_on_failure: false,
            },
          ],
        },
      ],
    });
  }
  if (kind === TEMPLATE_MANAGER_KIND.orchestration) {
    return jsonTemplateContent(safeName, {
      fail_fast: true,
      rollback_on_stage_failure: true,
      rollback_completed_stages_on_failure: false,
      inventory: { groups: {} },
      stages: [],
    });
  }
  if (kind === TEMPLATE_MANAGER_KIND.textfsm) {
    return "Value VERSION (\\S+)\n\nStart\n  ^Version: ${VERSION} -> Record\n";
  }
  return "";
}

export function contentWithEmbeddedName(
  kind: TemplateManagerKind,
  content: string,
  name: string,
): string {
  if (kind === TEMPLATE_MANAGER_KIND.flow) {
    return commandFlowTemplateModelToToml({
      ...commandFlowTemplateModelFromToml(content),
      name,
    });
  }
  if (
    kind !== TEMPLATE_MANAGER_KIND.txBlock &&
    kind !== TEMPLATE_MANAGER_KIND.txWorkflow &&
    kind !== TEMPLATE_MANAGER_KIND.orchestration
  ) {
    return content;
  }
  const value = JSON.parse(content) as unknown;
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error(
      tr(
        "templateManagerJsonObjectRequired",
        "JSON template must be an object",
      ),
    );
  }
  return JSON.stringify(
    { ...(value as Record<string, JsonValue>), name },
    null,
    2,
  );
}
