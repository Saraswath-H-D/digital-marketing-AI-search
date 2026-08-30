import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Lead } from '../types.ts';
import { setActiveHeaders, getActiveHeaders } from '../data/leadStorage.ts';

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
            restoredCustomMeta = JSON.parse(safeAtob(metaMatch[1]));
          } catch (e) {}
        }
        cleanQuestions = cleanQuestions.replace(/__META_B64__:[A-Za-z0-9+/=]+(\n|$)/g, '').trim();
      } else if (cleanQuestions.includes('__META__:')) {
        const metaMatch = cleanQuestions.match(/__META__:(.+?)(\n|$)/);
        if (metaMatch) {
          try {
            restoredCustomMeta = JSON.parse(metaMatch[1]);
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
        ...row,
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

  try {
    let deletedCount = 0;
    if (emailsToDelete.length > 0) {
      const { data } = await client
        .from(tableName)
        .delete()
        .in('email', emailsToDelete)
        .select();

      if (data) deletedCount += data.length;
    }
    return { success: true, count: deletedCount };
  } catch (err: any) {
    console.error('Bulk delete from Supabase failed:', err);
    return { success: false, count: 0, error: err?.message || 'Bulk delete operation failed' };
  }
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
  const cleanTagHyphen = rawTag.replace(/\s+/g, '-');
  const cleanTagSpace = rawTag.replace(/-/g, ' ');

  try {
    let deletedCount = 0;

    // Tier 1: Delete by email of matching leads if provided. Deliberately NOT deleting
    // by `id` — see deleteLeadFromSupabase's comment: local ids are a display-order
    // renumbering, not the real primary key, so `.in('id', ...)` would delete
    // arbitrary unrelated rows.
    if (targetLeads && targetLeads.length > 0) {
      const emails = targetLeads
        .map(l => (l.email || '').trim())
        .filter(e => e && e !== '-' && e !== 'undefined' && e !== 'null');

      if (emails.length > 0) {
        const { data } = await client.from(tableName).delete().in('email', emails).select();
        if (data) deletedCount += data.length;
      }
    }

    // Tier 2: Flexible case-insensitive query on source_name column ONLY for specific non-generic tags
    const isGenericTag = !rawTag || rawTag === '-' || rawTag === 'all' || rawTag === 'default' || rawTag === 'contacts' || rawTag === 'export' || rawTag === 'leads';
    if (!isGenericTag) {
      const filterQuery = `source_name.ilike.${cleanTagHyphen},source_name.ilike.${cleanTagSpace},source_name.ilike.${rawTag}`;
      const { data, error } = await client
        .from(tableName)
        .delete()
        .or(filterQuery)
        .select();

      if (!error && data) {
        deletedCount += data.length;
      }
    }

    return { success: true, count: deletedCount };
  } catch (err: any) {
    console.error(`Delete by tag '${rawTag}' failed:`, err);
    return { success: false, count: 0, error: err?.message || 'Delete operation failed' };
  }
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

-- 2b. Make sure email actually carries the unique constraint the app upserts against
-- (safe to re-run; no-ops if it's already there under this name)
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
