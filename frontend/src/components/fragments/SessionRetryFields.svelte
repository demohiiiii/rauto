<script>
  import AlertTriangleIcon from "@lucide/svelte/icons/triangle-alert";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { currentLanguageState, t } from "../../lib/i18n.js";
  import {
    normalizeSessionRetryState,
    sessionRetryValidation,
  } from "../../modules/operations/sessionRetry.js";

  let {
    value = {},
    idPrefix = "session-retry",
    disabled = false,
    onChange = null,
  } = $props();

  let currentLanguage = $derived($currentLanguageState);
  let state = $derived(normalizeSessionRetryState(value));
  let validation = $derived(sessionRetryValidation(state));
  let labels = $derived.by(() => {
    currentLanguage;
    return {
      authentication: t("sessionRetryAuthenticationLabel"),
      authenticationHint: t("sessionRetryAuthenticationHint"),
      initialBackoff: t("sessionRetryInitialBackoffLabel"),
      maxBackoff: t("sessionRetryMaxBackoffLabel"),
      maxRetries: t("sessionRetryMaxRetriesLabel"),
      risk: t("sessionRetryRiskHint"),
      serverDefault: t("sessionRetryServerDefaultHint"),
      title: t("sessionRetryOverrideLabel"),
    };
  });
  let errorMessage = $derived.by(() => {
    currentLanguage;
    return validation.errorKey ? t(validation.errorKey) : "";
  });

  function patch(patchValue) {
    onChange?.({ ...state, ...patchValue });
  }
</script>

<div
  class="@container/retry flex min-w-0 flex-col gap-3 rounded-md border border-border bg-background px-4 py-3"
>
  <div class="flex min-h-8 min-w-0 items-center justify-between gap-3">
    <div class="min-w-0">
      <Label class="text-sm font-medium" for={`${idPrefix}-enabled`}>
        {labels.title}
      </Label>
      {#if !state.enabled}
        <p class="text-xs text-muted-foreground">{labels.serverDefault}</p>
      {/if}
    </div>
    <Switch
      id={`${idPrefix}-enabled`}
      checked={state.enabled}
      {disabled}
      onCheckedChange={(enabled) => patch({ enabled })}
    />
  </div>

  {#if state.enabled}
    <div
      class="grid min-w-0 gap-3 @min-[17rem]/retry:grid-cols-2 @sm/retry:grid-cols-3"
    >
      <div
        class="flex min-w-0 flex-col gap-1.5 @min-[17rem]/retry:col-span-2 @sm/retry:col-span-1"
      >
        <Label for={`${idPrefix}-max-retries`}>{labels.maxRetries}</Label>
        <Input
          id={`${idPrefix}-max-retries`}
          type="number"
          min="0"
          max="20"
          step="1"
          value={state.maxRetries}
          {disabled}
          aria-invalid={!validation.valid}
          oninput={(event) => patch({ maxRetries: event.currentTarget.value })}
        />
      </div>
      <div class="flex min-w-0 flex-col gap-1.5">
        <Label for={`${idPrefix}-initial-backoff`}>
          {labels.initialBackoff}
        </Label>
        <Input
          id={`${idPrefix}-initial-backoff`}
          type="number"
          min="0"
          max="300000"
          step="1"
          value={state.initialBackoffMs}
          {disabled}
          aria-invalid={!validation.valid}
          oninput={(event) =>
            patch({ initialBackoffMs: event.currentTarget.value })}
        />
      </div>
      <div class="flex min-w-0 flex-col gap-1.5">
        <Label for={`${idPrefix}-max-backoff`}>{labels.maxBackoff}</Label>
        <Input
          id={`${idPrefix}-max-backoff`}
          type="number"
          min="0"
          max="300000"
          step="1"
          value={state.maxBackoffMs}
          {disabled}
          aria-invalid={!validation.valid}
          oninput={(event) =>
            patch({ maxBackoffMs: event.currentTarget.value })}
        />
      </div>
    </div>

    {#if errorMessage}
      <p class="text-xs text-destructive" role="alert">{errorMessage}</p>
    {/if}

    <div class="flex min-h-10 min-w-0 items-center justify-between gap-3">
      <div class="min-w-0">
        <Label class="text-sm font-medium" for={`${idPrefix}-authentication`}>
          {labels.authentication}
        </Label>
        <p class="text-xs text-muted-foreground">
          {labels.authenticationHint}
        </p>
      </div>
      <Switch
        id={`${idPrefix}-authentication`}
        checked={state.retryAuthenticationErrors}
        {disabled}
        onCheckedChange={(retryAuthenticationErrors) =>
          patch({ retryAuthenticationErrors })}
      />
    </div>

    <Alert.Root>
      <AlertTriangleIcon />
      <Alert.Description>{labels.risk}</Alert.Description>
    </Alert.Root>
  {/if}
</div>
