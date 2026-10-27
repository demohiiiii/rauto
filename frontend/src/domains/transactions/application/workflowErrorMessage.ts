import { t } from "$lib/i18n.js";

function rawErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message || "");
  }
  return String(error || "");
}

/**
 * Translates the stable workflow diagnostics emitted by the renderer while
 * retaining the variable names and JSON paths supplied by the user.
 * Unknown backend errors remain untouched so this helper is safe during API
 * upgrades.
 */
export function localizedWorkflowError(error: unknown): string {
  const message = rawErrorMessage(error);
  const missingTemplate = message.match(
    /missing template variable\(s\) at ([^:]+): ([^;]+);/,
  );
  const missingExpression = message.match(
    /invalid (loop|choice) expression[^:]* at ([^:]+): missing variable\(s\) ([^;]+);/,
  );
  const missing = missingTemplate || missingExpression;
  if (missing) {
    const path = missingTemplate ? missing[1] : missing[2];
    const variables = missingTemplate ? missing[2] : missing[3];
    const iteration = message.match(/iteration \d+\/\d+/)?.[0];
    return [
      t("workflowDiagnosticMissingTitle"),
      `${t("workflowDiagnosticPath")}: ${path}`,
      `${t("workflowDiagnosticVariables")}: ${variables}`,
      iteration
        ? `${t("workflowDiagnosticIteration")}: ${iteration.replace("iteration ", "")}`
        : "",
      t("workflowDiagnosticMissingHint"),
    ]
      .filter(Boolean)
      .join("\n");
  }

  const loopValue = message.match(
    /invalid loop value at ([^:]+): expected (.+) for '([^']+)'/,
  );
  if (loopValue) {
    return [
      t("workflowDiagnosticLoopValueTitle"),
      `${t("workflowDiagnosticPath")}: ${loopValue[1]}`,
      `${t("workflowDiagnosticExpression")}: ${loopValue[3]}`,
      `${t("workflowDiagnosticExpected")}: ${loopValue[2]}`,
    ].join("\n");
  }

  const renderedPath = message.match(/template rendering failed at ([^:]+):/);
  if (renderedPath) {
    return [
      t("workflowDiagnosticRenderTitle"),
      `${t("workflowDiagnosticPath")}: ${renderedPath[1]}`,
      message.slice(message.indexOf(":", renderedPath.index ?? 0) + 1).trim(),
    ].join("\n");
  }

  return message;
}
