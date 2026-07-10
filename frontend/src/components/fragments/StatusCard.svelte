<script>
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { statusCardDisplay } from "../../lib/ui.js";

  let { message, tone, class: rootClass, variant, children } = $props();
  let statusDisplay = $derived(
    statusCardDisplay({ extraClass: rootClass, message, tone, variant }),
  );
</script>

{#if statusDisplay.showAlert}
  <div role="alert" class={statusDisplay.rootClass}>
    {#if statusDisplay.showLoadingSpinner}
      <Spinner data-icon="inline-start" aria-hidden="true" aria-label={null} />
    {/if}
    {#if typeof children === "function"}
      {@render children()}
    {:else}
      <span class="break-all whitespace-pre-wrap"
        >{statusDisplay.alertMessageText}</span
      >
    {/if}
  </div>
{:else}
  <div class={statusDisplay.cardClass}>
    {#if typeof children === "function"}
      {@render children()}
    {:else}
      {statusDisplay.messageText}
    {/if}
  </div>
{/if}
