<script>
  import ListChecksIcon from "@lucide/svelte/icons/list-checks";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { t } from "../../lib/i18n.js";
  import TxFormSection from "./TxFormSection.svelte";

  let { fieldRows = [], onValueChange, onPresenceChange } = $props();
</script>

<TxFormSection
  icon={ListChecksIcon}
  title={t("txBlockFormBasicsSection")}
  description={t("txBlockFormBasicsHint")}
>
  <PresenceFieldGrid
    {fieldRows}
    valueHandlerMode="event"
    hostClass="grid gap-3 md:grid-cols-2"
    presenceControlsMode="hidden"
    onValueChangeForKey={onValueChange}
    onPresenceChangeForKey={onPresenceChange}
  />
</TxFormSection>
