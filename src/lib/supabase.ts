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

  // 1. Fetch current max ID from Supabase to prevent primary key collisions on large bulk pushes
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
    // Ignore if table query fails initially
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
      // Ignore if RPC function not created in Supabase yet
    }
  }

  // 4. Construct exact SQL table row objects with guaranteed non-colliding IDs
  const rowsToInsert = leads.map((l, index) => {
    const rawEmail = (l.email || '').trim();
    const hasValidEmail = rawEmail !== '' && rawEmail !== '-' && rawEmail !== 'undefined' && rawEmail !== 'null' && rawEmail.includes('@');
    const uniqueRand = `${index + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const emailToInsert = hasValidEmail 
      ? rawEmail 
      : `contact_${l.id || index + 1}_${uniqueRand}@imported.com`;

    const assignedId = (l.id && Number(l.id) > dbMaxId) ? Number(l.id) : (dbMaxId + index + 1);

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

    // Attach custom column values matching column names
    Object.keys(l).forEach(k => {
      if (!internalKeys.has(k) && !k.startsWith('_')) {
        const sqlCol = k.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const val = (l as any)[k];
        if (sqlCol && val !== undefined && val !== null) {
          row[sqlCol] = String(val);
        }
      }
    });

    return row;
  });

  // Deduplicate rows by email to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time"
  const emailMap = new Map<string, Record<string, any>>();
  rowsToInsert.forEach(r => {
    const key = String(r.email).toLowerCase();
    emailMap.set(key, r);
  });
  const dedupedRows = Array.from(emailMap.values());

  const BATCH_SIZE = 200;
  let totalPushed = 0;
  let lastError = '';

  for (let i = 0; i < dedupedRows.length; i += BATCH_SIZE) {
    const batch = dedupedRows.slice(i, i + BATCH_SIZE);

    try {
      // Attempt 1: Upsert with onConflict: 'email'
      const { data, error } = await client
        .from(tableName)
        .upsert(batch, { onConflict: 'email' })
        .select();

      if (error) {
        console.warn(`Supabase upsert batch chunk starting at index ${i} warning:`, error.message);
        lastError = error.message;

        if (error.code === '42P01') {
          return { success: false, count: totalPushed, error: `Table '${tableName}' does not exist in Supabase. Please run the SQL schema generator in Supabase SQL Editor.` };
        }
        if (error.code === '42501') {
          return { success: false, count: totalPushed, error: `Row Level Security (RLS) blocked insert on table '${tableName}'. Ensure public insert policy is enabled.` };
        }
        
        // Fallback: Sanitize to standard columns
        const cleanBatch = batch.map(r => ({
          id: r.id,
          first_name: r.first_name,
          last_name: r.last_name,
          email: r.email,
          registration_time: r.registration_time,
          approval_status: r.approval_status,
          city: r.city,
          phone: r.phone,
          organization: r.organization,
          job_title: r.job_title,
          questions: r.questions,
          source_name: r.source_name,
          created_at: r.created_at
        }));

        // Attempt 2: Standard column upsert with onConflict
        const { data: retryData, error: retryErr } = await client
          .from(tableName)
          .upsert(cleanBatch, { onConflict: 'email' })
          .select();

        if (retryErr) {
          // Attempt 3: Simple insert if upsert/onConflict failed
          const { data: insertData, error: insertErr } = await client
            .from(tableName)
            .insert(cleanBatch)
            .select();

          if (insertErr) {
            console.error(`Chunk starting at ${i} insert failed:`, insertErr.message);
            lastError = insertErr.message;
          } else {
            totalPushed += insertData ? insertData.length : cleanBatch.length;
          }
        } else {
          totalPushed += retryData ? retryData.length : cleanBatch.length;
        }
      } else {
        totalPushed += data ? data.length : batch.length;
      }
    } catch (err: any) {
      console.error(`Chunk batch at ${i} error:`, err);
      lastError = err?.message || 'Chunk error';
    }
  }

  return { 
    success: totalPushed > 0 || dedupedRows.length === 0, 
    count: totalPushed,
    error: totalPushed === 0 && dedupedRows.length > 0 ? lastError || 'Push operation failed' : undefined
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
        const org = (row.organization || '').trim();
        const isBlank = (fn === '' || fn === '-') && (ln === '' || ln === '-') && (em === '' || em === '-') && (org === '' || org === '-');
        return !isBlank;
      })
      .map((row: any, index: number) => {
      const rawSrc = row.source_name || row.sourceName || '';
      let srcName = rawSrc ? String(rawSrc).trim().replace(/\s+/g, '-') : '-';
      if (!srcName || /^supabase|^contacts$|^export$|^leads$|^data$/i.test(srcName)) {
        srcName = '-';
      }

      return {
        ...row, // Preserve any custom database columns!
        id: index + 1, // Always assign clean sequential ID starting from 1
        firstName: row.first_name || row.firstName || 'Unknown',
        lastName: row.last_name || row.lastName || '',
        email: row.email || '',
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
  const emailsToDelete = leads
    .map(l => (l.email || '').trim())
    .filter(e => e && e !== '-' && e !== 'undefined' && e !== 'null');

  try {
    let deletedCount = 0;
    if (emailsToDelete.length > 0) {
      const { data, error } = await client
        .from(tableName)
        .delete()
        .in('email', emailsToDelete)
        .select();

      if (error) {
        console.warn('Bulk delete from Supabase warning:', error.message);
        return { success: false, count: 0, error: error.message };
      }
      deletedCount = data ? data.length : emailsToDelete.length;
    }
    return { success: true, count: deletedCount };
  } catch (err: any) {
    console.error('Bulk delete from Supabase failed:', err);
    return { success: false, count: 0, error: err?.message || 'Bulk delete operation failed' };
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
