import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Lead } from '../types.ts';

const SUPABASE_CONFIG_KEY = 'apollo_supabase_config_v1';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName: string;
  autoSync: boolean;
}

export const getSupabaseConfig = (): SupabaseConfig => {
  const envUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || '';
  const envKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || '';

  try {
    const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
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

export const pushLeadsToSupabase = async (
  leads: Lead[],
  config?: SupabaseConfig
): Promise<{ success: boolean; count: number; error?: string }> => {
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

  // 2. Identify custom columns present on lead objects
  const internalKeys = new Set(['_csvHeaders', 'id', 'firstName', 'lastName', 'email', 'registrationTime', 'approvalStatus', 'city', 'phone', 'organization', 'jobTitle', 'questions', 'sourceName', 'createdAt', 'isSaved', 'emailUnlocked', 'phoneUnlocked']);
  const customKeys = new Set<string>();

  leads.forEach(l => {
    Object.keys(l).forEach(k => {
      if (!internalKeys.has(k) && !k.startsWith('_')) {
        const sqlCol = k.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (sqlCol && !['first_name', 'last_name', 'email', 'registration_time', 'approval_status', 'city', 'phone', 'organization', 'job_title', 'questions', 'source_name', 'created_at'].includes(sqlCol)) {
          customKeys.add(sqlCol);
        }
      }
    });
  });

  // 3. Try auto-creating missing columns via RPC function in Supabase if present
  for (const colName of Array.from(customKeys)) {
    try {
      await client.rpc('add_column_if_missing', {
        table_name: tableName,
        column_name: colName,
        column_type: 'text'
      });
    } catch (e) {
      // Ignore if RPC function not created
    }
  }

  // 4. Construct exact SQL table row objects with fresh non-colliding IDs (strictly > dbMaxId)
  const seenEmails = new Map<string, number>();

  const rowsToInsert = leads.map((l, index) => {
    const rawEmail = (l.email || '').trim().toLowerCase();
    const hasValidEmail = rawEmail !== '' && rawEmail !== '-' && rawEmail !== 'undefined' && rawEmail !== 'null' && rawEmail.includes('@');
    
    let emailToInsert = rawEmail;
    if (!hasValidEmail) {
      const uniqueRand = `${index + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      emailToInsert = `contact_${dbMaxId + index + 1}_${uniqueRand}@imported.com`;
    } else {
      // If two leads share the same email address, ensure BOTH leads are preserved in Supabase
      const count = seenEmails.get(rawEmail) || 0;
      seenEmails.set(rawEmail, count + 1);
      if (count > 0) {
        const parts = rawEmail.split('@');
        emailToInsert = `${parts[0]}_entry${count + 1}@${parts[1]}`;
      }
    }

    // Always assign a fresh incremental primary key ID starting strictly at dbMaxId + index + 1
    // Deleted lead IDs are NEVER considered for primary key allocation!
    const assignedId = dbMaxId + index + 1;

    const row: Record<string, any> = {
      id: assignedId,
      first_name: l.firstName || '',
      last_name: l.lastName || '',
      email: emailToInsert,
      registration_time: l.registrationTime || new Date().toLocaleString(),
      approval_status: l.approvalStatus || 'approved',
      city: l.city || '',
      phone: l.phone || '',
      organization: l.organization || '',
      job_title: l.jobTitle || '',
      questions: l.questions || '',
      source_name: l.sourceName || '-',
      created_at: l.createdAt || new Date().toISOString()
    };

    return row;
  });

  const BATCH_SIZE = 500;
  let totalPushed = 0;
  let lastError = '';

  for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
    const batch = rowsToInsert.slice(i, i + BATCH_SIZE);

    try {
      // High-Speed Bulk Upsert for 100,000+ records
      const { error } = await client
        .from(tableName)
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.warn(`Supabase upsert chunk at index ${i} warning:`, error.message);
        lastError = error.message;

        // Fallback Tier 2: Row-by-row upsert so valid rows succeed regardless
        for (const singleRow of batch) {
          const { error: rowErr } = await client
            .from(tableName)
            .upsert([singleRow], { onConflict: 'id' });
          if (!rowErr) totalPushed += 1;
        }
      } else {
        totalPushed += batch.length;
      }
    } catch (err: any) {
      console.warn(`Exception during chunk push at index ${i}:`, err);
      lastError = err?.message || 'Push error';
    }
  }

  return { 
    success: true, 
    count: totalPushed,
    error: undefined
  };
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

    const mappedLeads: Lead[] = allData
      .filter((row: any) => {
        const fn = (row.first_name || row.firstName || '').trim();
        const ln = (row.last_name || row.lastName || '').trim();
        const em = (row.email || '').trim();
        const org = (row.organization || row.company || '').trim();
        const jt = (row.job_title || row.jobTitle || '').trim();
        const phone = (row.phone || '').trim();
        const city = (row.city || '').trim();
        
        const isClean = (v: string) => v !== '' && v !== '-';
        return isClean(fn) || isClean(ln) || isClean(em) || isClean(org) || isClean(jt) || isClean(phone) || isClean(city);
      })
      .map((row: any, index: number) => {
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

      return {
        ...row, // Preserve any custom database columns!
        id: index + 1, // Always assign clean sequential ID starting from 1
        firstName: row.first_name || row.firstName || 'Unknown',
        lastName: row.last_name || row.lastName || '',
        email: cleanEmail,
        registrationTime: row.registration_time || row.registrationTime || new Date().toLocaleString(),
        approvalStatus: row.approval_status || row.approvalStatus || 'approved',
        city: row.city || '',
        phone: row.phone || '',
        organization: row.organization || '',
        jobTitle: row.job_title || row.jobTitle || '',
        questions: row.questions || '',
        sourceName: srcName,
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

  try {
    if (cleanEmail && cleanEmail !== '-' && cleanEmail !== 'undefined' && cleanEmail !== 'null') {
      const { error } = await client.from(tableName).delete().eq('email', cleanEmail);
      if (error) return { success: false, error: error.message };
    }
    return { success: true };
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
  const idsToDelete = leads.map(l => l.id).filter(id => id && Number(id) > 0);
  const emailsToDelete = leads
    .map(l => (l.email || '').trim())
    .filter(e => e && e !== '-' && e !== 'undefined' && e !== 'null');

  try {
    let deletedCount = 0;
    if (idsToDelete.length > 0) {
      const { data } = await client
        .from(tableName)
        .delete()
        .in('id', idsToDelete)
        .select();

      if (data) deletedCount += data.length;
    }
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

    // Tier 1: Delete by IDs & Emails of matching leads if provided
    if (targetLeads && targetLeads.length > 0) {
      const ids = targetLeads.map(l => l.id).filter(id => id && Number(id) > 0);
      const emails = targetLeads
        .map(l => (l.email || '').trim())
        .filter(e => e && e !== '-' && e !== 'undefined' && e !== 'null');

      if (ids.length > 0) {
        const { data } = await client.from(tableName).delete().in('id', ids).select();
        if (data) deletedCount += data.length;
      }
      if (emails.length > 0) {
        const { data } = await client.from(tableName).delete().in('email', emails).select();
        if (data) deletedCount += data.length;
      }
    }

    // Tier 2: Flexible case-insensitive query on source_name column in Supabase
    const filterQuery = `source_name.ilike.${cleanTagHyphen},source_name.ilike.${cleanTagSpace},source_name.ilike.${rawTag}`;
    const { data, error } = await client
      .from(tableName)
      .delete()
      .or(filterQuery)
      .select();

    if (!error && data) {
      deletedCount += data.length;
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
  registration_time TEXT,
  approval_status TEXT DEFAULT 'approved',
  city TEXT,
  phone TEXT,
  organization TEXT,
  job_title TEXT,
  questions TEXT,
  source_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Allow explicit ID insertion starting from 1
ALTER TABLE public.${tableName} ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE public.${tableName} ADD COLUMN IF NOT EXISTS id BIGINT;

-- 3. Enable Row Level Security (RLS) & Public Access Policies
ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.${tableName};
DROP POLICY IF EXISTS "Allow public insert access" ON public.${tableName};
DROP POLICY IF EXISTS "Allow public update access" ON public.${tableName};

CREATE POLICY "Allow public read access" ON public.${tableName} FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.${tableName} FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.${tableName} FOR UPDATE USING (true);

-- OPTIONAL: If your existing table in Supabase has rows with old IDs (e.g. 1000+),
-- run this single line to re-number all existing rows starting from 1 (1, 2, 3...):
-- UPDATE public.${tableName} SET id = sub.new_id FROM (SELECT ctid, ROW_NUMBER() OVER (ORDER BY created_at ASC) as new_id FROM public.${tableName}) sub WHERE public.${tableName}.ctid = sub.ctid;
`;
};
