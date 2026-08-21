import { Lead, Filters, FilterOptions } from '../types.ts';
import { initialLeads } from './initialLeads.ts';
import { pushLeadsToSupabase, deleteLeadFromSupabase, bulkDeleteLeadsFromSupabase } from '../lib/supabase.ts';

const STORAGE_KEY = 'apollo_leads_v9';
const HEADERS_KEY = 'apollo_active_headers';
const TRASH_KEY = 'apollo_deleted_trash_v1';
const DELETED_HISTORY_KEY = 'apollo_deleted_history_v1';

// Immediate cleanup of any legacy blank lead rows from localStorage
(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((l: any) => {
          const fn = String(l.firstName || '').trim();
          const ln = String(l.lastName || '').trim();
          const em = String(l.email || '').trim();
          const org = String(l.organization || '').trim();
          const isBlank = (fn === '' || fn === '-') && (ln === '' || ln === '-') && (em === '' || em === '-') && (org === '' || org === '-');
          return !isBlank;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      }
    }
  } catch (err) {
    console.error('Initial cleanup error:', err);
  }
})();

export const getActiveHeaders = (): string[] | null => {
  try {
    const raw = localStorage.getItem(HEADERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading active headers:', err);
  }
  return null;
};

export const setActiveHeaders = (headers: string[]): void => {
  try {
    localStorage.setItem(HEADERS_KEY, JSON.stringify(headers));
  } catch (err) {
    console.error('Error writing active headers:', err);
  }
};

const cleanVal = (val: any) => {
  if (val === undefined || val === null) return '-';
  const str = String(val).trim();
  return (str === '' || str === 'undefined' || str === 'null') ? '-' : str;
};

// Helper to repair/sanitize leads if name was previously defaulted to 'Contact'
const sanitizeLead = (l: any): Lead => {
  let fName = l.firstName ? String(l.firstName).trim() : '';
  let lName = l.lastName ? String(l.lastName).trim() : '';

  if (!fName || fName === '-' || fName.toLowerCase() === 'contact' || fName.toLowerCase() === 'unknown') {
    const keys = Object.keys(l);
    const nameKey = keys.find(k => ['full name', 'fullname', 'contact name', 'contact', 'contacts', 'attendee name', 'name'].includes(k.toLowerCase().trim()));
    if (nameKey && l[nameKey] && String(l[nameKey]).trim() && String(l[nameKey]).toLowerCase().trim() !== 'contact') {
      const full = String(l[nameKey]).trim();
      const parts = full.split(/\s+/);
      fName = parts[0] || '';
      lName = parts.slice(1).join(' ');
    } else if (l.email && l.email.includes('@')) {
      const username = l.email.split('@')[0];
      const cleanUser = username.replace(/[^a-zA-Z0-9._-]/g, '');
      const parts = cleanUser.split(/[._-]/).filter((p: string) => p && !/^\d+$/.test(p));
      if (parts.length > 0) {
        fName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        if (parts.length > 1 && (!lName || lName === '-')) {
          lName = parts.slice(1).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        }
      }
    }
  }

  if (fName && (!lName || lName === '-') && fName.includes(' ')) {
    const parts = fName.split(/\s+/);
    fName = parts[0] || '';
    lName = parts.slice(1).join(' ');
  }

  let srcName = l.sourceName ? String(l.sourceName).trim() : '';
  if (!srcName || /^contacts$|^export$|^leads$|^data$|^apollo_.*export|^supabase/i.test(srcName)) {
    srcName = '-';
  } else {
    srcName = srcName.replace(/\s+/g, '-');
  }

  return {
    ...l,
    firstName: cleanVal(fName),
    lastName: cleanVal(lName),
    email: cleanVal(l.email),
    organization: cleanVal(l.organization),
    jobTitle: cleanVal(l.jobTitle),
    city: cleanVal(l.city),
    phone: cleanVal(l.phone),
    approvalStatus: cleanVal(l.approvalStatus || 'approved'),
    sourceName: srcName,
    registrationTime: cleanVal(l.registrationTime),
    questions: cleanVal(l.questions),
    emailUnlocked: false,
    phoneUnlocked: false,
  };
};

// Get leads from localStorage & purge any blank (- - -) junk rows
export const getStoredLeads = (): Lead[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data !== null) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const validOnly = parsed.filter(l => {
          const fn = (l.firstName || '').trim();
          const ln = (l.lastName || '').trim();
          const em = (l.email || '').trim();
          const org = (l.organization || '').trim();
          const isBlank = (fn === '' || fn === '-') && (ln === '' || ln === '-') && (em === '' || em === '-') && (org === '' || org === '-');
          return !isBlank;
        });

        return validOnly.map((l, idx) => ({
          ...sanitizeLead(l),
          id: idx + 1
        }));
      }
    }
  } catch (err) {
    console.error('Error reading leads from localStorage:', err);
  }
  const sanitizedDefaults = initialLeads.map((l, idx) => ({
    ...sanitizeLead(l),
    id: idx + 1
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedDefaults));
  return sanitizedDefaults;
};

// Save leads array to localStorage
export const saveStoredLeads = (leads: Lead[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  } catch (err) {
    console.error('Error writing leads to localStorage:', err);
  }
};

// Trash & Historical Deletion Vault Storage Helpers
export const getTrashLeads = (): Lead[] => {
  try {
    const data = localStorage.getItem(TRASH_KEY);
    if (data) return JSON.parse(data);
  } catch (err) {
    console.error('Error reading trash:', err);
  }
  return [];
};

export const saveTrashLeads = (leads: Lead[]): void => {
  try {
    localStorage.setItem(TRASH_KEY, JSON.stringify(leads));
  } catch (err) {
    console.error('Error writing trash:', err);
  }
};

export const getDeletedHistory = (): Lead[] => {
  try {
    const data = localStorage.getItem(DELETED_HISTORY_KEY);
    if (data) return JSON.parse(data);
  } catch (err) {
    console.error('Error reading deleted history:', err);
  }
  return [];
};

export const addLeadsToDeletedHistory = (leads: Lead[]): void => {
  try {
    const current = getDeletedHistory();
    const map = new Map<string, Lead>();
    [...leads, ...current].forEach(l => {
      const key = l.email && l.email !== '-' ? `email:${l.email.toLowerCase()}` : `key:${(l.firstName || '').toLowerCase()}_${(l.lastName || '').toLowerCase()}_${(l.organization || '').toLowerCase()}`;
      if (!map.has(key)) map.set(key, l);
    });
    localStorage.setItem(DELETED_HISTORY_KEY, JSON.stringify(Array.from(map.values())));
  } catch (err) {
    console.error('Error writing deleted history:', err);
  }
};

export const addLeadsToTrash = (leads: Lead[]): void => {
  const current = getTrashLeads();
  const map = new Map<string, Lead>();
  [...leads, ...current].forEach(l => {
    const key = l.email && l.email !== '-' ? `email:${l.email.toLowerCase()}` : `key:${(l.firstName || '').toLowerCase()}_${(l.lastName || '').toLowerCase()}_${(l.organization || '').toLowerCase()}`;
    if (!map.has(key)) map.set(key, l);
  });
  saveTrashLeads(Array.from(map.values()));
  addLeadsToDeletedHistory(leads);
};

// Helper to extract values from standard OR dynamic custom keys
const extractFieldValues = (l: any, aliases: string[]): string[] => {
  const values: string[] = [];
  Object.keys(l).forEach(k => {
    const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (aliases.some(a => cleanK.includes(a))) {
      const val = l[k];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        values.push(String(val).trim());
      }
    }
  });
  return values;
};

// Get unique filter options for sidebar dropdowns dynamically
export const getFilterOptions = (): FilterOptions => {
  const leads = getStoredLeads();
  
  const getUniqueForAliases = (aliases: string[]): string[] => {
    const set = new Set<string>();
    leads.forEach(l => {
      const vals = extractFieldValues(l, aliases);
      vals.forEach(v => set.add(v));
    });
    return Array.from(set).sort();
  };

  const activeHeaders = getActiveHeaders();
  const customFilterMap: Record<string, string[]> = {};

  if (activeHeaders && activeHeaders.length > 0) {
    activeHeaders.forEach(col => {
      const cleanCol = col.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isStandardAlias = ['jobtitle', 'title', 'role', 'designation', 'organization', 'company', 'employer', 'city', 'location', 'town', 'country', 'sourcename', 'source', 'approvalstatus', 'status', 'email', 'name', 'phone', 'firstname', 'lastname'].some(a => cleanCol.includes(a));
      
      if (!isStandardAlias) {
        const valSet = new Set<string>();
        leads.forEach(l => {
          const val = (l as any)[col];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            valSet.add(String(val).trim());
          }
        });
        if (valSet.size > 0 && valSet.size <= 50) {
          customFilterMap[col] = Array.from(valSet).sort();
        }
      }
    });
  }

  return {
    jobTitles: getUniqueForAliases(['jobtitle', 'title', 'role', 'designation', 'position', 'occupation']),
    companies: getUniqueForAliases(['organization', 'company', 'employer', 'business', 'org', 'firm']),
    cities: getUniqueForAliases(['city', 'location', 'town', 'country', 'state', 'address', 'region']),
    sources: getUniqueForAliases(['sourcename', 'source', 'leadsource']),
    statuses: getUniqueForAliases(['approvalstatus', 'status', 'approved', 'state']),
    customFilters: customFilterMap,
  };
};

// Filter leads based on filter criteria dynamically
export const filterLeads = (leads: Lead[], filters: Filters): Lead[] => {
  return leads.filter(l => {
    const leadObj = l as any;

    if (filters.search && filters.search.trim()) {
      const query = filters.search.trim().toLowerCase();
      const matches = Object.values(leadObj).some(val => 
        val !== null && val !== undefined && String(val).toLowerCase().includes(query)
      );
      if (!matches) return false;
    }

    if (filters.jobTitles && filters.jobTitles.length > 0) {
      const vals = extractFieldValues(leadObj, ['jobtitle', 'title', 'role', 'designation', 'position', 'occupation']);
      const lowerSelected = filters.jobTitles.map(t => t.toLowerCase());
      if (!vals.some(v => lowerSelected.includes(v.toLowerCase()))) return false;
    }

    if (filters.companies && filters.companies.length > 0) {
      const vals = extractFieldValues(leadObj, ['organization', 'company', 'employer', 'business', 'org', 'firm']);
      const lowerSelected = filters.companies.map(c => c.toLowerCase());
      if (!vals.some(v => lowerSelected.includes(v.toLowerCase()))) return false;
    }

    if (filters.cities && filters.cities.length > 0) {
      const vals = extractFieldValues(leadObj, ['city', 'location', 'town', 'country', 'state', 'address', 'region']);
      const lowerSelected = filters.cities.map(c => c.toLowerCase());
      if (!vals.some(v => lowerSelected.includes(v.toLowerCase()))) return false;
    }

    if (filters.sources && filters.sources.length > 0) {
      const vals = extractFieldValues(leadObj, ['sourcename', 'source', 'leadsource']);
      const lowerSelected = filters.sources.map(s => s.toLowerCase());
      if (!vals.some(v => lowerSelected.includes(v.toLowerCase()))) return false;
    }

    if (filters.statuses && filters.statuses.length > 0) {
      const vals = extractFieldValues(leadObj, ['approvalstatus', 'status', 'approved', 'state']);
      const lowerSelected = filters.statuses.map(s => s.toLowerCase());
      if (!vals.some(v => lowerSelected.includes(v.toLowerCase()))) return false;
    }

    if (filters.customFilters) {
      for (const [col, selectedVals] of Object.entries(filters.customFilters)) {
        if (selectedVals && selectedVals.length > 0) {
          const val = (leadObj[col] !== undefined && leadObj[col] !== null) ? String(leadObj[col]).trim().toLowerCase() : '';
          const lowerSelected = selectedVals.map(sv => sv.toLowerCase());
          if (!lowerSelected.includes(val)) return false;
        }
      }
    }

    if (filters.savedOnly && !l.isSaved) {
      return false;
    }

    if (filters.netNewOnly && l.isSaved) {
      return false;
    }

    if (filters.persona) {
      const title = (l.jobTitle || '').toLowerCase();
      if (filters.persona === 'Founders & Executives') {
        const isExec = ['ceo', 'founder', 'director', 'partner', 'proprietor', 'executive', 'gm', 'vp'].some(k => title.includes(k));
        if (!isExec) return false;
      } else if (filters.persona === 'Finance Leaders') {
        const isFinance = ['finance', 'cfo', 'treasury', 'accounts'].some(k => title.includes(k));
        if (!isFinance) return false;
      } else if (filters.persona === 'Auditors & Accountants') {
        const isAuditor = ['accountant', 'auditor', 'audit', 'tax', 'ca'].some(k => title.includes(k));
        if (!isAuditor) return false;
      }
    }

    if (filters.emailStatuses && filters.emailStatuses.length > 0) {
      const emailLower = (l.email || '').toLowerCase();
      let matchEmailStatus = false;

      if (filters.emailStatuses.includes('Valid / Safe')) {
        if (l.approvalStatus !== 'denied' && !emailLower.includes('bounce') && !emailLower.includes('invalid')) {
          matchEmailStatus = true;
        }
      }
      if (filters.emailStatuses.includes('Risky / Catch-all')) {
        if (emailLower.includes('risky') || emailLower.includes('catch')) {
          matchEmailStatus = true;
        }
      }
      if (filters.emailStatuses.includes('Invalid / Bounce')) {
        if (l.approvalStatus === 'denied' || emailLower.includes('bounce') || emailLower.includes('invalid')) {
          matchEmailStatus = true;
        }
      }

      if (!matchEmailStatus) return false;
    }

    return true;
  });
};

// Calculate Lead Stats (Total, Net New, Saved)
export const getLeadStats = (filters: Filters): { total: number; netNew: number; saved: number } => {
  const allLeads = getStoredLeads();
  const baseFiltered = filterLeads(allLeads, { ...filters, savedOnly: false, netNewOnly: false });

  const total = baseFiltered.length;
  const saved = baseFiltered.filter(l => l.isSaved).length;
  const netNew = total - saved;

  return { total, netNew, saved };
};

// Toggle Lead Saved status
export const toggleSaveLead = (leadId: number): Lead[] => {
  const allLeads = getStoredLeads();
  const updated = allLeads.map(l => l.id === leadId ? { ...l, isSaved: !l.isSaved } : l);
  saveStoredLeads(updated);
  return updated;
};

// Unlock Lead Email
export const unlockLeadEmail = (leadId: number): Lead[] => {
  const allLeads = getStoredLeads();
  const updated = allLeads.map(l => l.id === leadId ? { ...l, emailUnlocked: true } : l);
  saveStoredLeads(updated);
  return updated;
};

// Unlock Lead Phone
export const unlockLeadPhone = (leadId: number): Lead[] => {
  const allLeads = getStoredLeads();
  const updated = allLeads.map(l => l.id === leadId ? { ...l, phoneUnlocked: true } : l);
  saveStoredLeads(updated);
  return updated;
};

// Bulk Unlock Emails
export const bulkUnlockEmails = (ids: number[]): Lead[] => {
  const allLeads = getStoredLeads();
  const idSet = new Set(ids);
  const updated = allLeads.map(l => idSet.has(l.id) ? { ...l, emailUnlocked: true } : l);
  saveStoredLeads(updated);
  return updated;
};

// Add New Lead with guaranteed non-blank name
export const addLead = async (newLeadData: Partial<Lead>): Promise<Lead> => {
  const allLeads = getStoredLeads();
  const maxId = allLeads.length > 0 ? Math.max(...allLeads.map(l => Number(l.id) || 0)) : 0;
  const nextId = maxId + 1;

  let fName = cleanVal(newLeadData.firstName);
  let lName = cleanVal(newLeadData.lastName);
  const emailVal = cleanVal(newLeadData.email);

  if (fName === '-' || fName === '') {
    if (emailVal !== '-' && emailVal.includes('@')) {
      const username = emailVal.split('@')[0].replace(/[^a-zA-Z]/g, ' ');
      const parts = username.trim().split(/\s+/).filter(Boolean);
      if (parts.length > 0) {
        fName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        if (parts.length > 1 && lName === '-') {
          lName = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        }
      }
    }
    if (fName === '-' || fName === '') {
      fName = 'Contact';
    }
  }

  const lead: Lead = {
    id: nextId,
    firstName: fName,
    lastName: lName,
    email: emailVal,
    registrationTime: new Date().toLocaleString(),
    approvalStatus: cleanVal(newLeadData.approvalStatus || 'approved'),
    city: cleanVal(newLeadData.city),
    phone: cleanVal(newLeadData.phone),
    organization: cleanVal(newLeadData.organization),
    jobTitle: cleanVal(newLeadData.jobTitle),
    questions: cleanVal(newLeadData.questions),
    sourceName: newLeadData.sourceName && String(newLeadData.sourceName).trim() ? String(newLeadData.sourceName).trim().replace(/\s+/g, '-') : 'Manual-Entry',
    createdAt: new Date().toISOString(),
    isSaved: false,
    emailUnlocked: false,
    phoneUnlocked: false,
  };

  const updated = [lead, ...allLeads];
  saveStoredLeads(updated);

  try {
    await pushLeadsToSupabase([lead]);
  } catch (err) {
    console.error('Auto-sync add to Supabase failed:', err);
  }

  return lead;
};

// Update Existing Lead
export const updateLead = async (id: number, updateData: Partial<Lead>): Promise<Lead | null> => {
  const allLeads = getStoredLeads();
  let updatedLead: Lead | null = null;

  const updated = allLeads.map(l => {
    if (l.id === id) {
      updatedLead = { ...l, ...updateData };
      return updatedLead;
    }
    return l;
  });

  if (updatedLead) {
    saveStoredLeads(updated);
    try {
      await pushLeadsToSupabase([updatedLead]);
    } catch (err) {
      console.error('Auto-sync update to Supabase failed:', err);
    }
  }
  return updatedLead;
};

// Delete Lead (with automatic Trash backup)
export const deleteLead = async (id: number): Promise<void> => {
  const allLeads = getStoredLeads();
  const target = allLeads.find(l => l.id === id);
  const updated = allLeads.filter(l => l.id !== id);
  saveStoredLeads(updated);

  if (target) {
    addLeadsToTrash([target]);
    try {
      await deleteLeadFromSupabase({ email: target.email, id: target.id });
    } catch (err) {
      console.error('Delete sync to Supabase failed:', err);
    }
  }
};

// Bulk Delete Leads (with automatic Trash backup)
export const bulkDeleteLeads = async (ids: number[]): Promise<void> => {
  const allLeads = getStoredLeads();
  const idSet = new Set(ids);
  const targets = allLeads.filter(l => idSet.has(l.id));
  const updated = allLeads.filter(l => !idSet.has(l.id));
  saveStoredLeads(updated);

  if (targets.length > 0) {
    addLeadsToTrash(targets);
    try {
      await bulkDeleteLeadsFromSupabase(targets);
    } catch (err) {
      console.error('Bulk delete sync to Supabase failed:', err);
    }
  }
};

// Strict Zero-Repetition Restore Deleted Leads from Trash or Specific Candidates
export const restoreLeadsFromTrash = async (specificLeads?: Lead[]): Promise<{ updatedLeads: Lead[]; restoredCount: number; restoredList: Lead[] }> => {
  const trash = specificLeads && specificLeads.length > 0 ? specificLeads : getTrashLeads();
  if (trash.length === 0) {
    const current = getStoredLeads();
    return { updatedLeads: current, restoredCount: 0, restoredList: [] };
  }

  const allLeads = getStoredLeads();

  const activeEmails = new Set(allLeads.map(l => (l.email || '').toLowerCase()).filter(e => e && e !== '-'));
  const activeKeys = new Set(allLeads.map(l => `${(l.firstName || '').toLowerCase()}_${(l.lastName || '').toLowerCase()}_${(l.organization || '').toLowerCase()}`));

  const uniqueCandidatesMap = new Map<string, Lead>();
  trash.forEach(l => {
    const key = l.email && l.email !== '-' ? `email:${l.email.toLowerCase()}` : `name:${(l.firstName || '').toLowerCase()}_${(l.lastName || '').toLowerCase()}_${(l.organization || '').toLowerCase()}`;
    if (!uniqueCandidatesMap.has(key)) {
      uniqueCandidatesMap.set(key, l);
    }
  });

  const uniqueCandidates = Array.from(uniqueCandidatesMap.values());

  const trulyMissingToRestore = uniqueCandidates.filter(l => {
    const emailLower = (l.email || '').toLowerCase();
    if (emailLower && emailLower !== '-' && activeEmails.has(emailLower)) {
      return false;
    }
    const nameKey = `${(l.firstName || '').toLowerCase()}_${(l.lastName || '').toLowerCase()}_${(l.organization || '').toLowerCase()}`;
    if (activeKeys.has(nameKey)) {
      return false;
    }
    return true;
  });

  if (trulyMissingToRestore.length === 0) {
    saveTrashLeads([]);
    return { updatedLeads: allLeads, restoredCount: 0, restoredList: [] };
  }

  let maxId = allLeads.length > 0 ? Math.max(...allLeads.map(l => Number(l.id) || 0)) : 0;

  const restoredLeadsWithFreshIds: Lead[] = trulyMissingToRestore.map(item => {
    maxId += 1;
    return {
      ...item,
      id: maxId
    };
  });

  const updatedLeads = [...restoredLeadsWithFreshIds, ...allLeads];
  saveStoredLeads(updatedLeads);
  saveTrashLeads([]);

  try {
    await pushLeadsToSupabase(restoredLeadsWithFreshIds);
  } catch (err) {
    console.error('Restore sync to Supabase failed:', err);
  }

  return {
    updatedLeads,
    restoredCount: restoredLeadsWithFreshIds.length,
    restoredList: restoredLeadsWithFreshIds
  };
};

// Bulk Import Leads
export const bulkImportLeads = async (
  newLeadsList: Partial<Lead>[]
): Promise<{ count: number; supabaseResult: { success: boolean; count: number; error?: string } }> => {
  const allLeads = getStoredLeads();
  let maxId = allLeads.length > 0 ? Math.max(...allLeads.map(l => l.id)) : 0;

  const createdLeads: Lead[] = newLeadsList.map(item => {
    maxId += 1;
    return {
      ...item,
      id: maxId,
      firstName: cleanVal(item.firstName),
      lastName: cleanVal(item.lastName),
      email: cleanVal(item.email),
      registrationTime: cleanVal(item.registrationTime),
      approvalStatus: cleanVal(item.approvalStatus || 'approved'),
      city: cleanVal(item.city),
      phone: cleanVal(item.phone),
      organization: cleanVal(item.organization),
      jobTitle: cleanVal(item.jobTitle),
      questions: cleanVal(item.questions),
      sourceName: item.sourceName && String(item.sourceName).trim() ? String(item.sourceName).trim().replace(/\s+/g, '-') : '-',
      createdAt: new Date().toISOString(),
      isSaved: false,
      emailUnlocked: true,
      phoneUnlocked: true,
    };
  });

  if (newLeadsList.length > 0 && (newLeadsList[0] as any)._csvHeaders) {
    setActiveHeaders((newLeadsList[0] as any)._csvHeaders);
  }

  saveStoredLeads([...createdLeads, ...allLeads]);

  let supabaseResult: { success: boolean; count: number; error?: string } = { success: false, count: 0, error: 'No leads created' };
  if (createdLeads.length > 0) {
    try {
      supabaseResult = await pushLeadsToSupabase(createdLeads);
    } catch (err: any) {
      console.error('Auto-sync import to Supabase failed:', err);
      supabaseResult = { success: false, count: 0, error: err?.message || 'Sync failed' };
    }
  }

  return {
    count: createdLeads.length,
    supabaseResult
  };
};
