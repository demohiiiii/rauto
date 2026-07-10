<script>
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button/index.js";
  import JsonObjectFieldsEditor from "../../components/fragments/JsonObjectFieldsEditor.svelte";
  import PlainInputField from "../../components/fragments/PlainInputField.svelte";
  import PlainTextAreaField from "../../components/fragments/PlainTextAreaField.svelte";
  import PresenceToggle from "../../components/fragments/PresenceToggle.svelte";
  import StringSelectField from "../../components/fragments/StringSelectField.svelte";
  import { t } from "../../lib/i18n.js";
  import { valueEditorPresentation } from "../../lib/objectFields.js";
  import { createTxBlockTemplateRuntimeVarsEditorWorkspace } from "../../modules/transactionBlockTemplateWorkspaces.js";

  let { operation, templateDisplay, onChange, jsonValueTypeRows } = $props();
  const txBlockTemplateRuntimeVarsEditorWorkspace =
    createTxBlockTemplateRuntimeVarsEditorWorkspace();
  const {
    runtimeVarActionHandlersStateStore,
    runtimeVarRowsStateStore,
    runtimeVarsPresentStateStore,
    setTemplateRuntimeVarsContext,
  } = txBlockTemplateRuntimeVarsEditorWorkspace;
  let runtimeVarActionHandlers = $derived($runtimeVarActionHandlersStateStore);
  let runtimeVarRows = $derived($runtimeVarRowsStateStore);
  let runtimeVarsPresent = $derived($runtimeVarsPresentStateStore);

  $effect(() => {
    setTemplateRuntimeVarsContext({ operation, onChange });
  });
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>
      <div class="flex flex-wrap items-center gap-3">
        <span>{t("txBlockFormRuntimeVars")}</span>
        <PresenceToggle
          checked={runtimeVarsPresent}
          onChange={runtimeVarActionHandlers.runtimeVarsPresenceHandler()}
        />
      </div>
    </Card.Title>
    <Card.Action>
      <Button
        variant="outline"
        size="sm"
        type="button"
        onclick={runtimeVarActionHandlers.addRuntimeVar}
      >
        {t("txBlockFormAddVar")}
      </Button>
    </Card.Action>
  </Card.Header>
  {#if runtimeVarsPresent}
    <Card.Content class="grid gap-2">
      {#each runtimeVarRows as runtimeVarRow}
        {@const runtimeVarEditorDisplay = valueEditorPresentation(
          runtimeVarRow.typeValue,
          runtimeVarRow.valueText,
        )}
        <div class="grid gap-2 md:grid-cols-[1fr_minmax(0,2fr)_auto]">
          <PlainInputField
            class="font-mono"
            placeholderText={t("txBlockFormNamePlaceholder")}
            value={runtimeVarRow.keyText}
            onInput={runtimeVarActionHandlers.runtimeVarKeyHandler(
              runtimeVarRow.keyText,
            )}
          />
          <div class="grid gap-2 md:grid-cols-[8rem_1fr]">
            <StringSelectField
              value={runtimeVarEditorDisplay.typeValue}
              optionValues={jsonValueTypeRows}
              onChange={runtimeVarActionHandlers.runtimeVarTypeHandler(
                runtimeVarRow.keyText,
              )}
            />
            {#if runtimeVarEditorDisplay.showObjectEditor}
              <JsonObjectFieldsEditor
                title={runtimeVarRow.keyText}
                source={runtimeVarEditorDisplay.objectSource}
                typeRows={jsonValueTypeRows}
                onChange={runtimeVarActionHandlers.runtimeVarObjectValueHandler(
                  runtimeVarRow.keyText,
                )}
              />
            {:else if runtimeVarEditorDisplay.editorKind === "textarea"}
              <PlainTextAreaField
                class="min-h-28 font-mono"
                value={runtimeVarEditorDisplay.valueText}
                title={runtimeVarEditorDisplay.valueText}
                onInput={runtimeVarActionHandlers.runtimeVarValueHandler(
                  runtimeVarRow.keyText,
                )}
                disabled={runtimeVarEditorDisplay.disabled}
              />
            {:else}
              <PlainInputField
                class="font-mono"
                value={runtimeVarEditorDisplay.valueText}
                onInput={runtimeVarActionHandlers.runtimeVarValueHandler(
                  runtimeVarRow.keyText,
                )}
                disabled={runtimeVarEditorDisplay.disabled}
              />
            {/if}
          </div>
          <Button
            variant="destructive"
            size="xs"
            type="button"
            onclick={runtimeVarActionHandlers.removeRuntimeVarHandler(
              runtimeVarRow.keyText,
            )}
          >
            {t("deleteBtn")}
          </Button>
        </div>
      {/each}
    </Card.Content>
  {/if}
</Card.Root>
