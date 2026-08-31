<script lang="ts">
  import { summaryMetricCardDisplay } from "../../lib/ui.js";

  interface SummaryMetricCardProps {
    class?: string;
    label?: string;
    labelClass?: string;
    metricValue?: unknown;
    metricValueClass?: string;
    mono?: boolean;
    size?: string;
  }

  let {
    class: extraClass,
    label,
    labelClass,
    metricValue,
    metricValueClass,
    mono,
    size,
  }: SummaryMetricCardProps = $props();
  let cardDisplay = $derived(
    summaryMetricCardDisplay({
      extraClass,
      labelClass,
      metricValueClass,
      mono,
      size,
    }),
  );
</script>

<div class={cardDisplay.cardClass}>
  <div class={cardDisplay.labelClassText}>{label}</div>
  <div class={cardDisplay.valueClassText}>{metricValue}</div>
</div>
