<script lang="ts">
  import { detailFieldCardDisplay } from "../../lib/ui.js";

  interface DetailFieldCardProps {
    badgeClass?: string;
    class?: string;
    detailValue?: string;
    label?: string;
    labelClass?: string;
    mono?: boolean;
    valueClass?: string;
    variant?: string;
  }

  let {
    badgeClass,
    class: extraClass,
    detailValue,
    label,
    labelClass,
    mono,
    valueClass,
    variant,
  }: DetailFieldCardProps = $props();
  let detailFieldDisplay = $derived(
    detailFieldCardDisplay({
      badgeClass,
      extraClass,
      labelClass,
      mono,
      value: detailValue,
      valueClass,
      variant,
    }),
  );
</script>

{#if detailFieldDisplay.showInline}
  <div class={detailFieldDisplay.cardClass}>
    <span class={detailFieldDisplay.labelClass}>{label}:</span>
    <span class={detailFieldDisplay.valueClass}>
      {detailFieldDisplay.valueText}
    </span>
  </div>
{:else}
  <div class={detailFieldDisplay.cardClass}>
    <div class={detailFieldDisplay.labelClass}>{label}</div>
    {#if detailFieldDisplay.showBadge}
      <div class="mt-1">
        <span class={detailFieldDisplay.badgeClass}>
          {detailFieldDisplay.valueText}
        </span>
      </div>
    {:else}
      <div class={detailFieldDisplay.valueClass}>
        {detailFieldDisplay.valueText}
      </div>
    {/if}
  </div>
{/if}
