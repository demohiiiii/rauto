<script lang="ts" generics="T">
  import type { Snippet } from "svelte";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import {
    txWorkflowAddChoiceBranch,
    txWorkflowChangeChoiceBranch,
    txWorkflowMoveChoiceBranch,
    txWorkflowRemoveChoiceBranch,
  } from "../../../model/transactionWorkflowTree.js";
  import { t } from "$lib/i18n.js";
  import type { TxControlModel, TxChoiceModel } from "../../../model/types.js";

  let {
    control,
    canvasBody = false,
    readonly = false,
    onChange,
    renderBody,
  }: {
    control: TxControlModel<T>;
    canvasBody?: boolean;
    readonly?: boolean;
    onChange: (control: TxControlModel<T>) => void;
    renderBody: Snippet<[T[], (items: T[]) => void, number]>;
  } = $props();
  const id = $props.id();
  function changeText(
    field: "name" | "iterations" | "itemVariable",
    value: string,
  ): void {
    if (!readonly) onChange({ ...control, [field]: value });
  }
  function changeChoice(
    change: (choice: TxChoiceModel<T>) => TxChoiceModel<T>,
  ): void {
    if (!readonly && control.kind === "choice") onChange(change(control));
  }
</script>

<div class="grid min-w-0 gap-4" data-testid="tx-workflow-control-editor">
  {#if control.kind === "choice"}<div class="grid gap-1.5">
      <Label for={`${id}-name`}>{t("txWorkflowControlName")}</Label>
      <Input
        id={`${id}-name`}
        value={control.name}
        disabled={readonly}
        oninput={(event) => changeText("name", event.currentTarget.value)}
      />
    </div>{/if}
  {#if control.kind === "loop"}
    <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
      <div class="grid gap-1.5">
        <Label for={`${id}-iterations`}>{t("txWorkflowLoopIterations")}</Label>
        <Input
          id={`${id}-iterations`}
          value={control.iterations}
          disabled={readonly}
          oninput={(event) =>
            changeText("iterations", event.currentTarget.value)}
        />
      </div>
      <div class="grid gap-1.5">
        <Label for={`${id}-item`}>{t("txWorkflowLoopItem")}</Label>
        <Input
          id={`${id}-item`}
          value={control.itemVariable}
          disabled={readonly}
          oninput={(event) =>
            changeText("itemVariable", event.currentTarget.value)}
        />
      </div>
    </div>
    <p class="text-xs leading-5 text-muted-foreground">
      {t("txWorkflowLoopHint")}
    </p>
    {#if !canvasBody}{@render renderBody(
        control.blocks,
        (blocks) => {
          if (!readonly && control.kind === "loop")
            onChange({ ...control, blocks });
        },
        0,
      )}{/if}
  {:else}
    <p class="text-xs leading-5 text-muted-foreground">
      {t("txWorkflowChoiceHint")}
    </p>
    {#if !canvasBody}
      {#each control.branches as branch, index (branch.editorId)}
        <section
          class="grid min-w-0 gap-3 rounded-lg border border-orange-500/25 bg-orange-500/5 p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <Label for={`${id}-${branch.editorId}`}
              >{t("txWorkflowChoiceBranch").replace(
                "{index}",
                String(index + 1),
              )}</Label
            >
            <div class="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={readonly || index === 0}
                aria-label={t("txWorkflowChoiceMoveUp")}
                onclick={() =>
                  changeChoice((choice) =>
                    txWorkflowMoveChoiceBranch(choice, branch.editorId, -1),
                  )}><ArrowUpIcon /></Button
              >
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={readonly || index === control.branches.length - 1}
                aria-label={t("txWorkflowChoiceMoveDown")}
                onclick={() =>
                  changeChoice((choice) =>
                    txWorkflowMoveChoiceBranch(choice, branch.editorId, 1),
                  )}><ArrowDownIcon /></Button
              >
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={readonly || control.branches.length <= 1}
                aria-label={t("txWorkflowChoiceRemoveBranch")}
                class="text-destructive"
                onclick={() =>
                  changeChoice((choice) =>
                    txWorkflowRemoveChoiceBranch(choice, branch.editorId),
                  )}><Trash2Icon /></Button
              >
            </div>
          </div>
          <Input
            id={`${id}-${branch.editorId}`}
            value={branch.condition}
            disabled={readonly}
            aria-label={t("txWorkflowChoiceCondition")}
            oninput={(event) =>
              changeChoice((choice) =>
                txWorkflowChangeChoiceBranch(choice, branch.editorId, {
                  condition: event.currentTarget.value,
                }),
              )}
          />
          {@render renderBody(
            branch.blocks,
            (blocks) =>
              changeChoice((choice) =>
                txWorkflowChangeChoiceBranch(choice, branch.editorId, {
                  blocks,
                }),
              ),
            index,
          )}
        </section>
      {/each}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={readonly}
        onclick={() => changeChoice(txWorkflowAddChoiceBranch)}
        ><PlusIcon data-icon="inline-start" />{t(
          "txWorkflowChoiceAddBranch",
        )}</Button
      >
      <section
        class="grid min-w-0 gap-3 rounded-lg border border-border bg-muted/20 p-3"
      >
        <span class="text-xs font-medium">{t("txWorkflowChoiceElse")}</span>
        {@render renderBody(
          control.otherwise,
          (otherwise) => {
            if (!readonly && control.kind === "choice")
              onChange({ ...control, otherwise });
          },
          control.branches.length,
        )}
      </section>
    {/if}
  {/if}
  <p class="text-xs leading-5 text-muted-foreground">
    {t("txWorkflowControlTimingHint")}
  </p>
</div>
