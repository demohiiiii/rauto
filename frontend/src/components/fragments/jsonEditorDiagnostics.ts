import {
  forEachDiagnostic,
  lintGutter,
  linter,
  nextDiagnostic,
  previousDiagnostic,
} from "@codemirror/lint";
import type { Diagnostic } from "@codemirror/lint";
import type { EditorState, Extension, Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  keymap,
} from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import type { JsonParseErrorDetail } from "../../lib/jsonValue.js";

export function jsonEditorDiagnostic(
  state: EditorState,
  detail: JsonParseErrorDetail | null | undefined,
): Diagnostic[] {
  if (!detail?.message) return [];
  const line = state.doc.line(
    Math.max(1, Math.min(detail.line ?? 1, state.doc.lines)),
  );
  const from = Math.min(
    line.to,
    line.from + Math.max(0, (detail.column ?? 1) - 1),
  );
  const character = state.sliceDoc(from, from + 2).codePointAt(0) ?? 0;
  const to = Math.min(line.to, from + (character > 0xffff ? 2 : 1));
  return [{ from, to, message: detail.message, severity: "error" }];
}

class JsonErrorWidget extends WidgetType {
  constructor(readonly message: string) {
    super();
  }

  eq(other: JsonErrorWidget): boolean {
    return this.message === other.message;
  }

  toDOM(): HTMLElement {
    const element = document.createElement("span");
    element.className = "cm-json-error-inline";
    element.textContent = this.message;
    element.title = this.message;
    element.tabIndex = 0;
    return element;
  }
}

export function inlineJsonErrorDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  forEachDiagnostic(state, (diagnostic, from) => {
    const line = state.doc.lineAt(from);
    decorations.push(
      Decoration.line({ class: "cm-json-error-line" }).range(line.from),
      Decoration.widget({
        widget: new JsonErrorWidget(diagnostic.message),
        side: 1,
      }).range(line.to),
    );
  });
  return Decoration.set(decorations, true);
}

const inlineErrors = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = inlineJsonErrorDecorations(view.state);
    }

    update(update: ViewUpdate): void {
      if (
        update.docChanged ||
        update.transactions.some((tr) => tr.effects.length)
      )
        this.decorations = inlineJsonErrorDecorations(update.state);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const diagnosticTheme = EditorView.theme({
  ".cm-line.cm-json-error-line": {
    backgroundColor: "color-mix(in oklab, var(--destructive) 7%, transparent)",
  },
  ".cm-json-error-inline": {
    display: "inline-block",
    maxWidth: "min(32rem, 60vw)",
    marginLeft: "1rem",
    padding: "0 0.25rem",
    borderRadius: "0.25rem",
    color: "var(--destructive)",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    fontSize: "0.75rem",
    verticalAlign: "text-bottom",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    cursor: "help",
  },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--destructive)",
    textUnderlineOffset: "3px",
  },
  ".cm-tooltip.cm-tooltip-lint": {
    maxWidth: "min(32rem, calc(100vw - 3rem))",
    border: "1px solid var(--border)",
    borderRadius: "0.5rem",
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    overflowWrap: "anywhere",
  },
  ".cm-diagnostic-error": {
    borderLeftColor: "var(--destructive)",
  },
});

export function jsonEditorDiagnosticExtensions(): Extension[] {
  return [
    linter(null),
    lintGutter({ hoverTime: 150 }),
    inlineErrors,
    diagnosticTheme,
    keymap.of([
      { key: "F8", run: nextDiagnostic },
      { key: "Shift-F8", run: previousDiagnostic },
    ]),
  ];
}
