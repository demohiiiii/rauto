<script lang="ts">
  import CredentialsWorkspace from "$domains/credentials/presentation/components/CredentialsWorkspace.svelte";

  let { active }: { active: boolean } = $props();
</script>

<CredentialsWorkspace {active} />
