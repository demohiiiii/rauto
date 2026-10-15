<script lang="ts">
  import { onDestroy } from "svelte";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import MonitorIcon from "@lucide/svelte/icons/monitor";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import LoadingButton from "$components/fragments/LoadingButton.svelte";
  import StatusCard from "$components/fragments/StatusCard.svelte";
  import {
    connectionPayload,
    connectionTargetState,
  } from "$domains/connections/index.js";
  import { TX_VARS, txVarsTextStateFor } from "$domains/transactions/index.js";
  import RenderedWorkflowCommands from "$domains/transactions/presentation/components/workflow/RenderedWorkflowCommands.svelte";
  import { createExecutionCommandPreviewWorkspace } from "../../../application/executionCommandPreviewWorkspace.js";
  import type { ExecutionCommandPreviewInput } from "../../../application/executionCommandPreviewWorkspace.js";
  import {
    executeTxWorkflow,
    executeOrchestration,
  } from "../../../infrastructure/orchestrationExecutionApi.js";

  let {
    feature,
    sourceText,
    active = true,
    disabled = false,
  }: {
    feature: ExecutionCommandPreviewInput["feature"];
    sourceText: string;
    active?: boolean;
    disabled?: boolean;
  } = $props();
  const workspace = createExecutionCommandPreviewWorkspace({
    executeTxWorkflow,
    executeOrchestration,
  });
  const { state: previewState } = workspace;
  let varsState = $derived(
    txVarsTextStateFor(
      feature === "tx-workflow"
        ? TX_VARS.txWorkflowDirect
        : TX_VARS.orchestrationDirect,
    ),
  );
  let input = $derived.by<ExecutionCommandPreviewInput>(() => {
    $connectionTargetState;
    let connection: ExecutionCommandPreviewInput["connection"];
    try {
      connection = connectionPayload();
    } catch {
      connection = undefined;
    }
    return { feature, sourceText, varsText: $varsState.raw, connection };
  });
  let selectedIndex = $state(0);
  let view = $state<"commands" | "json">("commands");
  let selected = $derived(
    $previewState.entries[selectedIndex] ?? $previewState.entries[0],
  );
  $effect(() => {
    workspace.updateInput(input);
    if (!active) workspace.close();
  });
  onDestroy(workspace.destroy);

  function show(): void {
    selectedIndex = 0;
    view = "commands";
    void workspace.show(input);
  }
  function label(key: string): string {
    $currentLanguageState;
    return t(key);
  }
</script>

<LoadingButton
  variant="outline"
  size="lg"
  loading={$previewState.loading}
  {disabled}
  onclick={show}
>
  {#if !$previewState.loading}<EyeIcon data-icon="inline-start" />{/if}{label(
    "renderedCommandsPreview",
  )}
</LoadingButton>

<Dialog.Root
  open={$previewState.open}
  onOpenChange={(open) => {
    if (!open) workspace.close();
  }}
>
  <Dialog.Content
    class="flex h-[min(90dvh,58rem)] max-h-[90dvh] w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden border-border bg-card p-0 shadow-2xl sm:max-w-6xl"
  >
    <Dialog.Header
      class="shrink-0 border-b border-border bg-muted/15 px-4 py-4 pr-14 sm:px-5"
    >
      <div class="flex items-center gap-3 text-left">
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          ><EyeIcon class="size-4" /></span
        >
        <div class="min-w-0">
          <Dialog.Title>{label("renderedCommandsTitle")}</Dialog.Title
          ><Dialog.Description
            >{label("renderedCommandsHint")}</Dialog.Description
          >
        </div>
      </div>
    </Dialog.Header>
    <div
      class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5"
    >
      <div
        class="flex gap-1 rounded-lg bg-muted/60 p-1"
        role="group"
        aria-label={label("renderedCommandsView")}
      >
        <Button
          size="sm"
          variant={view === "commands" ? "secondary" : "ghost"}
          aria-pressed={view === "commands"}
          onclick={() => {
            view = "commands";
          }}>{label("renderedCommandsView")}</Button
        >
        <Button
          size="sm"
          variant={view === "json" ? "secondary" : "ghost"}
          aria-pressed={view === "json"}
          onclick={() => {
            view = "json";
          }}>{label("renderedCommandsJson")}</Button
        >
      </div>
      <LoadingButton
        variant="ghost"
        loading={$previewState.loading}
        onclick={() => {
          selectedIndex = 0;
          void workspace.refresh();
        }}
      >
        {#if !$previewState.loading}<RefreshCwIcon
            class="size-3.5"
          />{/if}{label("renderedCommandsRefresh")}
      </LoadingButton>
    </div>
    {#if $previewState.loading}
      <div
        class="flex min-h-0 flex-1 items-center justify-center gap-3 text-sm text-muted-foreground"
        role="status"
      >
        <Spinner class="size-5" />{label("renderedCommandsLoading")}
      </div>
    {:else if $previewState.error || $previewState.stale}
      <div class="p-5" role="status">
        <StatusCard
          message={$previewState.error || label("renderedCommandsStale")}
          tone={$previewState.error ? "error" : "info"}
        />
      </div>
    {:else if selected}
      <div class="flex min-h-0 flex-1 flex-col md:flex-row">
        {#if feature === "orchestrate"}
          <nav
            class="max-h-36 shrink-0 overflow-y-auto border-b border-border bg-muted/10 p-2 md:max-h-none md:w-64 md:border-r md:border-b-0"
            aria-label={label("renderedCommandsTargets")}
          >
            <div class="grid gap-1">
              {#each $previewState.entries as entry, index}
                <button
                  type="button"
                  aria-current={selectedIndex === index ? "true" : undefined}
                  class={`min-w-0 rounded-xl border px-3 py-2.5 text-left transition-colors ${selectedIndex === index ? "border-primary/20 bg-primary/10" : "border-transparent hover:bg-muted"}`}
                  onclick={() => {
                    selectedIndex = index;
                  }}
                >
                  <div class="mb-1 truncate text-[10px] text-muted-foreground">
                    {entry.stageName} / {entry.jobName}
                  </div>
                  <div
                    class="flex min-w-0 items-center gap-2 text-sm font-medium"
                  >
                    <MonitorIcon class="size-3.5 shrink-0 text-primary" /><span
                      class="truncate"
                      >{entry.connectionName || entry.host}</span
                    >
                  </div>
                  <div
                    class="mt-1 truncate pl-5 font-mono text-[11px] text-muted-foreground"
                  >
                    {entry.host}
                  </div>
                </button>
              {/each}
            </div>
          </nav>
        {/if}
        <div
          class="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5"
        >
          <div class="mb-5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h2 class="break-all text-sm font-semibold">
              {selected.workflow.name}
            </h2>
            <span class="break-all font-mono text-xs text-muted-foreground"
              >{selected.connectionName || selected.host}</span
            >
          </div>
          {#if view === "json"}<pre
              class="overflow-x-auto rounded-xl border border-border bg-muted/20 p-4 font-mono text-xs leading-6"
              data-rendered-json>{JSON.stringify(
                selected.workflow,
                null,
                2,
              )}</pre>
          {:else}<RenderedWorkflowCommands workflow={selected.workflow} />{/if}
        </div>
      </div>
    {:else}
      <p class="p-8 text-center text-sm text-muted-foreground">
        {label("renderedCommandsEmpty")}
      </p>
    {/if}
  </Dialog.Content>
</Dialog.Root>
