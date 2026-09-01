import type { TxMetadataFieldDefinition } from "./types.js";

const EMPTY_METADATA_FIELD_DEFS: readonly TxMetadataFieldDefinition[] =
  Object.freeze([]);

export function txBlockPromptMetadataFieldDefs(): readonly TxMetadataFieldDefinition[] {
  return EMPTY_METADATA_FIELD_DEFS;
}
