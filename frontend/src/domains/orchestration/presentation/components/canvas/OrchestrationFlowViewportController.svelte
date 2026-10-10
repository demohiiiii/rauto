<script lang="ts">
  import { useSvelteFlow } from "@xyflow/svelte";

  interface Props {
    compact?: boolean;
    focusNodeId?: string;
    focusBlockId?: string | null;
    inspectorOpen?: boolean;
    inspectorWidth?: number;
    layoutRevision?: string;
    topWindowOpen?: boolean;
  }

  let {
    compact = false,
    focusNodeId = "",
    focusBlockId = null,
    layoutRevision = "",
    inspectorOpen = true,
    inspectorWidth = 520,
    topWindowOpen = false,
  }: Props = $props();

  const { getNode, setCenter, screenToFlowPosition } = useSvelteFlow();

  $effect(() => {
    const nextNodeId = focusNodeId;
    const nextBlockId = focusBlockId;
    const nextLayoutRevision = layoutRevision;
    const nextCompact = compact;
    const nextInspectorOpen = inspectorOpen;
    const nextInspectorWidth = inspectorWidth;
    const nextTopWindowOpen = topWindowOpen;
    if (!nextNodeId || nextLayoutRevision == null) return;

    const focusTimer = window.setTimeout(() => {
      const node = getNode(nextNodeId);
      if (!node) return;
      const nodeWidth = node.measured?.width || node.width || 320;
      const nodeHeight = node.measured?.height || node.height || 220;
      const zoom = nextCompact ? 0.78 : 0.88;
      const inspectorOffset =
        !nextCompact && nextInspectorOpen ? nextInspectorWidth / (2 * zoom) : 0;
      const topOffset = nextTopWindowOpen
        ? (nextCompact ? 112 : 144) / zoom
        : 0;
      const element = nextBlockId
        ? document.querySelector<HTMLElement>(
            `[data-flow-block-id="${CSS.escape(nextBlockId)}"]`,
          )
        : null;
      const rect = element?.getBoundingClientRect();
      const center = rect
        ? screenToFlowPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          })
        : {
            x: node.position.x + nodeWidth / 2,
            y: node.position.y + nodeHeight / 2,
          };
      setCenter(center.x + inspectorOffset, center.y - topOffset, {
        zoom,
        duration: 240,
      });
    }, 80);

    return () => window.clearTimeout(focusTimer);
  });
</script>
