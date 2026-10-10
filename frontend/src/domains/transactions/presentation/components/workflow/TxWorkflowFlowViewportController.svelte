<script lang="ts">
  import { useSvelteFlow } from "@xyflow/svelte";
  import { TX_WORKFLOW_CANVAS_DESKTOP_ZOOM } from "../../transactionWorkflowCanvasState.js";

  interface Props {
    compact?: boolean;
    focusNodeId?: string;
    focusBlockId?: string | null;
    layoutRevision?: string;
    inspectorOpen?: boolean;
    inspectorWidth?: number;
  }

  let {
    compact = false,
    focusNodeId = "workflow-root",
    focusBlockId = null,
    layoutRevision = "",
    inspectorOpen = true,
    inspectorWidth = 560,
  }: Props = $props();

  const { getNode, setCenter, screenToFlowPosition } = useSvelteFlow();

  $effect(() => {
    const nextNodeId = focusNodeId;
    const nextBlockId = focusBlockId;
    layoutRevision;
    const nextCompact = compact;
    const nextInspectorOpen = inspectorOpen;
    const nextInspectorWidth = inspectorWidth;
    const focusTimer = window.setTimeout(() => {
      const node = getNode(nextNodeId);
      if (!node) return;
      const nodeWidth = node.measured?.width || node.width || 320;
      const nodeHeight = node.measured?.height || node.height || 160;
      let x = node.position.x;
      let y = node.position.y;
      let parentId = node.parentId;
      while (parentId) {
        const parent = getNode(parentId);
        if (!parent) break;
        x += parent.position.x;
        y += parent.position.y;
        parentId = parent.parentId;
      }
      const zoom = nextCompact ? 0.82 : TX_WORKFLOW_CANVAS_DESKTOP_ZOOM;
      const inspectorOffset =
        !nextCompact && nextInspectorOpen ? nextInspectorWidth / (2 * zoom) : 0;
      const focusElement = nextBlockId
        ? document.querySelector<HTMLElement>(
            `[data-flow-block-id="${CSS.escape(nextBlockId)}"]`,
          )
        : null;
      const rect = focusElement?.getBoundingClientRect();
      const center = rect
        ? screenToFlowPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          })
        : { x: x + nodeWidth / 2, y: y + nodeHeight / 2 };
      setCenter(center.x + inspectorOffset, center.y, {
        zoom,
        duration: 240,
      });
    }, 80);

    return () => window.clearTimeout(focusTimer);
  });
</script>
