// File-level CSV duplicate detection — a completely separate check from lead-level
// duplicate detection (lib/dedupe.ts). This answers "have I already imported the exact
// bytes of this file before, and under what tag(s)?", using a real content hash rather
// than filename/size, so a renamed-but-identical file is still recognized and a
// same-named-but-different file never falsely matches.

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
