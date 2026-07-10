<script>
  import { summaryMetricCardDisplay } from "../../lib/ui.js";

  let {
    class: extraClass,
    label,
    labelClass,
    metricValue,
    metricValueClass,
    mono,
    size,
  } = $props();
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
