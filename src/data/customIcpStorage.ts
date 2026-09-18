import { CustomICP } from '../types.ts';
import {
  pushCustomICPToSupabase,
  pullCustomICPsFromSupabase,
  deleteCustomICPFromSupabase,
  getSupabaseConfig,
} from '../lib/supabase.ts';

const STORAGE_KEY = 'operon_custom_icps_v1';

let memoryIcpCache: CustomICP[] | null = null;

// Same in-memory-cache-first local storage pattern as companyStorage.ts's
// getStoredCompanies/saveStoredCompanies — works offline, survives reload without a
// Supabase round-trip.
export const getStoredCustomICPs = (): CustomICP[] => {
  if (memoryIcpCache !== null) return memoryIcpCache;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data !== null) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        memoryIcpCache = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading custom ICPs from localStorage:', err);
  }
  memoryIcpCache = [];
  return [];
};

export const saveStoredCustomICPs = (icps: CustomICP[]): void => {
  memoryIcpCache = icps;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(icps));
  } catch (err) {
    console.warn('LocalStorage quota limit reached while saving custom ICPs:', err);
  }
};

// Pull the latest saved ICPs from Supabase into the local cache — call this once on
// mount (e.g. when the Saved ICPs modal opens) so a saved ICP created on another
// device/session shows up here too.
export const syncCustomICPsFromSupabase = async (): Promise<CustomICP[]> => {
  try {
    const pull = await pullCustomICPsFromSupabase();
    if (pull.success) {
      saveStoredCustomICPs(pull.icps);
      return pull.icps;
    }
  } catch (err) {
    console.warn('Custom ICP sync from Supabase failed — using local cache:', err);
  }
  return getStoredCustomICPs();
};

export const addCustomICP = async (data: { name: string; jobTitles: string[]; industries: string[] }): Promise<CustomICP> => {
  const all = getStoredCustomICPs();
  const maxId = all.length > 0 ? Math.max(...all.map(i => i.id)) : 0;

  const icp: CustomICP = {
    id: maxId + 1,
    name: data.name.trim(),
    jobTitles: data.jobTitles || [],
    industries: data.industries || [],
    createdAt: new Date().toISOString(),
  };

  saveStoredCustomICPs([icp, ...all]);

  if (getSupabaseConfig().autoSync) {
    try {
      const result = await pushCustomICPToSupabase(icp);
      if (result.success) {
        // Re-sync so the locally-generated id gets replaced by Supabase's real one,
        // same reconciliation reasoning as bulkImportCompanies.
        await syncCustomICPsFromSupabase();
      }
    } catch (err) {
      console.error('Auto-sync add custom ICP to Supabase failed:', err);
    }
  }

  return icp;
};

export const deleteCustomICP = async (id: number): Promise<{ error?: string }> => {
  const all = getStoredCustomICPs();
  let error: string | undefined;
  try {
    const result = await deleteCustomICPFromSupabase(id);
    if (!result.success) error = result.error;
  } catch (err: any) {
    error = err?.message || 'Delete sync to Supabase failed';
  }
  saveStoredCustomICPs(all.filter(i => i.id !== id));
  return { error };
};
