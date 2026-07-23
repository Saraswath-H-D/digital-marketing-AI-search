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
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
  const envKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';

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

  // Map Apollo Lead object to SQL table row format
  const rowsToInsert = leads.map(l => ({
    first_name: l.firstName,
    last_name: l.lastName,
    email: l.email,
    registration_time: l.registrationTime,
    approval_status: l.approvalStatus,
    city: l.city,
    phone: l.phone,
    organization: l.organization,
    job_title: l.jobTitle,
    questions: l.questions,
    source_name: l.sourceName,
    created_at: l.createdAt || new Date().toISOString()
  }));

  try {
    // Upsert into Supabase on email match
    const { data, error } = await client
      .from(tableName)
      .upsert(rowsToInsert, { onConflict: 'email' })
      .select();

    if (error) {
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: data ? data.length : rowsToInsert.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || 'Push operation failed' };
  }
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
    const { data, error } = await client
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, leads: [], error: error.message };
    }

    if (!data) {
      return { success: true, leads: [] };
    }

    const mappedLeads: Lead[] = data.map((row: any, index: number) => ({
      id: row.id || index + 1000,
      firstName: row.first_name || 'Unknown',
      lastName: row.last_name || '',
      email: row.email || '',
      registrationTime: row.registration_time || new Date().toLocaleString(),
      approvalStatus: row.approval_status || 'approved',
      city: row.city || '',
      phone: row.phone || '',
      organization: row.organization || '',
      jobTitle: row.job_title || '',
      questions: row.questions || '',
      sourceName: row.source_name || 'Supabase Sync',
      createdAt: row.created_at || new Date().toISOString(),
      isSaved: false,
      emailUnlocked: false,
      phoneUnlocked: false
    }));

    return { success: true, leads: mappedLeads };
  } catch (err: any) {
    return { success: false, leads: [], error: err?.message || 'Pull operation failed' };
  }
};

export const generateSupabaseSQL = (tableName: string = 'registration_contacts'): string => {
  return `-- Copy and run this SQL script in your Supabase Project SQL Editor:
-- Go to: https://supabase.com/dashboard/project/_/sql

CREATE TABLE IF NOT EXISTS public.${tableName} (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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

-- Enable Row Level Security (RLS)
ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;

-- Allow anonymous select & insert/upsert permissions for quick setup:
CREATE POLICY "Allow public read access" ON public.${tableName} FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.${tableName} FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.${tableName} FOR UPDATE USING (true);
`;
};
