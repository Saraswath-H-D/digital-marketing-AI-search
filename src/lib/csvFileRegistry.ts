// File-level CSV duplicate detection — a completely separate check from lead-level
// duplicate detection (lib/dedupe.ts). This answers "have I already imported the exact
// bytes of this file before, and under what tag(s)?", using a real content hash rather
// than filename/size, so a renamed-but-identical file is still recognized and a
// same-named-but-different file never falsely matches.
//
// A recorded upload is only a live conflict while at least one lead under its tag still
// exists in Supabase (see resolveFileConflict) — this registry alone is just a local
// index of "what hash/tag pairs were ever recorded"; it is NEVER treated as proof a CSV
// is still active on its own, exactly because deleting the leads later can't reach back
// and update it. Supabase stays the single source of truth for "active."
import { getActiveTagSet } from './supabase.ts';

const REGISTRY_KEY = 'operon_csv_file_registry_v1';

export interface CsvFileRecord {
  hash: string;
  fileName: string;
  tags: string[];
  rowCount: number;
  firstUploadedAt: string;
  lastUploadedAt: string;
}

// SHA-256 over the raw file bytes via the browser's native Web Crypto API — no library
// needed, and it's a real content hash (a renamed copy of the same file still matches;
// a same-named-but-edited file never does).
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getRegistry(): Record<string, CsvFileRecord> {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRegistry(registry: Record<string, CsvFileRecord>): void {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch (err) {
    console.warn('Failed to persist CSV file registry:', err);
  }
}

/** Looks up whether this exact file (by content hash) has been imported before. */
export function findCsvFileRecord(hash: string): CsvFileRecord | null {
  return getRegistry()[hash] || null;
}

/** Records (or updates) a successful import of this exact file under `tag`. */
export function recordCsvFileUpload(hash: string, fileName: string, tag: string | null, rowCount: number): void {
  const registry = getRegistry();
  const now = new Date().toISOString();
  const existing = registry[hash];
  const tagLabel = tag || '(no tag)';

  if (existing) {
    if (!existing.tags.includes(tagLabel)) existing.tags.push(tagLabel);
    existing.lastUploadedAt = now;
    existing.rowCount = rowCount;
  } else {
    registry[hash] = {
      hash,
      fileName,
      tags: [tagLabel],
      rowCount,
      firstUploadedAt: now,
      lastUploadedAt: now,
    };
  }
  saveRegistry(registry);
}

/** Removes tags no longer confirmed live from a file's recorded history (hygiene only — resolveFileConflict never trusts stale tags regardless). */
function pruneCsvFileRecordTags(hash: string, keepTags: string[]): void {
  const registry = getRegistry();
  if (!registry[hash]) return;
  if (keepTags.length === 0) {
    delete registry[hash];
  } else {
    registry[hash].tags = keepTags;
  }
  saveRegistry(registry);
}

export type FileConflictStatus =
  | { status: 'new'; wasPreviouslyDeleted: boolean }
  | { status: 'same-active-tag' }
  | { status: 'different-active-tag'; activeTags: string[] };

/**
 * Resolves whether `hash` represents an ACTIVE prior upload — i.e. at least one of its
 * recorded tags currently has live leads in Supabase — before ever showing the
 * "already uploaded" conflict UI. A tag whose leads were all deleted is no longer
 * active: its stale registry entry is pruned, and re-uploading that file is treated as
 * a brand-new upload with no tag restored from history.
 *
 * Untagged historical entries ("(no tag)") have no single reliable identity to verify
 * liveness against — rather than risk permanently blocking on a stale untagged record,
 * they're treated as inactive as soon as they're the only recorded tag.
 */
export async function resolveFileConflict(hash: string, requestedTag: string | null): Promise<FileConflictStatus> {
  const record = findCsvFileRecord(hash);
  if (!record) return { status: 'new', wasPreviouslyDeleted: false };

  const requestedLabel = requestedTag || '(no tag)';
  const namedTags = record.tags.filter(t => t !== '(no tag)');
  if (namedTags.length === 0) {
    const hadNamedTagsBefore = record.tags.length > 0;
    pruneCsvFileRecordTags(hash, []);
    return { status: 'new', wasPreviouslyDeleted: hadNamedTagsBefore };
  }

  const activeTagSet = await getActiveTagSet();
  let liveTags: string[];
  if (activeTagSet === null) {
    // Couldn't verify against Supabase — fall back to trusting the local registry
    // rather than silently losing file-conflict protection.
    liveTags = namedTags;
  } else {
    const normalize = (t: string) => t.trim().toLowerCase().replace(/[-_\s]+/g, '-');
    liveTags = namedTags.filter(t => activeTagSet.has(normalize(t)));
    if (liveTags.length !== record.tags.length) {
      pruneCsvFileRecordTags(hash, liveTags);
    }
  }

  if (liveTags.length === 0) return { status: 'new', wasPreviouslyDeleted: true };
  if (liveTags.includes(requestedLabel)) return { status: 'same-active-tag' };
  return { status: 'different-active-tag', activeTags: liveTags };
}
