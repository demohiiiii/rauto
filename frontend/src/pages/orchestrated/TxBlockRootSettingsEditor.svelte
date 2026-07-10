<script>
  import ListChecksIcon from "@lucide/svelte/icons/list-checks";
  import PresenceFieldGrid from "../../components/fragments/PresenceFieldGrid.svelte";
  import { t } from "../../lib/i18n.js";
  import TxFormSection from "./TxFormSection.svelte";

  let {
    fieldRows = [],
    metadataFieldRows = [],
    onValueChange,
    onPresenceChange,
    onMetadataValueChange,
    onMetadataPresenceChange,
  } = $props();
</script>

<TxFormSection
  icon={ListChecksIcon}
  title={t("txBlockFormBasicsSection")}
  description={t("txBlockFormBasicsHint")}
>
  <PresenceFieldGrid
    {fieldRows}
    hostClass="grid gap-3 md:grid-cols-2"
    presenceControlsMode="advanced"
    onValueChangeForKey={onValueChange}
    onPresenceChangeForKey={onPresenceChange}
  />
  <PresenceFieldGrid
    fieldRows={metadataFieldRows}
    hostClass="grid gap-3 md:grid-cols-2"
    presenceControlsMode="advanced"
    onValueChangeForKey={onMetadataValueChange}
    onPresenceChangeForKey={onMetadataPresenceChange}
  />
</TxFormSection>
