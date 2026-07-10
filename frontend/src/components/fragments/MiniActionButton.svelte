<script>
  import { Button } from "$lib/components/ui/button/index.js";

  let { labelText = "", variant = "add", onClick } = $props();
  let buttonVariant = $derived(
    variant === "delete" ? "destructive" : "outline",
  );
</script>

<Button type="button" variant={buttonVariant} size="xs" onclick={onClick}>
  {labelText}
</Button>
