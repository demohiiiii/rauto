<script>
  import { Button } from "$lib/components/ui/button/index.js";
  import { formValueHandler } from "../../lib/events.js";
  import PlainInputField from "../fragments/PlainInputField.svelte";
  import StatusCard from "../fragments/StatusCard.svelte";
  import { createDashboardAgentAuthPanelWorkspace } from "../../modules/dashboardShell.js";
  const dashboardAgentAuthPanelWorkspace =
    createDashboardAgentAuthPanelWorkspace();
  const {
    agentAuthDisplayStateStore,
    agentTokenKeydownHandler,
    agentTokenStateStore,
    clearAgentTokenState,
    destroy,
    saveAgentTokenState,
    setAgentToken,
    setPanelContext,
  } = dashboardAgentAuthPanelWorkspace;
  let agentToken = $derived($agentTokenStateStore);
  let agentAuthDisplay = $derived($agentAuthDisplayStateStore);
  const agentTokenInputHandler = formValueHandler((tokenValue) =>
    setAgentToken(tokenValue),
  );

  $effect(() => {
    setPanelContext({
      managedAgentMode: agentAuthDisplay.managedAgentMode,
    });
  });

  $effect(() => {
    return () => {
      destroy();
    };
  });
</script>

{#if !agentAuthDisplay.hidden}
  <div class="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
    <div
      class="grid gap-3 lg:grid-cols-[1fr_minmax(320px,460px)] lg:items-start"
    >
      <div>
        <h2 class="text-sm font-semibold text-slate-900">
          {agentAuthDisplay.title}
        </h2>
        <p class="mt-1 text-xs text-slate-600">
          {agentAuthDisplay.hint}
        </p>
      </div>
      <div class="grid gap-2">
        <PlainInputField
          value={agentToken}
          type="password"
          aria-label={agentAuthDisplay.inputAriaLabel}
          placeholderText={agentAuthDisplay.inputPlaceholder}
          autocomplete="off"
          onInput={agentTokenInputHandler}
          onKeydown={agentTokenKeydownHandler}
        />
        <div class="inline-flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="default"
            size="sm"
            type="button"
            onclick={saveAgentTokenState}
          >
            {agentAuthDisplay.saveButtonLabel}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            type="button"
            onclick={clearAgentTokenState}
          >
            {agentAuthDisplay.clearButtonLabel}
          </Button>
        </div>
      </div>
    </div>
    {#if agentAuthDisplay.showStatus}
      <div class="mt-3">
        <StatusCard
          message={agentAuthDisplay.statusMessage}
          tone={agentAuthDisplay.statusTone}
          variant="alert"
        />
      </div>
    {/if}
  </div>
{/if}
