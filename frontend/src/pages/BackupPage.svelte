<script lang="ts">
  import BackupWorkspace from "$domains/backup/presentation/components/BackupWorkspace.svelte";

  let { active }: { active: boolean } = $props();
</script>

<BackupWorkspace {active} />
