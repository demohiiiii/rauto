<script lang="ts">
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { currentLanguageState, t } from "$lib/i18n.js";

  interface Props {
    checked: boolean;
    onCheckedChange: (value: boolean) => unknown;
  }

  let { checked, onCheckedChange }: Props = $props();
  let label = $derived.by(() => {
    $currentLanguageState;
    return t("autoDownloadCommandOutput");
  });
</script>

<div
  class="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-4"
>
  <span class="min-w-0 text-sm font-medium text-foreground">{label}</span>
  <Switch class="shrink-0" aria-label={label} {checked} {onCheckedChange} />
</div>
