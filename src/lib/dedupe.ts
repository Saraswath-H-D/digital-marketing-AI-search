// Exact-duplicate-lead detection engine.
//
// Definitive rule: two leads are an EXACT DUPLICATE when EVERY applicable mapped field
// matches exactly (after safe normalization) — tag is NEVER part of this comparison.
// A lead imported under a different tag than an existing match is STILL the same
// duplicate lead (e.g. same email under "OldCustomers" vs "NewCustomers" is still a
// duplicate); tag-name uniqueness is a completely separate, independent check (see
// getActiveTagSet in lib/supabase.ts and the tag-conflict flow in CsvImporter.tsx /
// AICopilotDrawer.tsx) that never influences whether a LEAD counts as a duplicate.
// Filename is NEVER part of this comparison either (see lib/csvFileRegistry.ts for the
// unrelated, file-content-hash-based "have I seen this exact file before" check). No
// similarity scoring, ever.

// Fields that carry genuine lead "content" for duplicate comparison — excludes
// auto-generated/system bookkeeping fields (and the tag field, which plays no part in
// this comparison at all — see the module comment above).
//
// approvalStatus and emailStatus are deliberately NOT in this list (moved to
// SYSTEM_ONLY_FIELDS below) — this was a real, confirmed bug: bulkImportLeads defaults
// approvalStatus to the literal string "approved" on every lead it creates (never left
// blank), and a lead round-tripped through Supabase similarly picks up
// emailStatus = "Verified" (pushLeadsToSupabase's own column default) on its next pull.
// Neither default reflects anything the CSV actually said — they're the app's own
// operational bookkeeping. But a freshly parsed CSV row being checked for duplicates
// has neither field set at all (most CSVs have no such columns), so its signature
// omitted them while an already-imported lead's signature always included them —
// two different signatures for what should be the identical record, so genuine
// duplicates against ANY already-imported lead were silently never detected. Confirmed
// end-to-end against a real Supabase round trip before fixing.
const CORE_CONTENT_FIELDS = [
  'firstName', 'lastName', 'email', 'phone', 'jobTitle', 'organization',
  'city', 'state', 'country', 'sourceName', 'seniority',
  'department', 'industry', 'companySize', 'linkedinUrl', 'website',
  'companyLinkedinUrl', 'questions',
];

const SYSTEM_ONLY_FIELDS = new Set([
  'id', 'createdAt', 'isSaved', 'emailUnlocked', 'phoneUnlocked',
  'registrationTime', '_csvHeaders', 'csvTag', 'tags', 'aiScore', 'aiValueReasons',
  'notes', 'intent', 'technologies', 'approvalStatus', 'emailStatus',
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
// header — deliberately NO tag/context in this signature (see module comment above).
// Two leads produce the identical signature ONLY when every relevant field matches
// (after safe normalization). A header with no value on a given record is simply
// omitted from its signature, so a record missing a field a sibling has produces a
// different signature rather than being silently treated as a match (a present value
// vs. a missing one is itself a difference).
export function buildDuplicateSignature(
  lead: Record<string, any>
): { signature: string; comparedFields: Record<string, string> } {
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
 * signature → record map, built from ALL existing Supabase rows regardless of tag —
 * tag plays no part in the duplicate identity, see the module comment above) AND
 * against each other within this same batch. First occurrence of a signature wins;
 * later ones are reported as duplicates (never silently merged, never silently
 * dropped).
 */
export function dedupeLeadRows<T extends Record<string, any>>(
  rows: T[],
  existingIndex: Map<string, ExistingRecordRef> = new Map()
): DedupeBatchResult<T> {
  const seenThisBatch = new Map<string, ExistingRecordRef>();
  const kept: T[] = [];
  const duplicates: DuplicateMatch<T>[] = [];
  const duplicateLeadNames = new Set<string>();

  for (const row of rows) {
    const { signature, comparedFields } = buildDuplicateSignature(row);
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
