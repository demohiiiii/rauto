import {
  cloneJsonValue,
  nullableNumberValue,
  stringValue,
} from "../lib/jsonValue.js";
import {
  orchestrationCreateTxBlockActionModel,
  orchestrationCreateTxWorkflowActionModel,
  orchestrationJsonObjectPatchResult,
  orchestrationNullableTextValue,
  orchestrationPatchJobDraft,
  orchestrationToggleNullableFieldPresence,
  orchestrationToggleObjectFieldPresence,
} from "./orchestrationFormState.js";

const cloneOrchestrationJsonValue = cloneJsonValue;
const orchestrationStringValue = stringValue;
const orchestrationNullableNumberValue = nullableNumberValue;

function orchestrationBoolStringValue(value) {
  return value === "true" || value === true;
}

export function orchestrationTxBlockFieldPatch(
  fieldKey = "",
  fieldValue = null,
) {
  if (fieldKey === "mode") {
    return { mode: fieldValue, hasMode: true };
  }
  if (fieldKey === "template") {
    return { template: fieldValue, hasTemplate: true };
  }
  if (fieldKey === "timeoutSecs") {
    return { timeoutSecs: fieldValue, hasTimeoutSecs: true };
  }
  if (fieldKey === "rollbackOnFailure") {
    return {
      rollbackOnFailure: !!fieldValue,
      hasRollbackOnFailure: true,
    };
  }
  if (fieldKey === "rollbackTriggerStepIndex") {
    return {
      rollbackTriggerStepIndex: fieldValue,
      hasRollbackTriggerStepIndex: true,
    };
  }
  if (fieldKey === "resourceRollbackCommand") {
    return {
      resourceRollbackCommand: fieldValue,
      hasResourceRollbackCommand: true,
    };
  }
  if (fieldKey === "flowTemplateName") {
    return { flowTemplateName: fieldValue, hasFlowTemplateName: true };
  }
  if (fieldKey === "flowTemplateContent") {
    return {
      flowTemplateContent: fieldValue,
      hasFlowTemplateContent: true,
    };
  }
  if (fieldKey === "vars") {
    return {
      vars: cloneOrchestrationJsonValue(fieldValue, {}),
      hasVars: true,
    };
  }
  if (fieldKey === "flowVars") {
    return {
      flowVars: cloneOrchestrationJsonValue(fieldValue, {}),
      hasFlowVars: true,
    };
  }
  return {};
}

export function orchestrationTxBlockTemplateFieldPatch(
  fieldKey = "",
  fieldValue = null,
) {
  if (fieldKey === "txBlockTemplateName") {
    return {
      txBlockTemplateName: fieldValue,
      hasTxBlockTemplateName: true,
    };
  }
  if (fieldKey === "txBlockTemplateContent") {
    return {
      txBlockTemplateContent: fieldValue,
      hasTxBlockTemplateContent: true,
    };
  }
  if (fieldKey === "txBlockTemplateVars") {
    return {
      txBlockTemplateVars: cloneOrchestrationJsonValue(fieldValue, {}),
      hasTxBlockTemplateVars: true,
    };
  }
  return {};
}

export function orchestrationTxBlockListPresencePatch(
  txBlock = {},
  field = "",
  enabled = false,
) {
  const listKey =
    field === "rollbackCommands" ? "rollbackCommands" : "commands";
  const hasKey =
    listKey === "rollbackCommands" ? "hasRollbackCommands" : "hasCommands";
  return {
    [listKey]: enabled
      ? [...(Array.isArray(txBlock?.[listKey]) ? txBlock[listKey] : [])]
      : [],
    [hasKey]: enabled,
  };
}

export function orchestrationPatchTxBlockAction(
  model,
  stageIndex,
  jobIndex,
  patch = {},
) {
  const txBlockSourceTextValue = (value) =>
    value == null ? null : String(value);
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => ({
    ...job,
    action: {
      kind: "tx_block",
      txWorkflow:
        job.action?.txWorkflow || orchestrationCreateTxWorkflowActionModel(),
      txBlock: {
        ...(job.action?.txBlock || orchestrationCreateTxBlockActionModel()),
        ...patch,
        name: Object.hasOwn(patch, "name")
          ? orchestrationNullableTextValue(patch.name)
          : job.action?.txBlock?.name,
        template: Object.hasOwn(patch, "template")
          ? orchestrationNullableTextValue(patch.template)
          : job.action?.txBlock?.template,
        txBlockTemplateName: Object.hasOwn(patch, "txBlockTemplateName")
          ? txBlockSourceTextValue(patch.txBlockTemplateName)
          : job.action?.txBlock?.txBlockTemplateName,
        txBlockTemplateContent: Object.hasOwn(patch, "txBlockTemplateContent")
          ? txBlockSourceTextValue(patch.txBlockTemplateContent)
          : job.action?.txBlock?.txBlockTemplateContent,
        flowTemplateName: Object.hasOwn(patch, "flowTemplateName")
          ? txBlockSourceTextValue(patch.flowTemplateName)
          : job.action?.txBlock?.flowTemplateName,
        flowTemplateContent: Object.hasOwn(patch, "flowTemplateContent")
          ? txBlockSourceTextValue(patch.flowTemplateContent)
          : job.action?.txBlock?.flowTemplateContent,
        mode: Object.hasOwn(patch, "mode")
          ? orchestrationNullableTextValue(patch.mode)
          : job.action?.txBlock?.mode,
        resourceRollbackCommand: Object.hasOwn(patch, "resourceRollbackCommand")
          ? orchestrationNullableTextValue(patch.resourceRollbackCommand)
          : job.action?.txBlock?.resourceRollbackCommand,
        timeoutSecs: Object.hasOwn(patch, "timeoutSecs")
          ? orchestrationNullableNumberValue(patch.timeoutSecs)
          : job.action?.txBlock?.timeoutSecs,
        rollbackTriggerStepIndex: Object.hasOwn(
          patch,
          "rollbackTriggerStepIndex",
        )
          ? orchestrationNullableNumberValue(patch.rollbackTriggerStepIndex)
          : job.action?.txBlock?.rollbackTriggerStepIndex,
        rollbackOnFailure: Object.hasOwn(patch, "rollbackOnFailure")
          ? orchestrationBoolStringValue(patch.rollbackOnFailure)
          : job.action?.txBlock?.rollbackOnFailure,
      },
    },
  }));
}

export function orchestrationTxBlockActionJsonFieldUpdateResult(
  model,
  stageIndex,
  jobIndex,
  field,
  jsonText,
) {
  const patchFactory =
    field === "txBlockTemplateVars"
      ? orchestrationTxBlockTemplateFieldPatch
      : orchestrationTxBlockFieldPatch;
  return orchestrationJsonObjectPatchResult(model, jsonText, (parsedJson) =>
    orchestrationPatchTxBlockAction(
      model,
      stageIndex,
      jobIndex,
      patchFactory(field, parsedJson),
    ),
  );
}

export function orchestrationSetTxBlockActionFieldPresence(
  model,
  stageIndex,
  jobIndex,
  field,
  enabled,
) {
  return orchestrationPatchTxBlockAction(
    model,
    stageIndex,
    jobIndex,
    orchestrationToggleNullableFieldPresence(
      model?.stages?.[stageIndex]?.jobs?.[jobIndex]?.action?.txBlock,
      field,
      enabled,
    ),
  );
}

export function orchestrationSetTxBlockActionObjectPresence(
  model,
  stageIndex,
  jobIndex,
  field,
  enabled,
) {
  return orchestrationPatchTxBlockAction(
    model,
    stageIndex,
    jobIndex,
    orchestrationToggleObjectFieldPresence(
      model?.stages?.[stageIndex]?.jobs?.[jobIndex]?.action?.txBlock,
      field,
      enabled,
    ),
  );
}

export function orchestrationSetTxBlockActionSource(
  model,
  stageIndex,
  jobIndex,
  sourceValue,
) {
  const source =
    sourceValue === "tx_block_template_name" ||
    sourceValue === "tx_block_template_content" ||
    sourceValue === "flow_template_name" ||
    sourceValue === "flow_template_content"
      ? sourceValue
      : "direct";
  const patch = {
    template: null,
    hasTemplate: false,
    txBlockTemplateName: null,
    hasTxBlockTemplateName: false,
    txBlockTemplateContent: null,
    hasTxBlockTemplateContent: false,
    flowTemplateName: null,
    hasFlowTemplateName: false,
    flowTemplateContent: null,
    hasFlowTemplateContent: false,
  };
  if (source === "direct") {
    return orchestrationPatchTxBlockAction(model, stageIndex, jobIndex, patch);
  }
  const hasKey = `has${source
    .split("_")
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join("")}`;
  return orchestrationPatchTxBlockAction(model, stageIndex, jobIndex, {
    ...patch,
    [hasKey]: true,
  });
}

function orchestrationTxBlockActionModel(model, stageIndex, jobIndex) {
  const stages = Array.isArray(model?.stages) ? model.stages : [];
  const stage = stages[stageIndex];
  const jobs = Array.isArray(stage?.jobs) ? stage.jobs : [];
  const job = jobs[jobIndex];
  return job?.action?.txBlock || orchestrationCreateTxBlockActionModel();
}

export function orchestrationTxBlockActionBindings(
  model,
  stageIndex,
  jobIndex,
  onChange,
) {
  const applyChange = (nextModel) =>
    typeof onChange === "function" ? onChange(nextModel) : undefined;
  return {
    setSource(sourceValue) {
      applyChange(
        orchestrationSetTxBlockActionSource(
          model,
          stageIndex,
          jobIndex,
          sourceValue,
        ),
      );
    },
    setName(actionName) {
      applyChange(
        orchestrationPatchTxBlockAction(model, stageIndex, jobIndex, {
          name: actionName,
          hasName: true,
        }),
      );
    },
    setExtra(extra) {
      applyChange(
        orchestrationPatchTxBlockAction(model, stageIndex, jobIndex, { extra }),
      );
    },
    setFieldPresence(field, enabled) {
      applyChange(
        orchestrationSetTxBlockActionFieldPresence(
          model,
          stageIndex,
          jobIndex,
          field,
          enabled,
        ),
      );
    },
    setObjectPresence(field, enabled) {
      applyChange(
        orchestrationSetTxBlockActionObjectPresence(
          model,
          stageIndex,
          jobIndex,
          field,
          enabled,
        ),
      );
    },
    setListPresence(field, enabled) {
      applyChange(
        orchestrationPatchTxBlockAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxBlockListPresencePatch(
            orchestrationTxBlockActionModel(model, stageIndex, jobIndex),
            field,
            enabled,
          ),
        ),
      );
    },
    setMode(commandMode) {
      applyChange(
        orchestrationPatchTxBlockAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxBlockFieldPatch("mode", commandMode),
        ),
      );
    },
    setTemplate(commandTemplate) {
      applyChange(
        orchestrationPatchTxBlockAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxBlockFieldPatch("template", commandTemplate),
        ),
      );
    },
    setTimeoutSecs(timeoutSecs) {
      applyChange(
        orchestrationPatchTxBlockAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxBlockFieldPatch("timeoutSecs", timeoutSecs),
        ),
      );
    },
    setRollbackOnFailure(rollbackOnFailure) {
      applyChange(
        orchestrationPatchTxBlockAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxBlockFieldPatch(
            "rollbackOnFailure",
            rollbackOnFailure,
          ),
        ),
      );
    },
    setRollbackTriggerStepIndex(triggerStepIndex) {
      applyChange(
        orchestrationPatchTxBlockAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxBlockFieldPatch(
            "rollbackTriggerStepIndex",
            triggerStepIndex,
          ),
        ),
      );
    },
    setResourceRollbackCommand(resourceRollbackCommand) {
      applyChange(
        orchestrationPatchTxBlockAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxBlockFieldPatch(
            "resourceRollbackCommand",
            resourceRollbackCommand,
          ),
        ),
      );
    },
    setVars(vars) {
      applyChange(
        orchestrationPatchTxBlockAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxBlockFieldPatch("vars", vars),
        ),
      );
    },
    setTxBlockTemplateName(templateName) {
      applyChange(
        orchestrationPatchTxBlockAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxBlockTemplateFieldPatch(
            "txBlockTemplateName",
            templateName,
          ),
        ),
      );
    },
    setTxBlockTemplateContent(templateContent) {
      applyChange(
        orchestrationPatchTxBlockAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxBlockTemplateFieldPatch(
            "txBlockTemplateContent",
            templateContent,
          ),
        ),
      );
    },
    setTxBlockTemplateVars(txBlockTemplateVars) {
      applyChange(
        orchestrationPatchTxBlockAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxBlockTemplateFieldPatch(
            "txBlockTemplateVars",
            txBlockTemplateVars,
          ),
        ),
      );
    },
    setFlowTemplateName(flowTemplateName) {
      applyChange(
        orchestrationPatchTxBlockAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxBlockFieldPatch("flowTemplateName", flowTemplateName),
        ),
      );
    },
    setFlowTemplateContent(flowTemplateContent) {
      applyChange(
        orchestrationPatchTxBlockAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxBlockFieldPatch(
            "flowTemplateContent",
            flowTemplateContent,
          ),
        ),
      );
    },
    setFlowVars(flowVars) {
      applyChange(
        orchestrationPatchTxBlockAction(
          model,
          stageIndex,
          jobIndex,
          orchestrationTxBlockFieldPatch("flowVars", flowVars),
        ),
      );
    },
    addListItem(listName) {
      applyChange(
        orchestrationAddTxBlockListItem(model, stageIndex, jobIndex, listName),
      );
    },
    updateListItem(listName, itemIndex, listItemText) {
      applyChange(
        orchestrationUpdateTxBlockListItem(
          model,
          stageIndex,
          jobIndex,
          listName,
          itemIndex,
          listItemText,
        ),
      );
    },
    removeListItem(listName, itemIndex) {
      applyChange(
        orchestrationRemoveTxBlockListItem(
          model,
          stageIndex,
          jobIndex,
          listName,
          itemIndex,
        ),
      );
    },
  };
}

function orchestrationTxBlockListKey(listName) {
  return listName === "rollbackCommands" ? "rollbackCommands" : "commands";
}

function orchestrationTxBlockListHasKey(listKey) {
  return listKey === "rollbackCommands" ? "hasRollbackCommands" : "hasCommands";
}

function orchestrationAddTxBlockListItem(
  model,
  stageIndex,
  jobIndex,
  listName,
) {
  const listKey = orchestrationTxBlockListKey(listName);
  const hasKey = orchestrationTxBlockListHasKey(listKey);
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => {
    const txBlock =
      job.action?.txBlock || orchestrationCreateTxBlockActionModel();
    return {
      ...job,
      action: {
        kind: "tx_block",
        txWorkflow:
          job.action?.txWorkflow || orchestrationCreateTxWorkflowActionModel(),
        txBlock: {
          ...txBlock,
          [listKey]: [
            ...(Array.isArray(txBlock[listKey]) ? txBlock[listKey] : []),
            "",
          ],
          [hasKey]: true,
        },
      },
    };
  });
}

function orchestrationUpdateTxBlockListItem(
  model,
  stageIndex,
  jobIndex,
  listName,
  itemIndex,
  text,
) {
  const listKey = orchestrationTxBlockListKey(listName);
  const hasKey = orchestrationTxBlockListHasKey(listKey);
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => {
    const txBlock =
      job.action?.txBlock || orchestrationCreateTxBlockActionModel();
    const items = [
      ...(Array.isArray(txBlock[listKey]) ? txBlock[listKey] : []),
    ];
    items[itemIndex] = orchestrationStringValue(text);
    return {
      ...job,
      action: {
        kind: "tx_block",
        txWorkflow:
          job.action?.txWorkflow || orchestrationCreateTxWorkflowActionModel(),
        txBlock: {
          ...txBlock,
          [listKey]: items,
          [hasKey]: true,
        },
      },
    };
  });
}

function orchestrationRemoveTxBlockListItem(
  model,
  stageIndex,
  jobIndex,
  listName,
  itemIndex,
) {
  const listKey = orchestrationTxBlockListKey(listName);
  const hasKey = orchestrationTxBlockListHasKey(listKey);
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => {
    const txBlock =
      job.action?.txBlock || orchestrationCreateTxBlockActionModel();
    const items = [
      ...(Array.isArray(txBlock[listKey]) ? txBlock[listKey] : []),
    ];
    items.splice(itemIndex, 1);
    return {
      ...job,
      action: {
        kind: "tx_block",
        txWorkflow:
          job.action?.txWorkflow || orchestrationCreateTxWorkflowActionModel(),
        txBlock: {
          ...txBlock,
          [listKey]: items,
          [hasKey]: true,
        },
      },
    };
  });
}
