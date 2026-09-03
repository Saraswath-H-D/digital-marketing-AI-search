// Exact-duplicate-lead detection engine.
//
// Definitive rule: two leads are an EXACT DUPLICATE only when they share the SAME
// tag/context AND EVERY applicable mapped field matches exactly (after safe
// normalization). Tag is part of the duplicate identity, not separate metadata — the
// same person imported under a genuinely different tag is a DIFFERENT lead record, kept
// separately, never merged or silently collapsed into the existing one. Filename is
// NEVER part of this comparison (see lib/csvFileRegistry.ts for the unrelated,
// file-content-hash-based "have I seen this exact file before" check). No similarity
// scoring, ever.

// Fields that carry genuine lead "content" for duplicate comparison — excludes
// auto-generated/system bookkeeping fields AND the tag field, which is folded into the
// signature separately (see buildDuplicateSignature) rather than compared like a
// regular content field.
const CORE_CONTENT_FIELDS = [
  'firstName', 'lastName', 'email', 'phone', 'jobTitle', 'organization',
  'city', 'state', 'country', 'sourceName', 'emailStatus', 'seniority',
  'department', 'industry', 'companySize', 'linkedinUrl', 'website',
  'companyLinkedinUrl', 'questions', 'approvalStatus',
];

const SYSTEM_ONLY_FIELDS = new Set([
  'id', 'createdAt', 'isSaved', 'emailUnlocked', 'phoneUnlocked',
  'registrationTime', '_csvHeaders', 'csvTag', 'tags', 'aiScore', 'aiValueReasons',
  'notes', 'intent', 'technologies',
]);

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase();
}

// Strip everything but digits and a leading '+', so "+91 98765 43210" and
// "+919876543210" compare equal, while a genuinely different digit sequence — even by
// one digit — never does.
function normalizePhone(v: string): string {
  const trimmed = v.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  return (hasPlus ? '+' : '') + digits;
}

// Safe, harmless normalization only: trim + collapse internal whitespace + lowercase.
// Deliberately NOT fuzzy/similarity matching — a genuinely different value must stay
// different (e.g. "Hyderbad" vs "Hyderabad" is NOT auto-merged here; that would need
// the app's own dedicated location-normalization mechanism, not a generic string diff).
function normalizeGeneric(v: string): string {
  return v.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeFieldValue(field: string, raw: any): string {
  const v = raw === undefined || raw === null ? '' : String(raw).trim();
  if (!v || v === '-' || v === 'undefined' || v === 'null') return '';
  if (field === 'email') return normalizeEmail(v);
  if (field === 'phone') return normalizePhone(v);
  return normalizeGeneric(v);
}

// Same harmless normalization as any other field (trim/case/whitespace-insensitive), plus
// hyphen/underscore collapsing so "Q3 Marketing", "q3-marketing" and "q3_marketing" are
// recognized as the same context — consistent with how tags are matched everywhere else
// in the app (see leadMatchesTag in data/leadStorage.ts). An empty/missing tag still
// gets its own stable bucket rather than being dropped from the signature, so two
// genuinely untagged imports are still compared against each other, and a tagged lead
// never accidentally collides with an untagged one.
function normalizeTagForSignature(tag: string | null | undefined): string {
  const t = (tag || '').trim().toLowerCase().replace(/[-_\s]+/g, '-');
  return t || '(no-tag)';
}

// Builds the exact-duplicate identity: normalized tag/context + normalized header set +
// normalized value per header. Two leads produce the identical signature ONLY when they
// share the same tag/context AND every relevant field matches (after safe
// normalization). A header with no value on a given record is simply omitted from its
// signature, so a record missing a field a sibling has produces a different signature
// rather than being silently treated as a match (a present value vs. a missing one is
// itself a difference).
export function buildDuplicateSignature(
  lead: Record<string, any>,
  tag: string | null | undefined
): { signature: string; comparedFields: Record<string, string> } {
  const comparedFields: Record<string, string> = {};

  const keys = new Set<string>(CORE_CONTENT_FIELDS);
  Object.keys(lead).forEach(k => {
    if (!SYSTEM_ONLY_FIELDS.has(k) && !k.startsWith('_') && !CORE_CONTENT_FIELDS.includes(k)) {
      keys.add(k);
    }
  });

  const parts: string[] = [`tag=${normalizeTagForSignature(tag)}`];
  Array.from(keys).sort().forEach(field => {
    const norm = normalizeFieldValue(field, (lead as any)[field]);
    if (norm) {
      parts.push(`${field}=${norm}`);
      comparedFields[field] = norm;
    }
  });

  return { signature: parts.join('|'), comparedFields };
}

// Deliberately explicit, non-ambiguous field name (leadName, never a tag) — a lead's
// display identity must never be confused with its tag in this data structure, so a
// future edit can't silently swap them the way a generic `name`/`label` could.
/** A previously-known record (existing Supabase row, or an earlier row in this batch) sharing a signature. */
export interface ExistingRecordRef {
  signature: string;
  /** The lead's own name (or email, as a fallback) — NEVER a tag. */
  leadName: string;
  email: string;
}

export interface DuplicateMatch<T> {
  row: T;
  signature: string;
  comparedFields: Record<string, string>;
  /** The lead's own name (or email, as a fallback) — NEVER a tag. */
  leadName: string;
  existing: ExistingRecordRef;
}

export interface DedupeBatchResult<T> {
  kept: T[];
  duplicates: DuplicateMatch<T>[];
  totalRows: number;
  uniqueRows: number;
  duplicatesSkipped: number;
  /** Distinct duplicate leads found (by signature) — for the consolidated popup's name list. */
  duplicateLeadNames: string[];
}

function leadNameOf(lead: Record<string, any>): string {
  const first = (lead.firstName || '').trim();
  const last = (lead.lastName || '').trim();
  const name = [first, last !== '-' ? last : ''].filter(Boolean).join(' ').trim();
  return name || (lead.email || 'Unknown lead');
}

/**
 * Filters `rows` against exact duplicates already known via `existingIndex` (a
 * signature → record map, built ONLY from the existing Supabase rows this batch's own
 * signatures could actually match — see getExistingLeadIndexForSignatures — since tag is
 * folded into the signature there is no separate tag-scoping step here) AND against each
 * other within this same batch. First occurrence of a signature wins; later ones are
 * reported as duplicates (never silently merged, never silently dropped).
 */
export function dedupeLeadRows<T extends Record<string, any>>(
  rows: T[],
  tagField: keyof T,
  existingIndex: Map<string, ExistingRecordRef> = new Map()
): DedupeBatchResult<T> {
  const seenThisBatch = new Map<string, ExistingRecordRef>();
  const kept: T[] = [];
  const duplicates: DuplicateMatch<T>[] = [];
  const duplicateLeadNames = new Set<string>();

  for (const row of rows) {
    const tag = (row[tagField] as unknown as string) || null;
    const { signature, comparedFields } = buildDuplicateSignature(row, tag);
    const existing = existingIndex.get(signature) || seenThisBatch.get(signature);

    if (existing) {
      const leadName = leadNameOf(row);
      duplicateLeadNames.add(leadName);
      duplicates.push({ row, signature, comparedFields, leadName, existing });
      continue;
    }

    const email = (row.email && String(row.email).trim() !== '-') ? String(row.email).trim() : '';
    seenThisBatch.set(signature, { signature, leadName: leadNameOf(row), email });
    kept.push(row);
  }

  return {
    kept,
    duplicates,
    totalRows: rows.length,
    uniqueRows: kept.length,
    duplicatesSkipped: duplicates.length,
    duplicateLeadNames: Array.from(duplicateLeadNames),
  };
}
