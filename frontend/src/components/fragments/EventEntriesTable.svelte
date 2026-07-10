<script>
  import { eventEntriesTableBindings } from "../../lib/events.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import EventFlowCell from "./EventFlowCell.svelte";

  let { entryRows, onOpenEntryIndex, tableHeaderCells } = $props();
  let tableBindings = $derived(eventEntriesTableBindings({ onOpenEntryIndex }));
</script>

<div
  class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"
>
  <table class="min-w-[1320px] table-fixed text-sm">
    <thead class="bg-slate-100 text-xs font-semibold text-slate-600">
      <tr>
        {#each tableHeaderCells as eventHeaderCell}
          <th class="px-3 py-2 text-left">{eventHeaderCell.labelText}</th>
        {/each}
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-200">
      {#each entryRows as eventEntryRow}
        <tr class={eventEntryRow.rowClass}>
          <td class="whitespace-nowrap px-3 py-2 text-slate-500">
            {eventEntryRow.indexText}
          </td>
          <td class="px-3 py-2 font-medium text-slate-800">
            {eventEntryRow.kindText}
          </td>
          <td
            class="min-w-[320px] max-w-[420px] px-3 py-2 font-mono text-xs text-slate-700 break-all"
          >
            {eventEntryRow.commandText}
          </td>
          <td class="px-3 py-2 font-mono text-xs text-slate-700">
            {eventEntryRow.modeText}
          </td>
          <td class="px-3 py-2">
            {#if eventEntryRow.showSuccessEmpty}
              <span class="text-slate-400">-</span>
            {:else if eventEntryRow.showSuccessBadge}
              <span class={eventEntryRow.successBadgeClass}>
                {eventEntryRow.successLabelText}
              </span>
            {/if}
          </td>
          <td class="px-3 py-2">
            <EventFlowCell flow={eventEntryRow.promptFlow} />
          </td>
          <td class="px-3 py-2">
            <EventFlowCell flow={eventEntryRow.fsmPromptFlow} />
          </td>
          <td class="whitespace-nowrap px-3 py-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onclick={tableBindings.openEntryHandler(eventEntryRow.entryIndex)}
            >
              {eventEntryRow.detailButtonLabel}
            </Button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
