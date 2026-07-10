<script>
  import { currentLanguageState } from "../../lib/i18n.js";
  import { callbackHandler } from "../../lib/events.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { parsedOutputBlockFragmentDisplay } from "../../lib/ui.js";
  import OutputBlock from "./OutputBlock.svelte";
  import StatusCard from "./StatusCard.svelte";

  let { parsedOutputBlock, onExportExcel } = $props();
  let currentLanguage = $derived($currentLanguageState);
  let blockDisplay = $derived.by(() => {
    currentLanguage;
    return parsedOutputBlockFragmentDisplay(parsedOutputBlock);
  });
</script>

{#if blockDisplay.hasParsedOutput}
  <Card.Root class="mt-3 min-w-0 max-w-full gap-0 overflow-hidden py-0">
    <Card.Content class="min-w-0 max-w-full overflow-hidden p-4">
      <div class="grid gap-3">
        <div class="flex items-center justify-between gap-2">
          <div
            class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {blockDisplay.parsedOutputTitle}
          </div>
          <div class="flex items-center gap-2">
            {#if blockDisplay.canExport}
              <Button
                variant="outline"
                size="sm"
                type="button"
                onclick={callbackHandler(
                  onExportExcel,
                  blockDisplay.exportItem,
                )}
              >
                {blockDisplay.exportExcelText}
              </Button>
            {/if}
          </div>
        </div>

        {#if blockDisplay.showEmptyRows}
          <StatusCard
            message={blockDisplay.emptyRowsStatus.message}
            variant={blockDisplay.emptyRowsStatus.variant}
            class={blockDisplay.emptyRowsStatus.statusClass}
          />
        {:else if blockDisplay.showEmptyColumns}
          <StatusCard
            message={blockDisplay.emptyColumnsStatus.message}
            variant={blockDisplay.emptyColumnsStatus.variant}
            class={blockDisplay.emptyColumnsStatus.statusClass}
          />
        {:else if blockDisplay.showTable}
          <div
            class="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-primary/20 bg-card shadow-[0_18px_50px_-36px_color-mix(in_oklab,var(--primary)_45%,transparent)]"
          >
            <Table.Root class="min-w-full border-collapse text-sm">
              <Table.Header>
                <Table.Row class="bg-primary/5 hover:bg-primary/5">
                  {#each blockDisplay.tableColumns as parsedOutputColumn}
                    <Table.Head
                      class="h-auto min-w-40 border-b border-primary/15 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-primary/80"
                    >
                      {parsedOutputColumn}
                    </Table.Head>
                  {/each}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each blockDisplay.tableRows as parsedOutputRow, rowIndex}
                  <Table.Row
                    class={[
                      "border-t border-border transition-colors hover:bg-primary/8",
                      rowIndex % 2 === 1 && "bg-primary/3",
                    ]}
                  >
                    {#each parsedOutputRow.cells as parsedOutputCell}
                      <Table.Cell
                        class="min-w-40 px-4 py-3 align-top font-mono text-sm leading-6 text-muted-foreground"
                      >
                        <span
                          class="block max-w-[28rem] whitespace-pre-wrap break-words"
                        >
                          {parsedOutputCell}
                        </span>
                      </Table.Cell>
                    {/each}
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </div>
        {:else if blockDisplay.showJson}
          <OutputBlock>{blockDisplay.jsonOutput}</OutputBlock>
        {/if}
      </div>
    </Card.Content>
  </Card.Root>
{:else if blockDisplay.hasParseError}
  <StatusCard
    tone={blockDisplay.parseErrorStatus.tone}
    variant={blockDisplay.parseErrorStatus.variant}
    class={blockDisplay.parseErrorStatus.statusClass}
  >
    <div>
      <div class="font-semibold">
        {blockDisplay.parseErrorTitle}
      </div>
      <pre
        class={blockDisplay.parseErrorTextClass}>{blockDisplay.parseErrorText}</pre>
    </div>
  </StatusCard>
{/if}
