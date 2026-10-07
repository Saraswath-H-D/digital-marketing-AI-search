import { CustomICP } from '../types.ts';

const STORAGE_KEY = 'operon_custom_icps_v1';

let memoryIcpCache: CustomICP[] | null = null;

// Same in-memory-cache-first local storage pattern as companyStorage.ts's
// getStoredCompanies/saveStoredCompanies — works offline, survives reload.
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

  return icp;
};

export const deleteCustomICP = async (id: number): Promise<{ error?: string }> => {
  const all = getStoredCustomICPs();
  saveStoredCustomICPs(all.filter(i => i.id !== id));
  return {};
};
