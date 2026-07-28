import crypto from 'crypto';

const TENANT_ID_KEYS = new Set([
  'id',
  'organization_id',
  'org_id',
  'tenant_id',
  'site_id',
  'plant_id',
  'area_id',
  'unit_id',
  'system_id',
  'asset_id',
  'project_id',
  'workpack_id',
  'created_by',
  'updated_by',
  'deleted_by',
  'owner_id',
  'user_id',
  'assigned_to',
  'reviewed_by',
  'approved_by',
]);

const TENANT_NAME_KEYS = new Set([
  'organization_name',
  'org_name',
  'tenant_name',
  'company_name',
  'site_name',
  'plant_name',
  'email',
  'phone',
  'mobile',
  'created_by_name',
  'updated_by_name',
  'owner_email',
  'contact_email',
  'contact_phone',
  'address',
  'logo_url',
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stripValue(key: string, value: unknown): unknown {
  const lower = key.toLowerCase();
  if (TENANT_ID_KEYS.has(lower) || TENANT_NAME_KEYS.has(lower)) return undefined;
  if (lower.endsWith('_id') && typeof value === 'string' && UUID_RE.test(value)) {
    return undefined;
  }
  if (typeof value === 'string' && value.includes('@') && value.includes('.')) {
    // Drop emails even if key is unexpected
    if (lower.includes('email') || lower.includes('mail')) return undefined;
  }
  if (Array.isArray(value)) {
    return value
      .map((v, i) => (typeof v === 'object' && v !== null ? sanitizeObject(v as Record<string, unknown>) : v))
      .filter((v) => v !== undefined);
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

export function sanitizeObject(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    const cleaned = stripValue(key, value);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

export function contentHash(category: string, title: string, payload: Record<string, unknown>): string {
  const normalized = JSON.stringify({
    category,
    title: title.trim().toLowerCase(),
    payload: sortKeys(payload),
  });
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj && typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj as object).sort()) {
      sorted[k] = sortKeys((obj as Record<string, unknown>)[k]);
    }
    return sorted;
  }
  return obj;
}

export function hashOrgId(organizationId: string): string {
  return crypto.createHash('sha256').update(`org:${organizationId}`).digest('hex').slice(0, 16);
}
