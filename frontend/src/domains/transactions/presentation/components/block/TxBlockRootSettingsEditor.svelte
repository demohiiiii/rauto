<script lang="ts">
  import ListChecksIcon from "@lucide/svelte/icons/list-checks";
  import PresenceFieldGrid from "$components/fragments/PresenceFieldGrid.svelte";
  import { t } from "$lib/i18n.js";
  import TxFormSection from "$domains/transactions/presentation/components/shared/TxFormSection.svelte";
  import type {
    PresenceFieldPresenceHandlerForKey,
    PresenceFieldRow,
    PresenceFieldValueHandlerForKey,
  } from "$components/fragments/presenceFieldTypes.js";

  interface Props {
    fieldRows?: PresenceFieldRow[];
    onPresenceChange?: PresenceFieldPresenceHandlerForKey | null;
    onValueChange?: PresenceFieldValueHandlerForKey | null;
  }

  let { fieldRows = [], onValueChange, onPresenceChange }: Props = $props();
</script>

<TxFormSection
  icon={ListChecksIcon}
  title={t("txBlockFormBasicsSection")}
  description={t("txBlockFormBasicsHint")}
>
  <PresenceFieldGrid
    {fieldRows}
    valueHandlerMode="event"
    hostClass="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3"
    presenceControlsMode="hidden"
    onValueChangeForKey={onValueChange}
    onPresenceChangeForKey={onPresenceChange}
  />
</TxFormSection>
