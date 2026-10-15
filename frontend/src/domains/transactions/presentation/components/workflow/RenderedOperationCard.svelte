<script lang="ts">
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { renderedOperationCommands } from "../../../model/renderedWorkflow.js";
  import type { RenderedOperation } from "../../../model/renderedWorkflow.js";

  let {
    operation,
    rollback = false,
    rollbackOnFailure = false,
  }: {
    operation: RenderedOperation;
    rollback?: boolean;
    rollbackOnFailure?: boolean;
  } = $props();
  let commands = $derived(renderedOperationCommands(operation));
  function label(key: string): string {
    $currentLanguageState;
    return t(key);
  }
</script>

<section class="min-w-0 flex-1">
  <div class="grid min-w-0 gap-2.5">
    {#each commands as command, commandIndex}
      <div class="grid min-w-0 gap-1.5">
        <div
          class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] leading-4 text-muted-foreground"
        >
          <span
            class={`rounded border px-1.5 font-mono ${rollback ? "border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400" : "border-primary/15 bg-primary/5 text-primary"}`}
            >{command.mode}</span
          >
          <span
            >{label(
              command.multiline_mode === "whole"
                ? "commandMultilineModeWhole"
                : "commandMultilineModeSplitLines",
            )}</span
          >
          {#if rollbackOnFailure && commandIndex === 0}
            <span class="text-amber-700 dark:text-amber-400"
              >{label("txBlockFormRollbackOnFailure")}</span
            >
          {/if}
        </div>
        <pre
          class="min-w-0 overflow-x-auto whitespace-pre font-mono text-xs leading-5 text-foreground"
          data-rendered-command>{command.command}</pre>
        {#if command.interaction.prompts.length > 0}
          <div
            class="mt-1 grid min-w-0 gap-1.5 border-l-2 border-border pl-2.5"
          >
            <div class="text-[10px] font-medium text-muted-foreground">
              {label("renderedCommandsPrompts")}
            </div>
            {#each command.interaction.prompts as prompt}
              <div class="grid min-w-0 gap-0.5">
                <div
                  class="break-all font-mono text-[11px] text-muted-foreground"
                >
                  {prompt.patterns.join(" | ")}
                </div>
                <pre
                  class="overflow-x-auto whitespace-pre font-mono text-[11px] text-foreground">{JSON.stringify(
                    prompt.response,
                  )}</pre>
              </div>
            {/each}
          </div>
        {/if}
        {#if Object.entries(command.dyn_params).some(([, value]) => value !== null)}
          <dl
            class="mt-1 grid min-w-0 gap-1 border-l-2 border-border pl-2.5 font-mono text-[11px]"
          >
            {#each Object.entries(command.dyn_params).filter(([, value]) => value !== null) as [key, value]}
              <div class="grid min-w-0 gap-1 sm:grid-cols-[auto_1fr] sm:gap-3">
                <dt class="text-muted-foreground">{key}</dt>
                <dd class="min-w-0 overflow-x-auto whitespace-pre">
                  {JSON.stringify(value)}
                </dd>
              </div>
            {/each}
          </dl>
        {/if}
      </div>
    {/each}
  </div>
</section>
