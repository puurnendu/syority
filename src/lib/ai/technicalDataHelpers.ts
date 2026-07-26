/**
 * Helpers for equipment technical data: normalise stored field format (old raw vs new envelope).
 * Used by technical-data API and EquipmentTechnicalCard.
 */

export interface FieldEnvelope {
  value: unknown;
  confirmed: boolean;
  editedBy: string | null;
  editedAt: string | null;
  aiOriginal: unknown;
  wasEdited: boolean;
}

/**
 * Normalise a stored field — handles both old format (raw value) and new format (envelope).
 * When reading from DB, use this so UI works for legacy and new data.
 */
export function normaliseField(stored: unknown): FieldEnvelope {
  if (stored !== null && typeof stored === 'object' && 'value' in (stored as object)) {
    const s = stored as Record<string, unknown>;
    return {
      value: s.value,
      confirmed: Boolean(s.confirmed),
      editedBy: (s.editedBy as string) ?? null,
      editedAt: (s.editedAt as string) ?? null,
      aiOriginal: s.aiOriginal ?? s.value,
      wasEdited: Boolean(s.wasEdited),
    };
  }
  return {
    value: stored,
    confirmed: false,
    editedBy: null,
    editedAt: null,
    aiOriginal: stored,
    wasEdited: false,
  };
}
