<script lang="ts">
  import { getContext } from "svelte";
  import AlignLeftIcon from "@lucide/svelte/icons/align-left";
  import JsonTextEditor from "$components/fragments/JsonTextEditor.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { currentLanguageState, t } from "$lib/i18n.js";
  import { readonlyFieldsContextKey } from "$lib/svelte.js";
  import { runtimeVariablesJsonState } from "../../../model/runtimeVariablesJson.js";

  interface Props {
    active?: boolean;
    "aria-label": string;
    compact?: boolean;
    fill?: boolean;
    error?: string;
    onChange: (text: string) => void;
    placeholder?: string;
    readonly?: boolean;
    value: string;
  }

  let {
    active = true,
    "aria-label": ariaLabel,
    compact = false,
    fill = false,
    error = "",
    onChange,
    placeholder,
    readonly = false,
    value,
  }: Props = $props();

  const inheritedReadonly = getContext<(() => boolean) | undefined>(
    readonlyFieldsContextKey,
  );
  let editorReadonly = $derived(readonly || !!inheritedReadonly?.());
  let jsonState = $derived(runtimeVariablesJsonState(value));
  let diagnostic = $derived(
    editorReadonly && error
      ? { message: error, line: 1, column: 1 }
      : jsonState.error ||
          (error ? { message: error, line: 1, column: 1 } : null),
  );

  function formatJson(): void {
    if (editorReadonly || jsonState.formattedText === null) return;
    onChange(jsonState.formattedText);
  }

  function label(key: string): string {
    $currentLanguageState;
    return t(key);
  }
</script>

<div class={fill ? "flex h-full min-h-0 flex-col gap-2" : "grid min-w-0 gap-2"}>
  <div class="flex min-w-0 justify-end">
    <Button
      variant="ghost"
      size="xs"
      class="text-muted-foreground hover:text-primary"
      disabled={editorReadonly || jsonState.formattedText === null}
      onclick={formatJson}
    >
      <AlignLeftIcon class="size-3.5" />
      {label("txVarsFormatJson")}
    </Button>
  </div>
  <div class={fill ? "min-h-0 flex-1" : "min-w-0"}>
    <JsonTextEditor
      {active}
      {compact}
      {fill}
      readonly={editorReadonly}
      immediate
      aria-label={ariaLabel}
      {value}
      {placeholder}
      {onChange}
      {diagnostic}
    />
  </div>
</div>
