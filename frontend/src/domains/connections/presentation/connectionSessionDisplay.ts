import { tr } from "$lib/i18n.js";
import type { ConnectionSessionState } from "../model/types.js";

export function connectionSessionPresentation(
  session: Pick<ConnectionSessionState, "status" | "error">,
) {
  return {
    status: session.status,
    error: session.error,
    label: tr(
      {
        idle: "connectionSessionIdle",
        connecting: "connectionSessionConnecting",
        connected: "connectionSessionConnected",
        error: "connectionSessionError",
      }[session.status],
    ),
    colorClass:
      session.status === "connected"
        ? "text-emerald-600 dark:text-emerald-400"
        : session.status === "error"
          ? "text-destructive"
          : "text-muted-foreground",
  };
}
