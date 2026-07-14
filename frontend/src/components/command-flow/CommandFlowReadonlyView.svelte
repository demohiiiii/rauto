<script>
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { currentLanguageState } from "../../lib/i18n.js";
  import { commandFlowReadonlyPresentation } from "../../modules/commandFlowReadonlyState.js";

  let { model = {} } = $props();
  let currentLanguage = $derived($currentLanguageState);
  let display = $derived.by(() => {
    currentLanguage;
    return commandFlowReadonlyPresentation(model);
  });
</script>

<div class="grid min-w-0 gap-4 px-4 py-5 sm:px-6">
  <div class="grid min-w-0 gap-1">
    <span class="text-xs font-medium text-muted-foreground">
      {display.nameLabelText}
    </span>
    <span class="break-all font-mono text-sm font-semibold text-foreground">
      {display.nameText}
    </span>
  </div>

  <div class="grid min-w-0 gap-2 sm:grid-cols-3">
    {#each display.summaryRows as summaryRow}
      <div class="grid gap-1 rounded-lg border border-border bg-muted/30 p-3">
        <span class="text-xs text-muted-foreground">
          {summaryRow.labelText}
        </span>
        <span class="break-all text-sm font-semibold text-foreground">
          {summaryRow.valueText}
        </span>
      </div>
    {/each}
  </div>

  <section class="grid min-w-0 gap-3">
    <h3 class="text-sm font-semibold text-foreground">
      {display.stepsTitleText}
    </h3>

    {#if display.hasSteps}
      {#each display.stepRows as stepRow}
        <section
          class="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-3"
        >
          <div
            class="flex min-w-0 flex-wrap items-center justify-between gap-2"
          >
            <span class="text-sm font-semibold text-foreground">
              {stepRow.titleText}
            </span>
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant="outline">
                {stepRow.modeLabelText}: {stepRow.modeText}
              </Badge>
              <Badge variant="secondary">
                {stepRow.timeoutLabelText}: {stepRow.timeoutText}
              </Badge>
            </div>
          </div>

          <div class="grid min-w-0 gap-1 rounded-lg bg-muted/30 p-3">
            <span class="text-xs font-medium text-muted-foreground">
              {stepRow.commandLabelText}
            </span>
            <code class="break-all whitespace-pre-wrap text-sm text-foreground">
              {stepRow.commandText || "-"}
            </code>
          </div>

          {#if stepRow.promptRows.length > 0}
            <div class="grid min-w-0 gap-2 border-t border-border pt-3">
              {#each stepRow.promptRows as promptRow}
                <div class="grid min-w-0 gap-3 rounded-lg bg-muted/20 p-3">
                  <span class="text-xs font-semibold text-muted-foreground">
                    {promptRow.titleText}
                  </span>
                  <div class="grid min-w-0 gap-3 md:grid-cols-2">
                    <div class="grid min-w-0 gap-1">
                      <span class="text-xs text-muted-foreground">
                        {promptRow.patternsLabelText}
                      </span>
                      <div class="grid min-w-0 gap-1">
                        {#each promptRow.patternRows as patternText}
                          <code
                            class="break-all rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
                          >
                            {patternText || "-"}
                          </code>
                        {/each}
                      </div>
                    </div>
                    <div class="grid min-w-0 gap-1">
                      <span class="text-xs text-muted-foreground">
                        {promptRow.responseLabelText}
                      </span>
                      <code
                        class="break-all whitespace-pre-wrap rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
                      >
                        {promptRow.responseText || "-"}
                      </code>
                    </div>
                  </div>
                  <div class="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {promptRow.appendNewlineLabelText}:
                      {promptRow.appendNewlineText}
                    </Badge>
                    <Badge variant="outline">
                      {promptRow.recordInputLabelText}:
                      {promptRow.recordInputText}
                    </Badge>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    {:else}
      <div
        class="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground"
      >
        {display.emptyText}
      </div>
    {/if}
  </section>
</div>
