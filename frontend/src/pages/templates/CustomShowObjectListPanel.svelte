<script>
  import { callbackHandler } from "../../lib/events.js";
  import DetailFieldCard from "../../components/fragments/DetailFieldCard.svelte";
  import StatusCard from "../../components/fragments/StatusCard.svelte";

  let { listSectionDisplay, onSelectItem } = $props();
</script>

<div class="grid gap-2">
  <div class="grid gap-2">
    <div class="text-xs leading-relaxed text-slate-500">
      {listSectionDisplay.hintText}
    </div>

    {#if !listSectionDisplay.list.hasItems}
      <StatusCard
        message={listSectionDisplay.list.emptyStatus.message}
        tone={listSectionDisplay.list.emptyStatus.tone}
      />
    {:else}
      {#each listSectionDisplay.list.customShowObjectRows as customShowObjectRow}
        <button
          type="button"
          class={customShowObjectRow.itemClass}
          onclick={callbackHandler(
            onSelectItem,
            customShowObjectRow.customObject,
          )}
        >
          <div class="grid gap-1">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-semibold text-slate-800">
                {customShowObjectRow.titleText}
              </span>
              <span class={customShowObjectRow.enabledClass}>
                {customShowObjectRow.enabledText}
              </span>
            </div>
            <div class="break-all font-mono text-xs text-slate-600">
              {customShowObjectRow.commandText}
            </div>
            <div class="grid gap-2 md:grid-cols-3">
              {#each customShowObjectRow.metaFields as metaField}
                <DetailFieldCard
                  detailValue={metaField.value}
                  label={metaField.label}
                  mono={metaField.mono}
                  variant="inline"
                  class="border-slate-200 bg-white/80 px-2 py-1"
                />
              {/each}
            </div>
          </div>
        </button>
      {/each}
    {/if}
  </div>

  {#if listSectionDisplay.status.show}
    <StatusCard
      message={listSectionDisplay.status.message}
      tone={listSectionDisplay.status.tone}
      variant="alert"
    />
  {/if}
</div>
