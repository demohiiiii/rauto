import {
  browserClearTimeout,
  browserSetTimeout,
} from "../../../lib/browser.js";
import { createLazyComponentRegistry } from "../../../lib/svelte.js";
import { dashboardDetailRendererDefinitions } from "$domains/dashboard/model/navigation.js";
import type {
  OverlayData,
  OverlayDetailRendererDefinitions,
  OverlayDetailRendererRegistry,
  OverlayOrchestrationDetailDisplay,
} from "../model/types.js";

export const overlayDetailRendererDefinitions =
  dashboardDetailRendererDefinitions as OverlayDetailRendererDefinitions;

export const overlayDetailRuntime = {
  clearTimeout(timer: number): void {
    browserClearTimeout(timer);
  },
  createRendererRegistry(
    definitions: OverlayDetailRendererDefinitions,
    errorMessage: () => string,
  ): OverlayDetailRendererRegistry {
    return createLazyComponentRegistry({
      errorMessage,
      resolveId: (id: string) => id,
      resolveLoad: (id: string) => definitions[id],
    });
  },
  async loadOrchestrationDetailDisplay(): Promise<OverlayOrchestrationDetailDisplay> {
    const { orchestrationDetailDisplay } =
      await import("$domains/orchestration/index.js");
    return (detail) => {
      if (detail.kind !== "stage" && detail.kind !== "target") return {};
      return orchestrationDetailDisplay(
        detail as OverlayData &
          Parameters<typeof orchestrationDetailDisplay>[0],
      );
    };
  },
  setTimeout(handler: () => void, delay: number): number {
    return browserSetTimeout(handler, delay);
  },
};
