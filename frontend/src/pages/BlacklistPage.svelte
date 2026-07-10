<script>
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button/index.js";
  import DashboardTabPanel from "../components/layout/DashboardTabPanel.svelte";
  import MiniActionButton from "../components/fragments/MiniActionButton.svelte";
  import PlainInputField from "../components/fragments/PlainInputField.svelte";
  import StatusCard from "../components/fragments/StatusCard.svelte";
  import { callbackHandler, submitOnKeyHandler } from "../lib/events.js";
  import { createBlacklistPageWorkspace } from "../modules/blacklist.js";

  let { active } = $props();
  const blacklistPageWorkspace = createBlacklistPageWorkspace();
  const { blacklistDisplayStateStore } = blacklistPageWorkspace;
  let blacklistDisplay = $derived($blacklistDisplayStateStore);
  let blacklistCheck = $derived(blacklistDisplay.checkDisplay);
  let blacklistPatternDisplay = $derived(blacklistDisplay.patternDisplay);
  let blacklistStatus = $derived(blacklistDisplay.statusDisplay);

  const handleSubmitPatternOnEnter = submitOnKeyHandler("Enter", () =>
    blacklistPageWorkspace.addPattern(),
  );
  const handleSubmitCommandOnEnter = submitOnKeyHandler("Enter", () =>
    blacklistPageWorkspace.checkCommand(),
  );

  $effect(() => {
    void blacklistPageWorkspace.setPageContext({ active });
  });
</script>

{#snippet blacklistRulesCard()}
  <div class="grid gap-3">
    <Card.Root>
      <Card.Header>
        <Card.Title>
          {blacklistPatternDisplay.title}
        </Card.Title>
        <Card.Action>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onclick={blacklistPageWorkspace.refreshPatterns}
          >
            {blacklistPatternDisplay.refreshButtonLabel}
          </Button>
        </Card.Action>
      </Card.Header>
      <Card.Content class="grid gap-2">
        <div class="text-xs text-slate-500">
          {blacklistPatternDisplay.fileHint}
        </div>
        <div class="grid gap-2">
          {#if blacklistPatternDisplay.hasError}
            <StatusCard
              message={blacklistPatternDisplay.errorMessage}
              tone={blacklistPatternDisplay.errorStatus.tone}
            />
          {:else if blacklistPatternDisplay.isEmpty}
            <StatusCard message={blacklistPatternDisplay.emptyMessage} />
          {:else}
            {#each blacklistPatternDisplay.blacklistPatternRows as blacklistPattern}
              <div class={blacklistPattern.rowClass}>
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <code class={blacklistPattern.patternClass}>
                    {blacklistPattern.patternText}
                  </code>
                  <MiniActionButton
                    labelText={blacklistPatternDisplay.deleteButtonLabel}
                    variant="delete"
                    onClick={callbackHandler(
                      blacklistPageWorkspace.deletePattern,
                      blacklistPattern.deleteValue,
                    )}
                  />
                </div>
              </div>
            {/each}
          {/if}
        </div>
        <div class="grid gap-2">
          <StatusCard
            message={blacklistStatus.text}
            tone={blacklistStatus.tone}
          />
        </div>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Header>
        <Card.Title>
          {blacklistPatternDisplay.addTitle}
        </Card.Title>
      </Card.Header>
      <Card.Content class="grid gap-2">
        <PlainInputField
          value={blacklistPatternDisplay.patternField.value}
          aria-label={blacklistPatternDisplay.patternField.ariaLabelText}
          placeholderText={blacklistPatternDisplay.patternField.placeholder}
          onValueInput={blacklistPageWorkspace.updatePatternInput}
          onkeydown={handleSubmitPatternOnEnter}
        />
        <div class="text-xs text-slate-500">
          {blacklistPatternDisplay.patternHint}
        </div>
        <MiniActionButton
          labelText={blacklistPatternDisplay.addButtonLabel}
          variant="add"
          onClick={blacklistPageWorkspace.addPattern}
        />
      </Card.Content>
    </Card.Root>
  </div>
{/snippet}

{#snippet checkResultCard(cardClass, resultLabel, showMatchedPattern)}
  <div class={cardClass}>
    <div class="font-semibold">
      {resultLabel}
    </div>
    <div class="mt-1">
      {blacklistCheck.checkedCommandLabel}:
      <code>{blacklistCheck.checkedCommand}</code>
    </div>
    {#if showMatchedPattern}
      <div class="mt-1">
        {blacklistCheck.matchedPatternLabel}:
        <code>{blacklistCheck.matchedPattern}</code>
      </div>
    {/if}
  </div>
{/snippet}

<DashboardTabPanel {active} titleKey="blacklistTitle">
  <div class="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
    {@render blacklistRulesCard()}
    <Card.Root>
      <Card.Header>
        <Card.Title>
          {blacklistCheck.title}
        </Card.Title>
      </Card.Header>
      <Card.Content class="grid gap-2">
        <PlainInputField
          value={blacklistCheck.commandField.value}
          title={blacklistCheck.commandField.placeholder}
          aria-label={blacklistCheck.commandField.ariaLabelText}
          placeholderText={blacklistCheck.commandField.placeholder}
          onValueInput={blacklistPageWorkspace.updateCommandInput}
          onkeydown={handleSubmitCommandOnEnter}
        />
        <Button
          variant="outline"
          size="sm"
          type="button"
          onclick={blacklistPageWorkspace.checkCommand}
        >
          {blacklistCheck.checkButtonLabel}
        </Button>
        <div class="grid gap-2">
          {#if blacklistCheck.showError}
            <StatusCard
              message={blacklistCheck.checkError}
              tone={blacklistCheck.errorStatus.tone}
            />
          {:else if blacklistCheck.showPlaceholder}
            <StatusCard message={blacklistCheck.placeholder} />
          {:else if blacklistCheck.showBlocked || (blacklistCheck.hasCheckResult && blacklistCheck.checkBlocked)}
            {@render checkResultCard(
              "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700",
              blacklistCheck.resultBlockedLabel,
              true,
            )}
          {:else if blacklistCheck.showAllowed}
            {@render checkResultCard(
              "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700",
              blacklistCheck.resultAllowedLabel,
              false,
            )}
          {/if}
        </div>
      </Card.Content>
    </Card.Root>
  </div>
</DashboardTabPanel>
