<script lang="ts">
  import TerminalIcon from "@lucide/svelte/icons/terminal";
  import Undo2Icon from "@lucide/svelte/icons/undo-2";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { renderedOperationCommands } from "../../../model/renderedWorkflow.js";
  import type { RenderedOperation } from "../../../model/renderedWorkflow.js";

  let {
    operation,
    rollback = false,
  }: { operation: RenderedOperation; rollback?: boolean } = $props();
  let commands = $derived(renderedOperationCommands(operation));
  function label(key: string): string {
    $currentLanguageState;
    return t(key);
  }
</script>

<section
  class={`min-w-0 overflow-hidden rounded-xl border ${rollback ? "border-amber-500/25 bg-amber-500/5" : "border-primary/20 bg-primary/5"}`}
>
  <div
    class={`flex items-center gap-2 border-b px-3 py-2 text-xs font-medium ${rollback ? "border-amber-500/15 text-amber-700 dark:text-amber-400" : "border-primary/15 text-primary"}`}
  >
    {#if rollback}<Undo2Icon class="size-3.5" />{:else}<TerminalIcon
        class="size-3.5"
      />{/if}
    {label(rollback ? "renderedCommandsRollback" : "renderedCommandsRun")}
  </div>
  <div class="divide-y divide-border/60">
    {#each commands as command}
      <div class="grid min-w-0 gap-2 p-3">
        <div
          class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"
        >
          <span
            class="rounded-md border border-border bg-background/70 px-1.5 py-0.5 font-mono text-foreground"
            >{command.mode}</span
          >
          <span
            >{label(
              command.multiline_mode === "whole"
                ? "commandMultilineModeWhole"
                : "commandMultilineModeSplitLines",
            )}</span
          >
        </div>
        <pre
          class="min-w-0 overflow-x-auto whitespace-pre font-mono text-xs leading-6 text-foreground"
          data-rendered-command>{command.command}</pre>
        {#if command.interaction.prompts.length > 0}
          <div
            class="grid gap-2 rounded-lg border border-border/60 bg-background/60 p-2.5"
          >
            <div class="text-[11px] font-medium text-muted-foreground">
              {label("renderedCommandsPrompts")}
            </div>
            {#each command.interaction.prompts as prompt}
              <div class="grid min-w-0 gap-1">
                <div
                  class="break-all font-mono text-[11px] text-muted-foreground"
                >
                  {prompt.patterns.join(" | ")}
                </div>
                <pre
                  class="overflow-x-auto whitespace-pre font-mono text-xs text-foreground">{JSON.stringify(
                    prompt.response,
                  )}</pre>
              </div>
            {/each}
          </div>
        {/if}
        {#if Object.entries(command.dyn_params).some(([, value]) => value !== null)}
          <dl
            class="grid gap-1 rounded-lg border border-border/60 bg-background/60 p-2.5 font-mono text-xs"
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
