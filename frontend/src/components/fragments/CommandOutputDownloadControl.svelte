<script lang="ts">
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { currentLanguageState, t } from "$lib/i18n.js";

  interface Props {
    checked: boolean;
    onCheckedChange: (value: boolean) => unknown;
  }

  let { checked, onCheckedChange }: Props = $props();
  const switchId = $props.id();
  let label = $derived.by(() => {
    $currentLanguageState;
    return t("autoDownloadCommandOutput");
  });
</script>

<div
  class="flex min-w-0 w-full items-center justify-between gap-3 py-1 sm:mr-2 sm:w-auto"
>
  <label
    for={switchId}
    class="min-w-0 cursor-pointer text-xs font-medium text-muted-foreground"
    >{label}</label
  >
  <Switch
    id={switchId}
    class="shrink-0"
    aria-label={label}
    {checked}
    {onCheckedChange}
  />
</div>
