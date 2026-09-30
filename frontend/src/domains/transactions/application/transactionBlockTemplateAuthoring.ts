import { get, writable } from "svelte/store";
import { createExecutionTemplateWorkspace } from "$domains/templates/index.js";
import {
  defaultTxBlockTemplatePayload,
  txBlockEditorFormStateFromJsonText,
  txBlockFormModelToJsonText,
  txWorkflowBlockFormModelFromJson,
} from "../model/transactionBlockFormModels.js";
import type {
  JsonObject,
  TxBlockFormModel,
  TxWorkflowBlockFormModel,
  TxWorkflowFormModel,
} from "../model/types.js";

type TemplateOptions = NonNullable<
  Parameters<typeof createExecutionTemplateWorkspace>[0]
>;
interface Options {
  block: TxWorkflowBlockFormModel;
  onChange: (block: TxWorkflowBlockFormModel) => void;
  canModify: () => boolean;
  templateOptions?: TemplateOptions;
}

export function createTransactionBlockTemplateAuthoring({
  block,
  onChange,
  canModify,
  templateOptions = {},
}: Options) {
  let currentBlock = block;
  let destroyed = false;
  let contentSource = block.sourceKind === "template_ref";
  const initialName = contentSource
    ? block.templateRef.txBlockTemplateName || ""
    : "";
  const contentReadyStateStore = writable(!initialName);
  const jsonTextStateStore = writable(
    contentSource
      ? block.templateRef.txBlockTemplateContent ||
          txBlockFormModelToJsonText(block.inlineBlock)
      : txBlockFormModelToJsonText(block.inlineBlock),
  );
  const formStateStore = writable(
    txBlockEditorFormStateFromJsonText(get(jsonTextStateStore)),
  );

  function replaceJson(content: string): void {
    contentReadyStateStore.set(true);
    jsonTextStateStore.set(content);
    formStateStore.set(txBlockEditorFormStateFromJsonText(content));
  }
  function publish(named: boolean): void {
    if (destroyed || !canModify()) return;
    const selectedName = get(workspace.displayStateStore).selectedName;
    const text = get(jsonTextStateStore);
    const formModel = get(formStateStore).formModel;
    if (named && selectedName) {
      currentBlock = {
        ...currentBlock,
        sourceKind: "template_ref",
        templateRef: {
          ...currentBlock.templateRef,
          hasTxBlockTemplateName: true,
          txBlockTemplateName: selectedName,
          hasTxBlockTemplateContent: false,
          txBlockTemplateContent: null,
        },
      };
    } else if (contentSource || selectedName || !formModel) {
      currentBlock = {
        ...currentBlock,
        sourceKind: "template_ref",
        templateRef: {
          ...currentBlock.templateRef,
          hasTxBlockTemplateName: false,
          txBlockTemplateName: null,
          hasTxBlockTemplateContent: true,
          txBlockTemplateContent: text,
        },
      };
    } else {
      currentBlock = {
        ...currentBlock,
        sourceKind: "inline",
        inlineBlock: formModel,
      };
    }
    onChange(currentBlock);
  }
  const workspace = createExecutionTemplateWorkspace({
    ...templateOptions,
    apiBase: "/api/tx-block-templates",
    initialSelectedName: initialName,
    getCurrentJson: () => get(jsonTextStateStore),
    replaceJson,
    createDraft: () => {
      contentSource = false;
      currentBlock = {
        ...txWorkflowBlockFormModelFromJson(defaultTxBlockTemplatePayload()),
        editorId: currentBlock.editorId,
      };
      replaceJson(txBlockFormModelToJsonText(currentBlock.inlineBlock));
    },
    validateContent: (text) => {
      const parsed = txBlockEditorFormStateFromJsonText(text);
      if (parsed.formError) throw new Error(parsed.formError);
    },
  });
  function editable(): boolean {
    return (
      !destroyed &&
      canModify() &&
      get(contentReadyStateStore) &&
      workspace.canEdit()
    );
  }
  async function selectTemplate(name: string): Promise<boolean> {
    if (!canModify() || destroyed) return false;
    const selected =
      name === initialName && !get(contentReadyStateStore)
        ? await workspace.initialize()
        : await workspace.selectTemplate(name);
    if (selected) {
      if (name) contentSource = true;
      publish(true);
    }
    return selected;
  }
  async function saveTemplate(): Promise<boolean> {
    if (!editable()) return false;
    const saved = await workspace.saveTemplate();
    if (saved) publish(true);
    return saved;
  }
  async function submitNameDialog(): Promise<boolean> {
    if (!editable()) return false;
    const saved = await workspace.submitNameDialog();
    if (saved) {
      contentSource = true;
      publish(true);
    }
    return saved;
  }
  async function cancelEditing(): Promise<boolean> {
    if (!canModify() || destroyed) return false;
    const cancelled = await workspace.cancelEditing();
    if (cancelled) publish(true);
    return cancelled;
  }
  function changeJson(text: string): void {
    if (!editable()) return;
    replaceJson(text);
    workspace.markEdited();
    publish(false);
  }
  let initialization: Promise<boolean> | null = null;
  return {
    contentReadyStateStore,
    displayStateStore: workspace.displayStateStore,
    formStateStore,
    jsonTextStateStore,
    initialize: () =>
      (initialization ??= workspace.initialize().then((success) => {
        if (!success) initialization = null;
        return success;
      })),
    selectTemplate,
    saveTemplate,
    submitNameDialog,
    cancelEditing,
    changeJson,
    changeFormModel: (model: TxBlockFormModel) => {
      if (!editable()) return;
      const text = txBlockFormModelToJsonText(model);
      jsonTextStateStore.set(text);
      // Keep inactive operation drafts in the editor; only the active kind is serialized.
      formStateStore.set({
        ...txBlockEditorFormStateFromJsonText(text),
        formModel: structuredClone(model),
      });
      workspace.markEdited();
      publish(false);
    },
    startEditing: () => {
      if (canModify() && !destroyed && get(contentReadyStateStore))
        workspace.startEditing();
    },
    copyToManual: () => {
      if (
        !canModify() ||
        !get(contentReadyStateStore) ||
        destroyed ||
        !get(workspace.displayStateStore).readonly ||
        get(workspace.displayStateStore).loadingAction
      )
        return;
      workspace.copyToManual();
      contentSource = true;
      publish(false);
    },
    changeVariables: (vars: JsonObject) => {
      if (!canModify() || destroyed) return;
      currentBlock = {
        ...currentBlock,
        templateRef: {
          ...currentBlock.templateRef,
          hasTxBlockTemplateVars: true,
          txBlockTemplateVars: vars,
        },
      };
      onChange(currentBlock);
    },
    changeNameDialogValue: workspace.changeNameDialogValue,
    closeNameDialog: workspace.closeNameDialog,
    setBlockContext: (nextBlock: TxWorkflowBlockFormModel) => {
      currentBlock = nextBlock;
    },
    destroy: () => {
      destroyed = true;
      workspace.destroy();
    },
  };
}

export type TransactionBlockTemplateAuthoring = ReturnType<
  typeof createTransactionBlockTemplateAuthoring
>;

export function createTransactionBlockTemplateRegistry({
  getModel,
  onChange,
  canModify,
  templateOptions,
}: {
  getModel: () => TxWorkflowFormModel;
  onChange: (model: TxWorkflowFormModel) => void;
  canModify: () => boolean;
  templateOptions?: TemplateOptions;
}) {
  const workspaces = new Map<string, TransactionBlockTemplateAuthoring>();
  function getWorkspace(
    block: TxWorkflowBlockFormModel,
  ): TransactionBlockTemplateAuthoring {
    let workspace = workspaces.get(block.editorId);
    if (!workspace) {
      const id = block.editorId;
      workspace = createTransactionBlockTemplateAuthoring({
        block,
        canModify,
        templateOptions,
        onChange: (nextBlock) => {
          const model = getModel();
          if (
            !canModify() ||
            !model.blocks.some((entry) => entry.editorId === id)
          )
            return;
          onChange({
            ...model,
            blocks: model.blocks.map((entry) =>
              entry.editorId === id ? nextBlock : entry,
            ),
          });
        },
      });
      workspaces.set(id, workspace);
    }
    return workspace;
  }
  return {
    getWorkspace,
    sync: (model: TxWorkflowFormModel) => {
      for (const [id, workspace] of workspaces) {
        const block = model.blocks.find((entry) => entry.editorId === id);
        if (block) workspace.setBlockContext(block);
        else {
          workspace.destroy();
          workspaces.delete(id);
        }
      }
    },
    destroy: () => {
      for (const workspace of workspaces.values()) workspace.destroy();
      workspaces.clear();
    },
  };
}
