<script lang="ts">
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import { t } from "$lib/i18n.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { textAreaFieldBindings } from "../../lib/events.js";
  import type { HTMLTextareaAttributes } from "svelte/elements";

  interface PlainTextAreaFieldProps {
    "aria-label"?: string;
    class?: string;
    disabled?: boolean;
    loading?: boolean;
    hidden?: boolean;
    id?: string;
    onInput?: HTMLTextareaAttributes["oninput"];
    onValueInput?: (value: string) => void;
    placeholderText?: string;
    readonly?: boolean;
    rows?: number;
    title?: string;
    value?: HTMLTextareaAttributes["value"];
  }

  let {
    value = "",
    id = undefined,
    placeholderText = "",
    "aria-label": ariaLabel = "",
    class: fieldClass = undefined,
    disabled = false,
    loading = undefined,
    hidden = false,
    readonly = false,
    rows = undefined,
    title = "",
    onInput,
    onValueInput,
  }: PlainTextAreaFieldProps = $props();
  let areaBindings = $derived(textAreaFieldBindings({ onInput, onValueInput }));
</script>

{#snippet textarea()}
  <Textarea
    {id}
    class={[fieldClass, loading !== undefined && "pr-9"]}
    aria-label={ariaLabel || title || placeholderText}
    aria-busy={loading || undefined}
    placeholder={placeholderText}
    {value}
    {title}
    {disabled}
    {hidden}
    {readonly}
    {rows}
    oninput={areaBindings.inputHandler}
  />
{/snippet}

{#if loading !== undefined}
  <div class="relative min-w-0" {hidden}>
    {@render textarea()}
    {#if loading}
      <span
        role="status"
        aria-label={t("loading")}
        class="pointer-events-none absolute right-3 bottom-2 flex size-5 items-center justify-center rounded-full bg-background text-primary"
      >
        <LoaderCircleIcon
          class="size-3.5 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      </span>
    {/if}
  </div>
{:else}
  {@render textarea()}
{/if}
