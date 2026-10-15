import { jsonLanguage } from "@codemirror/lang-json";
import {
  jsonLocationFromOffset,
  jsonParseErrorDetail,
  type JsonParseErrorDetail,
} from "../../../lib/jsonValue.js";

export interface RuntimeVariablesJsonState {
  error: JsonParseErrorDetail | null;
  formattedText: string | null;
}

function formatJsonWhitespace(text: string): string {
  // Keep literals and key order intact, including numbers beyond JS precision.
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[^\s]/g) || [];
  const parts: string[] = [];
  let depth = 0;
  const newline = () => parts.push("\n", "  ".repeat(depth));
  tokens.forEach((token, index) => {
    if (token === "{" || token === "[") {
      parts.push(token);
      depth += 1;
      if (tokens[index + 1] !== (token === "{" ? "}" : "]")) newline();
    } else if (token === "}" || token === "]") {
      depth -= 1;
      if (tokens[index - 1] !== (token === "}" ? "{" : "[")) newline();
      parts.push(token);
    } else if (token === ",") {
      parts.push(token);
      newline();
    } else {
      parts.push(token === ":" ? ": " : token);
    }
  });
  return parts.join("");
}

export function runtimeVariablesJsonState(
  text: string,
): RuntimeVariablesJsonState {
  try {
    const jsonText = text.trim() ? text : "{}";
    JSON.parse(jsonText);
    return { error: null, formattedText: formatJsonWhitespace(jsonText) };
  } catch (error) {
    const detail = jsonParseErrorDetail(text, error);
    if (detail.line === null) {
      let offset: number | null = null;
      jsonLanguage.parser.parse(text).iterate({
        enter(node) {
          if (node.type.isError && offset === null) offset = node.from;
        },
      });
      if (offset !== null)
        Object.assign(detail, jsonLocationFromOffset(text, offset));
    }
    return { error: detail, formattedText: null };
  }
}
