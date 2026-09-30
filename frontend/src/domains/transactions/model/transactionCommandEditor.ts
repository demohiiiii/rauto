import {
  defaultInteractiveTemplatePromptModel,
  type InteractiveCommandModel,
  type InteractiveTemplatePromptModel,
} from "$domains/command/index.js";
import type {
  JsonObject,
  TxCommandModel,
  TxOperationModel,
  TransactionOperationEditorKind,
} from "./types.js";

export type { TransactionOperationEditorKind } from "./types.js";

export function transactionOperationEditorKind(
  operation: TxOperationModel,
): TransactionOperationEditorKind {
  if (operation.kind === "flow") return "interactive";
  return (
    operation.commandEditorKind ??
    (operation.command.interaction.prompts.length > 0
      ? "interactive"
      : "command")
  );
}

export function changeTransactionOperationEditorKind(
  operation: TxOperationModel,
  kind: TransactionOperationEditorKind,
): TxOperationModel {
  const next = structuredClone(operation);
  if (kind === transactionOperationEditorKind(operation)) return next;
  if (kind === "interactive") {
    if (next.interactionDraft) {
      next.command.interaction = next.interactionDraft;
      delete next.interactionDraft;
    }
    next.command.hasInteraction = true;
  } else {
    if (next.kind === "flow" && next.flow.steps[0]) {
      next.command = structuredClone(next.flow.steps[0]);
    }
    next.interactionDraft = next.command.interaction;
    next.command.interaction = { prompts: [], hasPrompts: false, extra: {} };
    next.command.hasInteraction = false;
  }
  next.commandEditorKind = kind;
  next.kind = "command";
  return next;
}

export interface TransactionEditorPrompt extends InteractiveTemplatePromptModel {
  extra: JsonObject;
}

export function createTransactionEditorPrompt(): TransactionEditorPrompt {
  return { ...defaultInteractiveTemplatePromptModel(), extra: {} };
}

export function transactionCommandEditorModel(
  command: TxCommandModel,
): InteractiveCommandModel<TransactionEditorPrompt> {
  return {
    command: command.command,
    mode: command.mode,
    hasMode: true,
    multilineMode: command.multilineMode,
    timeoutSecs: command.timeout,
    hasTimeoutSecs: command.timeout !== null,
    prompts: command.interaction.prompts.map((prompt) => ({
      patterns: [...prompt.patterns],
      // Runtime responses already contain the newline; the shared editor exposes it as a switch.
      response: prompt.response.endsWith("\n")
        ? prompt.response.slice(0, -1)
        : prompt.response,
      appendNewline: prompt.response.endsWith("\n"),
      recordInput: prompt.recordInput,
      extra: prompt.extra,
    })),
  };
}

export function transactionCommandFromEditor(
  command: TxCommandModel,
  editor: InteractiveCommandModel<TransactionEditorPrompt>,
): TxCommandModel {
  return {
    ...command,
    command: editor.command,
    mode: editor.mode ?? command.mode,
    multilineMode: editor.multilineMode,
    timeout: editor.hasTimeoutSecs ? editor.timeoutSecs : null,
    hasTimeout: editor.hasTimeoutSecs,
    hasInteraction: command.hasInteraction || editor.prompts.length > 0,
    interaction: {
      ...command.interaction,
      hasPrompts: true,
      prompts: editor.prompts.map((prompt) => ({
        patterns: [...prompt.patterns],
        response: prompt.response + (prompt.appendNewline ? "\n" : ""),
        recordInput: prompt.recordInput,
        hasRecordInput: true,
        extra: prompt.extra,
      })),
    },
  };
}
