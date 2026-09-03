// Exact-duplicate-lead detection engine.
//
// Definitive rule (supersedes the earlier tag-scoped version): after CSV headers are
// mapped to the app's fields, two leads are an EXACT DUPLICATE only when EVERY
// applicable mapped field matches exactly (after safe normalization). Tags are metadata
// handled separately — a matching lead under a different tag is still the same
// duplicate lead; the difference is resolved via an "add this tag too?" decision, not by
// treating them as two different leads. No similarity scoring, ever.

// Fields that carry genuine lead "content" for duplicate comparison — excludes
// auto-generated/system bookkeeping fields AND tag fields, which are handled entirely
// separately from the exact-duplicate decision.
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

// Builds the exact-duplicate identity: normalized header set + normalized value per
// header — deliberately NO tag/context in this signature. Two leads produce the
// identical signature ONLY when every relevant field matches (after safe
// normalization). A header with no value on a given record is simply omitted from its
// signature, so a record missing a field a sibling has produces a different signature
// rather than being silently treated as a match (a present value vs. a missing one is
// itself a difference).
export function buildDuplicateSignature(lead: Record<string, any>): { signature: string; comparedFields: Record<string, string> } {
  const comparedFields: Record<string, string> = {};

  const keys = new Set<string>(CORE_CONTENT_FIELDS);
  Object.keys(lead).forEach(k => {
    if (!SYSTEM_ONLY_FIELDS.has(k) && !k.startsWith('_') && !CORE_CONTENT_FIELDS.includes(k)) {
      keys.add(k);
    }
  });

  const parts: string[] = [];
  Array.from(keys).sort().forEach(field => {
    const norm = normalizeFieldValue(field, (lead as any)[field]);
    if (norm) {
      parts.push(`${field}=${norm}`);
      comparedFields[field] = norm;
    }
  });

  return { signature: parts.join('|'), comparedFields };
}

// Deliberately explicit, non-ambiguous field names (leadName vs. tagName) — a lead's
// display identity and its tag must never be interchangeable in this data structure,
// so a future edit can't silently swap them the way a generic `name`/`label` could.
/** A previously-known record (existing Supabase row, or an earlier row in this batch) sharing a signature. */
export interface ExistingRecordRef {
  signature: string;
  /** The lead's own name (or email, as a fallback) — NEVER a tag. */
  leadName: string;
  email: string;
  /** The tag this existing record was uploaded/tagged under — NEVER a lead name. */
  tagName: string | null;
  extraTags: string[];
}

export interface DuplicateMatch<T> {
  row: T;
  signature: string;
  comparedFields: Record<string, string>;
  /** The lead's own name (or email, as a fallback) — NEVER a tag. */
  leadName: string;
  newTag: string | null;
  existing: ExistingRecordRef;
  /** true when the existing record's tag differs from this row's tag — needs an "add tag?" decision. */
  tagConflict: boolean;
}

export interface DedupeBatchResult<T> {
  kept: T[];
  duplicates: DuplicateMatch<T>[];
  totalRows: number;
  uniqueRows: number;
  duplicatesSkipped: number;
  /** Distinct duplicate leads found (by signature) — for the consolidated popup's name list. */
  duplicateLeadNames: string[];
  /** Subset of `duplicates` whose tag actually differs from the existing record's tag. */
  tagConflicts: DuplicateMatch<T>[];
}

function leadNameOf(lead: Record<string, any>): string {
  const first = (lead.firstName || '').trim();
  const last = (lead.lastName || '').trim();
  const name = [first, last !== '-' ? last : ''].filter(Boolean).join(' ').trim();
  return name || (lead.email || 'Unknown lead');
}

/**
 * Filters `rows` against exact duplicates already known via `existingIndex` (a
 * signature → record map, typically built from ALL existing Supabase rows regardless of
 * tag — tag is not part of the duplicate identity) AND against each other within this
 * same batch. First occurrence of a signature wins; later ones are reported as
 * duplicates (never silently merged, never silently dropped) along with whether their
 * tag actually conflicts with the kept/existing record's tag.
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
    const { signature, comparedFields } = buildDuplicateSignature(row);
    const newTag = (row[tagField] as unknown as string) || null;
    const existing = existingIndex.get(signature) || seenThisBatch.get(signature);

    if (existing) {
      const leadName = leadNameOf(row);
      duplicateLeadNames.add(leadName);
      const tagConflict = !!newTag && newTag !== existing.tagName && !existing.extraTags.includes(newTag);
      duplicates.push({ row, signature, comparedFields, leadName, newTag, existing, tagConflict });
      continue;
    }

    const email = (row.email && String(row.email).trim() !== '-') ? String(row.email).trim() : '';
    seenThisBatch.set(signature, { signature, leadName: leadNameOf(row), email, tagName: newTag, extraTags: [] });
    kept.push(row);
  }

  return {
    kept,
    duplicates,
    totalRows: rows.length,
    uniqueRows: kept.length,
    duplicatesSkipped: duplicates.length,
    duplicateLeadNames: Array.from(duplicateLeadNames),
    tagConflicts: duplicates.filter(d => d.tagConflict),
  };
}
