<script>
  import CopyPlusIcon from "@lucide/svelte/icons/copy-plus";
  import FilePlusIcon from "@lucide/svelte/icons/file-plus";
  import SaveIcon from "@lucide/svelte/icons/save";
  import UploadIcon from "@lucide/svelte/icons/upload";
  import FilePickerButton from "./FilePickerButton.svelte";
  import LoadingButton from "./LoadingButton.svelte";
  import { t } from "../../lib/i18n.js";

  let {
    accept = ".json,application/json",
    busy = false,
    canSave = false,
    loadingAction = "",
    onImport,
    onNew,
    onSave,
    onSaveAs,
  } = $props();
</script>

<LoadingButton
  variant="primary-outline"
  size="sm"
  loading={loadingAction === "new"}
  disabled={busy}
  title={t("orchestrationTemplateNew")}
  onclick={onNew}
>
  <FilePlusIcon data-icon="inline-start" />
  <span>{t("orchestrationTemplateNew")}</span>
</LoadingButton>
<LoadingButton
  variant="primary-outline"
  size="sm"
  loading={loadingAction === "save"}
  disabled={busy || !canSave}
  title={t("orchestrationTemplateSave")}
  onclick={onSave}
>
  <SaveIcon data-icon="inline-start" />
  <span>{t("orchestrationTemplateSave")}</span>
</LoadingButton>
<LoadingButton
  variant="primary-outline"
  size="sm"
  loading={loadingAction === "save_as"}
  disabled={busy}
  title={t("orchestrationTemplateSaveAs")}
  onclick={onSaveAs}
>
  <CopyPlusIcon data-icon="inline-start" />
  <span>{t("orchestrationTemplateSaveAs")}</span>
</LoadingButton>
<FilePickerButton
  variant="primary-outline"
  size="sm"
  {accept}
  disabled={busy}
  title={t("orchestrationImportFileBtn")}
  aria-label={t("orchestrationImportFileBtn")}
  onFile={onImport}
>
  <UploadIcon data-icon="inline-start" />
  <span>{t("orchestrationImportFileBtn")}</span>
</FilePickerButton>
