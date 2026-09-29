export interface TemplateNameDialogState {
  open: boolean;
  value: string;
  error: string;
}

export type TemplateSourceKind = "manual" | "custom" | "builtin";
