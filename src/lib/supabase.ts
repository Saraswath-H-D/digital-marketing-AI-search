import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Lead } from '../types.ts';
import { setActiveHeaders, getActiveHeaders } from '../data/leadStorage.ts';
import { buildDuplicateSignature, ExistingRecordRef } from './dedupe.ts';

const SUPABASE_CONFIG_KEY = 'operon_supabase_config_v1';
const LEGACY_SUPABASE_CONFIG_KEY = 'apollo_supabase_config_v1';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName: string;
  autoSync: boolean;
}

export const getSupabaseConfig = (): SupabaseConfig => {
  const envUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || 'https://vwtaxabsqftvacokntbb.supabase.co';
  const envKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 'sb_publishable_PbvZuOz46vMR8Ny5KHSIHQ_PihbOkiI';

  try {
    const saved = localStorage.getItem(SUPABASE_CONFIG_KEY) || localStorage.getItem(LEGACY_SUPABASE_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        url: parsed.url || envUrl,
        anonKey: parsed.anonKey || envKey,
        tableName: parsed.tableName || 'registration_contacts',
        autoSync: parsed.autoSync ?? true,
      };
    }
  } catch (e) {
    console.error('Failed to load Supabase config from storage', e);
  }
  return {
    url: envUrl,
    anonKey: envKey,
    tableName: 'registration_contacts',
    autoSync: true,
  };
};

export const saveSupabaseConfig = (config: SupabaseConfig): void => {
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
  knownMissingColumns = new Set<string>();
};

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (overrideConfig?: SupabaseConfig): SupabaseClient | null => {
  const config = overrideConfig || getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }
  try {
    return createClient(config.url, config.anonKey);
  } catch (err) {
    console.error('Invalid Supabase URL or Key:', err);
    return null;
  }
};

export const testSupabaseConnection = async (config: SupabaseConfig): Promise<{ success: boolean; message: string }> => {
  if (!config.url || !config.anonKey) {
    return { success: false, message: 'Please enter both Supabase URL and Anon Key.' };
  }

  try {
    const client = createClient(config.url, config.anonKey);
    const tableName = config.tableName || 'registration_contacts';
    
    // Try to query 1 item from the specified table
    const { data, error } = await client.from(tableName).select('id').limit(1);

    if (error) {
      // Check if table missing or permission issue
      if (error.code === '42P01') {
        return {
          success: false,
          message: `Connection established, but table '${tableName}' does not exist yet in Supabase. Use the SQL generator tab below to create it in Supabase SQL Editor!`
        };
      }
      return { success: false, message: `Supabase Error (${error.code}): ${error.message}` };
    }

    return {
      success: true,
      message: `Successfully connected to Supabase table '${tableName}'! (${data.length} records retrieved test)`
    };
  } catch (err: any) {
    return { success: false, message: `Failed to connect: ${err?.message || 'Unknown network error'}` };
  }
};

const safeBtoa = (str: string): string => {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
  } catch (e) {
    return '';
  }
};

const safeAtob = (b64: string): string => {
  try {
    return decodeURIComponent(Array.prototype.map.call(atob(b64.trim()), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  } catch (e) {
    return '';
  }
};

// A now-fixed bug in pullLeadsFromSupabase's row mapping (`...row` spread) used to leak
// raw Supabase column names (first_name, last_name, job_title, company_name,
// registration_time, approval_status, source_name, phone_number, employee_size,
// person_linkedin_url, company_linkedin_url, email_status, csv_tag) onto the app-level
// Lead object as extra properties. dedupe.ts's exact-duplicate signature treats any
// unrecognized field as a real custom CSV column and includes it — so any lead that was
// ever pulled while that bug was live got these redundant keys captured into its own
// `questions` metadata blob (see customMeta in pushLeadsToSupabase) and re-persisted on
// every subsequent push, permanently poisoning its duplicate signature even after the
// mapping itself was fixed. Stripping them back out wherever that metadata is decoded is
// what actually self-heals already-affected leads on their next read, instead of only
// stopping new contamination going forward.
const LEGACY_DB_COLUMN_KEYS = new Set([
  'first_name', 'last_name', 'job_title', 'company_name', 'registration_time',
  'approval_status', 'source_name', 'phone_number', 'employee_size', 'company_size',
  'person_linkedin_url', 'company_linkedin_url', 'email_status', 'csv_tag',
  'seniority_level', 'dept', 'sector', 'source', 'created_at', 'organization',
]);
const stripLegacyDbColumnKeys = (meta: Record<string, any>): Record<string, any> => {
  const clean: Record<string, any> = {};
  Object.keys(meta).forEach(k => {
    if (!LEGACY_DB_COLUMN_KEYS.has(k)) clean[k] = meta[k];
  });
  return clean;
};

// Columns confirmed missing from the live table's schema cache, learned during this
// browser session. Reset on saveSupabaseConfig() since a different project/table may
// have a different (or freshly-fixed) schema.
let knownMissingColumns = new Set<string>();

export const pushLeadsToSupabase = async (
  leads: Lead[],
  config?: SupabaseConfig
): Promise<{ success: boolean; count: number; error?: string }> => {
  if (!leads || leads.length === 0) {
    return { success: true, count: 0 };
  }

  const activeConfig = config || getSupabaseConfig();
  const client = getSupabaseClient(activeConfig);
  
  if (!client) {
    return { success: false, count: 0, error: 'Supabase credentials not configured.' };
  }

  const tableName = activeConfig.tableName || 'registration_contacts';

  // 1. Fetch current highest max ID from Supabase (deleted IDs are ignored!)
  let dbMaxId = 0;
  try {
    const { data: maxIdData } = await client
      .from(tableName)
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    if (maxIdData && maxIdData.length > 0 && maxIdData[0].id) {
      dbMaxId = Number(maxIdData[0].id) || 0;
    }
  } catch (e) {
    // Ignore error
  }

  // 1b. Look up existing ids for any of these emails so a contact that already exists
  // remotely never gets reassigned a fresh id: reusing its real id keeps the primary
  // key stable across re-pushes (instead of drifting upward every time) and avoids a
  // freshly-assigned id ever landing on a *different* row's actual primary key.
  const existingIdByEmail = new Map<string, number>();
  try {
    const candidateEmails = Array.from(new Set(
      leads.map(l => (l.email || '').trim().toLowerCase()).filter(e => e && e !== '-' && e.includes('@'))
    ));
    const LOOKUP_CHUNK = 200;
    for (let i = 0; i < candidateEmails.length; i += LOOKUP_CHUNK) {
      const chunk = candidateEmails.slice(i, i + LOOKUP_CHUNK);
      const { data } = await client.from(tableName).select('id, email').in('email', chunk);
      (data || []).forEach((row: any) => {
        if (row.email && row.id) existingIdByEmail.set(String(row.email).trim().toLowerCase(), Number(row.id));
      });
    }
  } catch (e) {
    // Non-fatal — falls back to assigning fresh ids for everything below
  }

  // 2. Identify custom columns present on lead objects
  const internalKeys = new Set(['_csvHeaders', 'id', 'firstName', 'lastName', 'email', 'registrationTime', 'approvalStatus', 'city', 'phone', 'organization', 'jobTitle', 'questions', 'sourceName', 'createdAt', 'isSaved', 'emailUnlocked', 'phoneUnlocked']);

  // 3. Construct exact SQL table row objects with fresh non-colliding IDs (strictly > dbMaxId)
  const seenEmails = new Map<string, number>();

  const rowsToInsert = leads.map((l, index) => {
    const rawEmail = (l.email || '').trim().toLowerCase();
    const hasValidEmail = rawEmail !== '' && rawEmail !== '-' && rawEmail !== 'undefined' && rawEmail !== 'null' && rawEmail.includes('@');
    
    let emailToInsert = rawEmail;
    if (!hasValidEmail) {
      const uniqueRand = `${index + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      emailToInsert = `contact_blank_${dbMaxId + index + 1}_${uniqueRand}@imported.com`;
    } else {
      // If two leads share the same email address, ensure BOTH leads are preserved in Supabase
      const count = seenEmails.get(rawEmail) || 0;
      seenEmails.set(rawEmail, count + 1);
      if (count > 0) {
        const parts = rawEmail.split('@');
        emailToInsert = `${parts[0]}_entry${count + 1}@${parts[1]}`;
      }
    }

    // Reuse the row's existing real id if this email already exists remotely;
    // otherwise assign a fresh incremental primary key strictly at dbMaxId + index + 1
    // (deleted lead ids are never considered for allocation).
    const existingId = hasValidEmail ? existingIdByEmail.get(rawEmail) : undefined;
    const assignedId = existingId || (dbMaxId + index + 1);

    // Extract custom/extra key-values for flexible CSV header support
    const customMeta: Record<string, string> = {};
    Object.keys(l).forEach(k => {
      if (!internalKeys.has(k) && !k.startsWith('_')) {
        const val = (l as any)[k];
        if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-') {
          customMeta[k] = String(val).trim();
        }
      }
    });

    let finalQuestions = l.questions || '';
    if (Object.keys(customMeta).length > 0) {
      const b64Meta = safeBtoa(JSON.stringify(customMeta));
      if (b64Meta) {
        const metaTag = `__META_B64__:${b64Meta}`;
        if (!finalQuestions.includes('__META_B64__:')) {
          finalQuestions = finalQuestions ? `${metaTag}\n${finalQuestions}` : metaTag;
        }
      }
    }

    const allActiveHeaders = getActiveHeaders() || ((l as any)._csvHeaders && Array.isArray((l as any)._csvHeaders) ? (l as any)._csvHeaders : null);
    if (allActiveHeaders && allActiveHeaders.length > 0) {
      const b64Headers = safeBtoa(JSON.stringify(allActiveHeaders));
      if (b64Headers) {
        const headerMeta = `__HEADERS_B64__:${b64Headers}`;
        if (!finalQuestions.includes('__HEADERS_B64__:')) {
          finalQuestions = finalQuestions ? `${headerMeta}\n${finalQuestions}` : headerMeta;
        }
      }
    }

    const row: Record<string, any> = {
      id: assignedId,
      first_name: l.firstName || '',
      last_name: l.lastName || '',
      email: emailToInsert,
      phone_number: l.phone || '',
      job_title: l.jobTitle || '',
      company_name: l.organization || '',
      organization: l.organization || '',
      city: l.city || '',
      state: l.state || '',
      country: l.country || '',
      source: l.sourceName || '-',
      source_name: l.sourceName || '-',
      email_status: l.emailStatus || 'Verified',
      seniority: l.seniority || '',
      department: l.department || '',
      industry: l.industry || '',
      employee_size: l.companySize || '',
      person_linkedin_url: l.linkedinUrl || '',
      linkedin_url: l.linkedinUrl || '',
      website: l.website || '',
      company_linkedin_url: l.companyLinkedinUrl || '',
      // Real, queryable column for the CSV tag/context (falls back to the base64-encoded
      // copy in `questions` on tables that haven't run the csv_tag migration yet — the
      // existing missing-column retry loop below drops this key and retries automatically).
      csv_tag: (l as any).csvTag ?? null,
      tags: Array.isArray((l as any).tags) && (l as any).tags.length > 0 ? JSON.stringify((l as any).tags) : null,
      // The exact-duplicate identity this row was imported under (every normalized
      // content field — tag plays NO part in it, see lib/dedupe.ts). Stored so a future
      // import's duplicate check can query Supabase directly for just the signatures it
      // needs (`.in('duplicate_signature', [...])`) instead of downloading the whole
      // table — see getExistingLeadIndexForSignatures below. Missing-column retry
      // (below) drops this automatically on tables that haven't run the migration yet.
      duplicate_signature: buildDuplicateSignature(l as any).signature || null,
      questions: finalQuestions,
      registration_time: l.registrationTime || new Date().toLocaleString(),
      approval_status: l.approvalStatus || 'approved',
      created_at: l.createdAt || new Date().toISOString()
    };

    return row;
  });

  // The email column carries the table's actual UNIQUE constraint
  // (registration_contacts_email_key) — id does not. Upserting on 'id' means any
  // contact re-pushed under a freshly-computed local id (new session, re-import,
  // different device) collides with its own earlier row's email and is rejected
  // outright (23505). Upserting on 'email' lets Supabase correctly update that
  // existing row instead.
  const UPSERT_CONFLICT_TARGET = 'email';

  // A Supabase/PostgREST "schema cache" error names exactly one missing column at a
  // time, e.g. "Could not find the 'company_linkedin_url' column of ... in the schema
  // cache". Parse it out so we can drop just that one column and retry, instead of
  // collapsing the whole batch down to a bare core set and losing every other field.
  const parseMissingColumn = (message: string | undefined): string | null => {
    if (!message) return null;
    const match = message.match(/Could not find the '([^']+)' column/);
    return match ? match[1] : null;
  };

  const omitColumn = (rows: Record<string, any>[], col: string): Record<string, any>[] =>
    rows.map(row => {
      const { [col]: _omitted, ...rest } = row;
      return rest;
    });

  // Pre-strip columns this session has already learned are missing from the live
  // table, so a table that's out of date by many columns doesn't repeat the same
  // discover-one-column-per-round-trip dance on every subsequent push.
  let batchStart = rowsToInsert;
  if (knownMissingColumns.size > 0) {
    batchStart = rowsToInsert.map(row => {
      const clean = { ...row };
      knownMissingColumns.forEach(col => { delete clean[col]; });
      return clean;
    });
  }

  const BATCH_SIZE = 500;
  let totalPushed = 0;
  let lastError = '';

  for (let i = 0; i < batchStart.length; i += BATCH_SIZE) {
    let batch = batchStart.slice(i, i + BATCH_SIZE);
    const droppedColumns = new Set<string>();
    let settled = false;

    // Retry loop: on a "missing column" schema-cache error, drop just that column and
    // try again — the live table may simply be a version or two behind the columns
    // this app knows how to write. Bounded by the column count so it can't spin forever.
    for (let attempt = 0; attempt < 25 && !settled; attempt++) {
      try {
        const { error } = await client
          .from(tableName)
          .upsert(batch, { onConflict: UPSERT_CONFLICT_TARGET });

        if (!error) {
          totalPushed += batch.length;
          settled = true;
          break;
        }

        const missingCol = parseMissingColumn(error.message);
        if (missingCol && batch[0] && Object.prototype.hasOwnProperty.call(batch[0], missingCol) && !droppedColumns.has(missingCol)) {
          console.warn(`Supabase table '${tableName}' is missing column '${missingCol}' — retrying without it. Re-run the SQL Schema Generator in the Supabase modal to add it permanently.`);
          droppedColumns.add(missingCol);
          knownMissingColumns.add(missingCol);
          batch = omitColumn(batch, missingCol);
          continue;
        }

        // Not a recognizable/fixable "missing column" error — fall back to row-by-row
        // so at least the valid rows in this batch still make it through.
        console.warn(`Supabase upsert chunk at index ${i} warning:`, error.message);
        lastError = error.message;
        for (const singleRow of batch) {
          const { error: rowErr } = await client
            .from(tableName)
            .upsert([singleRow], { onConflict: UPSERT_CONFLICT_TARGET });
          if (!rowErr) totalPushed += 1;
          else lastError = rowErr.message;
        }
        settled = true;
      } catch (err: any) {
        console.warn(`Exception during chunk push at index ${i}:`, err);
        lastError = err?.message || 'Push error';
        settled = true;
      }
    }
  }

  return { success: totalPushed > 0, count: totalPushed, error: totalPushed === 0 ? lastError : undefined };
};

export const pullLeadsFromSupabase = async (
  config?: SupabaseConfig
): Promise<{ success: boolean; leads: Lead[]; error?: string }> => {
  const activeConfig = config || getSupabaseConfig();
  const client = getSupabaseClient(activeConfig);
  
  if (!client) {
    return { success: false, leads: [], error: 'Supabase credentials not configured.' };
  }

  const tableName = activeConfig.tableName || 'registration_contacts';

  try {
    let allData: any[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    // Paginated fetch loop to retrieve any number of records (1,000, 10,000, 100,000+)
    while (hasMore) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await client
        .from(tableName)
        .select('*')
        .range(from, to)
        .order('id', { ascending: false });

      if (error) {
        if (allData.length === 0) {
          return { success: false, leads: [], error: error.message };
        }
        hasMore = false;
      } else if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allData = allData.concat(data);
        if (data.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    // Collect ALL unique headers & custom keys across ALL rows pulled from Supabase
    const allExtractedHeadersSet = new Set<string>();
    allData.forEach((row: any) => {
      const q = row.questions || '';

      if (q.includes('__HEADERS_B64__:')) {
        const match = q.match(/__HEADERS_B64__:([A-Za-z0-9+/=]+)/);
        if (match) {
          try {
            const parsed = JSON.parse(safeAtob(match[1]));
            if (Array.isArray(parsed)) parsed.forEach((h: string) => allExtractedHeadersSet.add(h));
          } catch (e) {}
        }
      } else if (q.includes('__HEADERS__:')) {
        const match = q.match(/__HEADERS__:(.+?)(\n|$)/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            if (Array.isArray(parsed)) parsed.forEach((h: string) => allExtractedHeadersSet.add(h));
          } catch (e) {}
        }
      }

      if (q.includes('__META_B64__:')) {
        const metaMatch = q.match(/__META_B64__:([A-Za-z0-9+/=]+)/);
        if (metaMatch) {
          try {
            const metaObj = JSON.parse(safeAtob(metaMatch[1]));
            Object.keys(metaObj).forEach(k => allExtractedHeadersSet.add(k));
          } catch (e) {}
        }
      } else if (q.includes('__META__:')) {
        const metaMatch = q.match(/__META__:(.+?)(\n|$)/);
        if (metaMatch) {
          try {
            const metaObj = JSON.parse(metaMatch[1]);
            Object.keys(metaObj).forEach(k => allExtractedHeadersSet.add(k));
          } catch (e) {}
        }
      }
    });

    if (allExtractedHeadersSet.size > 0) {
      setActiveHeaders(Array.from(allExtractedHeadersSet));
    }

    const mappedLeads: Lead[] = allData.map((row: any, index: number) => {
      const rawSrc = row.source_name || row.sourceName || '';
      let srcName = rawSrc ? String(rawSrc).trim().replace(/\s+/g, '-') : '-';
      if (!srcName || /^supabase|^contacts$|^export$|^leads$|^data$/i.test(srcName)) {
        srcName = '-';
      }

      let cleanEmail = row.email || '';
      if (cleanEmail.includes('_entry')) {
        cleanEmail = cleanEmail.replace(/_entry\d+_\d+@/, '@').replace(/_entry\d+@/, '@');
      } else if (cleanEmail.startsWith('contact_') && cleanEmail.includes('@imported.com')) {
        cleanEmail = '-';
      }

      let cleanQuestions = row.questions || '';
      let restoredCustomMeta: Record<string, any> = {};

      if (cleanQuestions.includes('__META_B64__:')) {
        const metaMatch = cleanQuestions.match(/__META_B64__:([A-Za-z0-9+/=]+)/);
        if (metaMatch) {
          try {
            restoredCustomMeta = stripLegacyDbColumnKeys(JSON.parse(safeAtob(metaMatch[1])));
          } catch (e) {}
        }
        cleanQuestions = cleanQuestions.replace(/__META_B64__:[A-Za-z0-9+/=]+(\n|$)/g, '').trim();
      } else if (cleanQuestions.includes('__META__:')) {
        const metaMatch = cleanQuestions.match(/__META__:(.+?)(\n|$)/);
        if (metaMatch) {
          try {
            restoredCustomMeta = stripLegacyDbColumnKeys(JSON.parse(metaMatch[1]));
          } catch (e) {}
        }
        cleanQuestions = cleanQuestions.replace(/__META__:.+?(\n|$)/g, '').trim();
      }

      if (cleanQuestions.includes('__HEADERS_B64__:')) {
        cleanQuestions = cleanQuestions.replace(/__HEADERS_B64__:[A-Za-z0-9+/=]+(\n|$)/g, '').trim();
      } else if (cleanQuestions.includes('__HEADERS__:')) {
        cleanQuestions = cleanQuestions.replace(/__HEADERS__:.+?(\n|$)/, '').trim();
      }

      return {
        // Deliberately NOT `...row` — every field this app actually uses is mapped
        // explicitly below. Spreading the raw Supabase row here used to leave its
        // snake_case columns (first_name, job_title, company_name, registration_time,
        // approval_status, source_name, phone_number, employee_size, etc.) sitting
        // alongside their camelCase equivalents on the Lead object. dedupe.ts's exact-
        // duplicate signature treats any field it doesn't recognize as a real extra CSV
        // column and includes it — so every lead pulled from Supabase carried these
        // redundant snake_case entries into its own signature, while a freshly parsed
        // CSV row never did. That mismatch is what made a lead already sitting in
        // Supabase fail to match an identical re-upload: two objects with the same real
        // content but a different set of keys hash to two different signatures. Once
        // written into a lead's `questions` metadata blob (see customMeta below) this
        // also persisted across every future pull, silently poisoning duplicate
        // detection for that lead forever.
        ...restoredCustomMeta, // Restore all custom flexible CSV key-values onto lead object!
        _csvHeaders: Array.from(allExtractedHeadersSet),
        id: index + 1, // Always assign clean sequential ID starting from 1
        firstName: row.first_name || row.firstName || '-',
        lastName: row.last_name || row.lastName || '',
        email: cleanEmail,
        phone: row.phone_number || row.phone || '',
        jobTitle: row.job_title || row.jobTitle || '',
        organization: row.company_name || row.organization || '',
        city: row.city || '',
        state: row.state || restoredCustomMeta.state || '',
        country: row.country || restoredCustomMeta.country || '',
        sourceName: row.source || srcName,
        // Prefer the real csv_tag column (tables that ran the migration); fall back to
        // the legacy base64-encoded copy restored from `questions` for older rows.
        csvTag: row.csv_tag || restoredCustomMeta.csvTag || null,
        tags: (() => {
          if (!row.tags) return undefined;
          try {
            const parsed = JSON.parse(row.tags);
            return Array.isArray(parsed) ? parsed : undefined;
          } catch {
            return undefined;
          }
        })(),
        emailStatus: row.email_status || row.emailStatus || restoredCustomMeta.emailStatus || 'Verified',
        seniority: row.seniority || row.seniority_level || restoredCustomMeta.seniority || '',
        department: row.department || row.dept || restoredCustomMeta.department || '',
        industry: row.industry || row.sector || restoredCustomMeta.industry || '',
        companySize: row.employee_size || row.company_size || row.companySize || restoredCustomMeta.companySize || '',
        linkedinUrl: row.person_linkedin_url || row.linkedin_url || row.linkedinUrl || restoredCustomMeta.linkedinUrl || '',
        website: row.website || row.url || restoredCustomMeta.website || '',
        companyLinkedinUrl: row.company_linkedin_url || restoredCustomMeta.companyLinkedinUrl || '',
        registrationTime: row.registration_time || row.registrationTime || new Date().toLocaleString(),
        approvalStatus: row.approval_status || row.approvalStatus || 'approved',
        questions: cleanQuestions,
        createdAt: row.created_at || row.createdAt || new Date().toISOString(),
        isSaved: false,
        emailUnlocked: false,
        phoneUnlocked: false
      };
    });

    return { success: true, leads: mappedLeads };
  } catch (err: any) {
    return { success: false, leads: [], error: err?.message || 'Pull operation failed' };
  }
};

export const deleteLeadFromSupabase = async (
  identifier: { email?: string; id?: number },
  config?: SupabaseConfig
): Promise<{ success: boolean; error?: string }> => {
  const activeConfig = config || getSupabaseConfig();
  const client = getSupabaseClient(activeConfig);

  if (!client) {
    return { success: false, error: 'Supabase client missing' };
  }

  const tableName = activeConfig.tableName || 'registration_contacts';
  const cleanEmail = (identifier.email || '').trim();

  // NEVER delete by `id` here: pullLeadsFromSupabase() renumbers every lead's local
  // `id` to 1..N by list position on every pull, completely disconnected from the row's
  // real Supabase primary key. Deleting `WHERE id = <local id>` deletes whatever
  // unrelated real row happens to hold that small number as its actual primary key.
  // Email carries the table's real unique constraint and is the only identifier that's
  // safe to delete by.
  try {
    if (cleanEmail && cleanEmail !== '-' && cleanEmail !== 'undefined' && cleanEmail !== 'null') {
      const { error: emailErr } = await client.from(tableName).delete().eq('email', cleanEmail);
      if (emailErr) console.warn('Supabase delete by email warn:', emailErr);
      return { success: !emailErr, error: emailErr?.message };
    }
    // No usable email to delete by (e.g. a blank-contact row whose real, synthetic
    // email was scrubbed to '-' on pull) — skip the remote delete rather than guess.
    console.warn('Skipped Supabase delete: no reliable email identifier for this lead.');
    return { success: false, error: 'No reliable email identifier to delete by' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Delete operation failed' };
  }
};

// Emails actually confirmed removed by the most recent bulkDeleteLeadsFromSupabase /
// deleteLeadsByTagFromSupabase call — callers use this to reconcile local storage
// against ONLY what Supabase actually deleted, instead of assuming every requested
// email was removed. Cheap module-level handoff; each call overwrites it immediately
// before the caller reads it, so there's no cross-call staleness risk.
let lastConfirmedDeletedEmails: Set<string> = new Set();
export const getLastConfirmedDeletedEmails = (): Set<string> => lastConfirmedDeletedEmails;

export const bulkDeleteLeadsFromSupabase = async (
  leads: Lead[],
  config?: SupabaseConfig
): Promise<{ success: boolean; count: number; error?: string }> => {
  const activeConfig = config || getSupabaseConfig();
  const client = getSupabaseClient(activeConfig);

  if (!client) {
    return { success: false, count: 0, error: 'Supabase credentials not configured.' };
  }

  const tableName = activeConfig.tableName || 'registration_contacts';
  // Deliberately NOT deleting by `id` here — see deleteLeadFromSupabase's comment.
  // Local ids are a display-order renumbering (1..N per pull), not the real primary
  // key, so `.in('id', ...)` would delete arbitrary unrelated rows.
  const emailsToDelete = leads
    .map(l => (l.email || '').trim())
    .filter(e => e && e !== '-' && e !== 'undefined' && e !== 'null');

  lastConfirmedDeletedEmails = new Set();
  if (emailsToDelete.length === 0) {
    return { success: true, count: 0 };
  }

  // Chunk the .in('email', ...) delete — a single request listing hundreds of emails
  // builds an extremely long filter URL that can silently fail (proxy/URL-length
  // limits, request timeouts) with no error surfaced by the previous unchecked call,
  // which is exactly how a bulk delete could report success while Supabase quietly
  // kept the rows, reappearing on the next reload. Checking `error` on every chunk
  // (instead of ignoring it) is the actual fix; chunking just keeps each request small
  // enough to stay reliable regardless of how large the batch is.
  const DELETE_CHUNK_SIZE = 100;
  let deletedCount = 0;
  let lastError: string | undefined;

  for (let i = 0; i < emailsToDelete.length; i += DELETE_CHUNK_SIZE) {
    const chunk = emailsToDelete.slice(i, i + DELETE_CHUNK_SIZE);
    try {
      const { data, error } = await client
        .from(tableName)
        .delete()
        .in('email', chunk)
        .select();

      if (error) {
        console.error(`Bulk delete chunk at index ${i} failed:`, error.message);
        lastError = error.message;
        continue;
      }
      (data || []).forEach((row: any) => {
        if (row.email) lastConfirmedDeletedEmails.add(String(row.email).toLowerCase());
      });
      deletedCount += (data || []).length;
    } catch (err: any) {
      console.error(`Bulk delete chunk at index ${i} threw:`, err);
      lastError = err?.message || 'Bulk delete operation failed';
    }
  }

  const allConfirmed = deletedCount === emailsToDelete.length;
  return {
    success: allConfirmed,
    count: deletedCount,
    error: allConfirmed ? undefined : (lastError || `Only ${deletedCount} of ${emailsToDelete.length} requested deletes were confirmed by Supabase.`)
  };
};

export const deleteAllLeadsFromSupabase = async (
  config?: SupabaseConfig
): Promise<{ success: boolean; error?: string }> => {
  const activeConfig = config || getSupabaseConfig();
  const client = getSupabaseClient(activeConfig);
  if (!client) return { success: false, error: 'Supabase credentials unconfigured' };

  const tableName = activeConfig.tableName || 'registration_contacts';
  try {
    const { error } = await client.from(tableName).delete().neq('id', 0);
    if (error) {
      console.warn('Delete all from Supabase warning:', error.message);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Delete all operation failed' };
  }
};

export const deleteLeadsByTagFromSupabase = async (
  tag: string,
  targetLeads?: Lead[],
  config?: SupabaseConfig
): Promise<{ success: boolean; count: number; error?: string }> => {
  const activeConfig = config || getSupabaseConfig();
  const client = getSupabaseClient(activeConfig);

  if (!client || !tag || !tag.trim()) {
    return { success: false, count: 0, error: 'Tag missing or Supabase client unconfigured' };
  }

  const tableName = activeConfig.tableName || 'registration_contacts';
  const rawTag = tag.trim();
  const normalizedTag = rawTag.toLowerCase().replace(/[-_\s]+/g, '-');

  lastConfirmedDeletedEmails = new Set();

  try {
    // Authoritative sweep — query Supabase directly for every row and decide the tag
    // match fresh against what's actually there right now, rather than trusting the
    // caller's local `targetLeads`. That local list only reflects whatever this
    // browser last pulled; if it's even slightly stale (another session added more
    // tagged rows, or this session just hasn't re-synced), rows genuinely carrying the
    // tag in Supabase but missing from local knowledge were never included in the old
    // email-based delete at all — which is exactly how a tag delete could look
    // complete yet leave real rows behind, reappearing after reload. `targetLeads` is
    // kept in the signature for backward compatibility but is no longer relied on.
    const PAGE_SIZE = 1000;
    const allRows: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await client
        .from(tableName)
        .select('id, email, source_name, questions')
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        return { success: false, count: 0, error: error.message };
      }
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const matchesTag = (row: any): boolean => {
      const src = (row.source_name || '').toLowerCase().replace(/[-_\s]+/g, '-');
      if (src === normalizedTag) return true;
      const q = row.questions || '';
      const m = q.match(/__META_B64__:([A-Za-z0-9+/=]+)/);
      if (!m) return false;
      try {
        const meta = JSON.parse(safeAtob(m[1]));
        const csvTag = String(meta.csvTag || '').toLowerCase().replace(/[-_\s]+/g, '-');
        return csvTag === normalizedTag;
      } catch {
        return false;
      }
    };

    const matchingEmails = allRows
      .filter(matchesTag)
      .map((r: any) => (r.email || '').trim())
      .filter((e: string) => e && e !== '-' && e !== 'undefined' && e !== 'null');

    if (matchingEmails.length === 0) {
      return { success: true, count: 0 };
    }

    const DELETE_CHUNK_SIZE = 100;
    let deletedCount = 0;
    let lastError: string | undefined;

    for (let i = 0; i < matchingEmails.length; i += DELETE_CHUNK_SIZE) {
      const chunk = matchingEmails.slice(i, i + DELETE_CHUNK_SIZE);
      try {
        const { data, error } = await client.from(tableName).delete().in('email', chunk).select();
        if (error) {
          console.error(`Delete by tag '${rawTag}' chunk at index ${i} failed:`, error.message);
          lastError = error.message;
          continue;
        }
        (data || []).forEach((row: any) => {
          if (row.email) lastConfirmedDeletedEmails.add(String(row.email).toLowerCase());
        });
        deletedCount += (data || []).length;
      } catch (chunkErr: any) {
        console.error(`Delete by tag '${rawTag}' chunk at index ${i} threw:`, chunkErr);
        lastError = chunkErr?.message || 'Delete operation failed';
      }
    }

    const allConfirmed = !lastError && deletedCount === matchingEmails.length;
    return {
      success: allConfirmed,
      count: deletedCount,
      error: allConfirmed ? undefined : (lastError || `Only ${deletedCount} of ${matchingEmails.length} matching records were confirmed deleted — some may remain.`)
    };
  } catch (err: any) {
    console.error(`Delete by tag '${rawTag}' failed:`, err);
    return { success: false, count: 0, error: err?.message || 'Delete operation failed' };
  }
};

const cleanSyntheticEmail = (raw: string): string => {
  let cleanEmail = raw || '';
  if (cleanEmail.includes('_entry')) {
    cleanEmail = cleanEmail.replace(/_entry\d+_\d+@/, '@').replace(/_entry\d+@/, '@');
  } else if (cleanEmail.startsWith('contact_') && cleanEmail.includes('@imported.com')) {
    cleanEmail = '';
  }
  return cleanEmail;
};

// "-" (and the other blank-placeholder strings this app writes for an empty field —
// see cleanVal/getFixedHeaderValue) is NOT a real tag value; it's just how a column with
// nothing in it gets stored. Treating it as one was a real bug: `source_name` defaults to
// literally "-" for any lead with no real source (pushLeadsToSupabase's `source_name:
// l.sourceName || '-'`), so on a table that hasn't run the csv_tag column migration yet,
// EVERY existing untagged lead was deriving tag="-" here — which never matches the "(no
// tag)" bucket a fresh untagged upload's signature actually uses (buildDuplicateSignature
// in dedupe.ts), so untagged duplicates against real existing data were silently never
// detected. This must return null for those exact same placeholders instead.
const isBlankPlaceholder = (v: string): boolean => !v || v === '-' || v === 'undefined' || v === 'null';

const extractRowTagAndExtraTags = (row: any, restoredMeta: Record<string, any>): { tag: string | null; extraTags: string[] } => {
  let tag: string | null = null;
  const csvTagCol = row.csv_tag ? String(row.csv_tag).trim() : '';
  const csvTagMeta = restoredMeta.csvTag ? String(restoredMeta.csvTag).trim() : '';
  if (!isBlankPlaceholder(csvTagCol)) tag = csvTagCol;
  else if (!isBlankPlaceholder(csvTagMeta)) tag = csvTagMeta;
  // Deliberately NO further fallback to source_name here. An earlier version of this
  // function treated a row's source_name as a stand-in tag when no real csv_tag/csvTag
  // was recorded — but sourceName is a lead's own, independent field (where THIS person
  // came from, e.g. "WhatsApp Invitation"), never the upload batch's tag identity (see
  // bulkImportLeads: "csvTag is the upload batch's own identity... independent of
  // sourceName"). Conflating the two meant a genuinely untagged lead with a real
  // sourceName derived a non-null tag here, while a fresh untagged re-upload of that
  // same lead correctly computes tag=null — two different signature buckets for what
  // should be the same one, so the duplicate was silently never detected. A row with no
  // real recorded tag now consistently resolves to null, the same "(no-tag)" bucket
  // buildDuplicateSignature uses for any untagged upload.
  let extraTags: string[] = [];
  if (row.tags) {
    try {
      const parsed = JSON.parse(row.tags);
      if (Array.isArray(parsed)) extraTags = parsed.map((t: any) => String(t).trim()).filter(Boolean);
    } catch { /* not JSON — ignore */ }
  }
  return { tag, extraTags };
};

const normalizeTagKey = (t: string): string => t.trim().toLowerCase().replace(/[-_\s]+/g, '-');

// Returns the set of normalized tags that currently have at least one LIVE lead in
// Supabase — i.e. tags that are genuinely active right now, not just tags that were
// ever used. A CSV's tag no longer having any live leads means that CSV was deleted
// (Supabase is the source of truth for "active", per the CSV-lifecycle rule — there's
// no separate stored status to go stale, since this is checked fresh on every upload).
// Returns null (not an empty set) when Supabase can't be reached, so callers can tell
// "confirmed inactive" apart from "couldn't verify" and never mistake the latter for
// the former — that would flip the deleted-CSV bug into a lost-duplicate-protection bug.
export const getActiveTagSet = async (config?: SupabaseConfig): Promise<Set<string> | null> => {
  const activeConfig = config || getSupabaseConfig();
  const client = getSupabaseClient(activeConfig);
  if (!client) return null;

  const tableName = activeConfig.tableName || 'registration_contacts';
  const active = new Set<string>();
  // PostgREST fails the WHOLE query (not just the missing field) when a named column
  // doesn't exist — e.g. a table that hasn't run the csv_tag/tags migration yet. Once
  // that's detected on the first page, every later page goes straight to `*` (which
  // only ever returns columns that actually exist) instead of re-discovering it —
  // still lets tag liveness be verified from source_name/questions alone, rather than
  // silently returning null (couldn't verify) forever.
  let useWideSelect = false;
  const fetchPage = (from: number, to: number) =>
    useWideSelect
      ? client.from(tableName).select('*').range(from, to)
      : client.from(tableName).select('csv_tag, source_name, source, tags, questions').range(from, to);

  try {
    const PAGE_SIZE = 1000;
    let from = 0;
    while (true) {
      let { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);

      if (error?.code === '42703' && !useWideSelect) {
        useWideSelect = true;
        ({ data, error } = await fetchPage(from, from + PAGE_SIZE - 1));
      }
      if (error) return null; // a real query error — don't report false "inactive"
      if (!data || data.length === 0) break;

      data.forEach((row: any) => {
        let restoredMeta: Record<string, any> = {};
        const q = row.questions || '';
        const metaMatch = q.match(/__META_B64__:([A-Za-z0-9+/=]+)/);
        if (metaMatch) {
          try { restoredMeta = stripLegacyDbColumnKeys(JSON.parse(safeAtob(metaMatch[1]))); } catch { /* ignore malformed metadata */ }
        }
        const { tag, extraTags } = extractRowTagAndExtraTags(row, restoredMeta);
        if (tag) active.add(normalizeTagKey(tag));
        extraTags.forEach(t => active.add(normalizeTagKey(t)));
      });

      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  } catch (err) {
    console.warn('getActiveTagSet failed — tag liveness could not be verified:', err);
    return null;
  }
  return active;
};

// Builds a lead-shaped object from a raw Supabase row, the same shape dedupe.ts expects
// (firstName/lastName/email/... — see buildDuplicateSignature), restoring any custom
// CSV columns that were smuggled into `questions` as base64 metadata. Shared by both the
// efficient signature-targeted lookup and its full-table-scan fallback below.
const rowToLeadShaped = (row: any): { leadShaped: Record<string, any>; tag: string | null; cleanEmail: string; leadName: string } => {
  let restoredMeta: Record<string, any> = {};
  const q = row.questions || '';
  const metaMatch = q.match(/__META_B64__:([A-Za-z0-9+/=]+)/);
  if (metaMatch) {
    try { restoredMeta = stripLegacyDbColumnKeys(JSON.parse(safeAtob(metaMatch[1]))); } catch { /* ignore malformed metadata */ }
  }

  const { tag } = extractRowTagAndExtraTags(row, restoredMeta);
  const cleanEmail = cleanSyntheticEmail(row.email || '');

  const leadShaped: Record<string, any> = {
    ...restoredMeta,
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    email: cleanEmail,
    phone: row.phone_number || '',
    jobTitle: row.job_title || '',
    organization: row.company_name || row.organization || '',
    city: row.city || '',
    state: row.state || '',
    country: row.country || '',
    sourceName: row.source_name || row.source || '',
    emailStatus: row.email_status || '',
    seniority: row.seniority || '',
    department: row.department || '',
    industry: row.industry || '',
    companySize: row.employee_size || '',
    linkedinUrl: row.person_linkedin_url || row.linkedin_url || '',
    website: row.website || '',
    companyLinkedinUrl: row.company_linkedin_url || '',
    approvalStatus: row.approval_status || '',
  };

  const leadName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || cleanEmail || 'Unknown lead';
  return { leadShaped, tag, cleanEmail, leadName };
};

// FALLBACK ONLY — used when the live table hasn't run the `duplicate_signature` column
// migration yet. Downloads every row and recomputes each one's signature client-side so
// duplicate detection still works pre-migration, just without the efficient path below.
// `neededSignatures` still bounds memory use (only matches this batch could actually hit
// are kept), even though the download itself can't be narrowed without the column.
const getExistingLeadIndexFullScan = async (
  neededSignatures: Set<string>,
  activeConfig: SupabaseConfig
): Promise<Map<string, ExistingRecordRef>> => {
  const index = new Map<string, ExistingRecordRef>();
  const client = getSupabaseClient(activeConfig);
  if (!client) return index;

  const tableName = activeConfig.tableName || 'registration_contacts';

  try {
    const PAGE_SIZE = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await client
        .from(tableName)
        .select('*')
        .range(from, from + PAGE_SIZE - 1);
      if (error || !data || data.length === 0) break;

      data.forEach((row: any) => {
        const { leadShaped, cleanEmail, leadName } = rowToLeadShaped(row);
        const { signature } = buildDuplicateSignature(leadShaped);
        if (!signature || !neededSignatures.has(signature)) return;
        index.set(signature, { signature, leadName, email: cleanEmail });
      });

      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  } catch (err) {
    console.warn('getExistingLeadIndexFullScan failed — proceeding without the cross-Supabase half of duplicate detection:', err);
  }

  return index;
};

// The "compare against existing Supabase records" half of the exact-duplicate rule (see
// lib/dedupe.ts) — given the signatures THIS batch actually needs to check, queries
// Supabase directly for just those rows (`duplicate_signature IN (...)`, chunked and
// indexed) instead of downloading the whole table. This is what keeps a 1,000-row table
// costing roughly "1 new row's worth" of lookup work when importing 1 new lead, per the
// efficiency requirement — never proportional to total existing leads.
// Best-effort: on any failure this returns an empty map rather than throwing, so a
// duplicate-check hiccup never blocks an import — it only means the cross-Supabase half
// of the check was skipped for this run (still backed by the within-batch check, which
// never depends on network access).
export const getExistingLeadIndexForSignatures = async (
  signatures: string[],
  config?: SupabaseConfig
): Promise<Map<string, ExistingRecordRef>> => {
  const index = new Map<string, ExistingRecordRef>();
  const uniqueSigs = Array.from(new Set(signatures.filter(Boolean)));
  if (uniqueSigs.length === 0) return index;

  const activeConfig = config || getSupabaseConfig();
  const client = getSupabaseClient(activeConfig);
  if (!client) return index;

  const tableName = activeConfig.tableName || 'registration_contacts';
  const CHUNK = 200;

  try {
    // NOTE: an earlier version of this function ran a `head: true` count precheck here
    // to detect a not-yet-backfilled duplicate_signature column before trusting the
    // indexed query below. Verified against a real Supabase/PostgREST instance, a
    // `head: true` request returns no body, so a missing-column error on it comes back
    // as `{ message: '' }` with NO `.code` field — the precheck's own error handling
    // could never actually recognize it, so it silently did nothing (real query errors
    // are handled correctly). Removed rather than left in as dead/misleading code —
    // the loop below's own 42703 handling on the main (non-head) query is what actually
    // catches a missing column, and that DOES return a real error code, confirmed live.
    for (let i = 0; i < uniqueSigs.length; i += CHUNK) {
      const chunk = uniqueSigs.slice(i, i + CHUNK);
      const { data, error } = await client
        .from(tableName)
        .select('first_name, last_name, email, duplicate_signature')
        .in('duplicate_signature', chunk);

      if (error?.code === '42703') {
        // duplicate_signature column doesn't exist yet (migration not run on this table)
        // — fall back to the full-table scan so duplicate detection still works, just
        // less efficiently, until the SQL migration is applied.
        return getExistingLeadIndexFullScan(new Set(uniqueSigs), activeConfig);
      }
      if (error) return index; // a real query error — don't silently report zero matches as "no duplicates"

      (data || []).forEach((row: any) => {
        const signature = row.duplicate_signature;
        if (!signature) return;
        const cleanEmail = cleanSyntheticEmail(row.email || '');
        const leadName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || cleanEmail || 'Unknown lead';
        index.set(signature, { signature, leadName, email: cleanEmail });
      });
    }
  } catch (err) {
    console.warn('getExistingLeadIndexForSignatures failed — proceeding without the cross-Supabase half of duplicate detection:', err);
  }

  return index;
};

export const generateSupabaseSQL = (tableName: string = 'registration_contacts'): string => {

  return `-- Copy and run this SQL script in your Supabase Project SQL Editor (https://supabase.com/dashboard/project/_/sql):
-- This script creates/updates your table and ensures IDs start sequentially from 1 (1, 2, 3...)

-- 1. Create table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS public.${tableName} (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE NOT NULL,
  phone_number TEXT,
  job_title TEXT,
  company_name TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  source TEXT,
  email_status TEXT DEFAULT 'Verified',
  seniority TEXT,
  department TEXT,
  industry TEXT,
  employee_size TEXT,
  person_linkedin_url TEXT,
  website TEXT,
  company_linkedin_url TEXT,
  questions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add missing columns to existing tables automatically
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS organization TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS source_name TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'Verified';
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS seniority TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS employee_size TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS person_linkedin_url TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS company_linkedin_url TEXT;
-- csv_tag: the CSV upload's own tag/context as a real, queryable column (previously
-- only smuggled inside the questions column as base64 metadata). Purely additive;
-- existing rows just get csv_tag = NULL until re-synced. NOTE: tag plays NO part in
-- whether a lead counts as a duplicate (see lib/dedupe.ts) — this column is for tag-name
-- uniqueness checks and tag-based search/filter/delete, entirely separate concerns.
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS csv_tag TEXT;
-- tags: additional tag memberships beyond the original csv_tag (JSON array as text),
-- e.g. '["Prospects","Investors"]'.
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS tags TEXT;
-- duplicate_signature: this row's exact-duplicate identity — every normalized content
-- field, deliberately NOT including tag (see lib/dedupe.ts) — computed and stored on
-- every import so a future import's duplicate check can query Supabase directly for
-- just the signatures it needs instead of downloading the whole table. Purely additive;
-- existing rows get duplicate_signature = NULL until they're re-synced (re-push, or any
-- edit that round-trips the row), at which point it's filled in automatically.
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS duplicate_signature TEXT;
CREATE INDEX IF NOT EXISTS ${tableName}_duplicate_signature_idx ON public.${tableName} (duplicate_signature);

-- 2b. Make sure email actually carries the unique constraint the app upserts against
-- (safe to re-run; no-ops if it's already there under this name). This is intentionally
-- email-only, not (email, csv_tag) — since tag plays no part in the app's own
-- duplicate rule, a lead sharing an email with an existing one is always the same
-- duplicate lead regardless of tag, so there is no case where the database needs to
-- allow two rows with the same email to coexist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = '${tableName}_email_key'
  ) THEN
    ALTER TABLE public.${tableName} ADD CONSTRAINT ${tableName}_email_key UNIQUE (email);
  END IF;
END $$;

-- 3. Allow explicit ID insertion starting from 1
ALTER TABLE public.${tableName} ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS id BIGINT;

-- 3. Enable Row Level Security (RLS) & Public Access Policies
ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.${tableName};
DROP POLICY IF EXISTS "Allow public insert access" ON public.${tableName};
DROP POLICY IF EXISTS "Allow public update access" ON public.${tableName};
DROP POLICY IF EXISTS "Allow public delete access" ON public.${tableName};

CREATE POLICY "Allow public read access" ON public.${tableName} FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.${tableName} FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.${tableName} FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.${tableName} FOR DELETE USING (true);

-- OPTIONAL: If your existing table in Supabase has rows with old IDs (e.g. 1000+),
-- run this single line to re-number all existing rows starting from 1 (1, 2, 3...):
-- UPDATE public.${tableName} SET id = sub.new_id FROM (SELECT ctid, ROW_NUMBER() OVER (ORDER BY created_at ASC) as new_id FROM public.${tableName}) sub WHERE public.${tableName}.ctid = sub.ctid;
`;
};
