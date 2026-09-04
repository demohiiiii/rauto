<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";

  interface Props {
    labelText?: string;
    onClick?: (() => unknown) | null;
    variant?: "add" | "delete";
  }

  let { labelText = "", variant = "add", onClick }: Props = $props();
  let buttonVariant = $derived<"destructive" | "outline">(
    variant === "delete" ? "destructive" : "outline",
  );

  function runAction(): void {
    onClick?.();
  }
</script>

<Button type="button" variant={buttonVariant} size="xs" onclick={runAction}>
  {labelText}
</Button>
