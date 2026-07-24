import { Lead, Filters, FilterOptions } from '../types.ts';
import { initialLeads } from './initialLeads.ts';
import { pushLeadsToSupabase, deleteLeadFromSupabase } from '../lib/supabase.ts';

const STORAGE_KEY = 'apollo_leads_v4';
const HEADERS_KEY = 'apollo_active_headers';

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

// Get leads from localStorage, initializing with default initialLeads if empty or outdated
export const getStoredLeads = (): Lead[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data !== null) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading leads from localStorage:', err);
  }
  // Default initialize with initialLeads only on first load
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialLeads));
  return initialLeads;
};



// Save leads array to localStorage
export const saveStoredLeads = (leads: Lead[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  } catch (err) {
    console.error('Error writing leads to localStorage:', err);
  }
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

  // Extract unique filter options for custom CSV columns
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

    // 1. Search Query across ALL dynamic CSV fields
    if (filters.search && filters.search.trim()) {
      const query = filters.search.trim().toLowerCase();
      const matches = Object.values(leadObj).some(val => 
        val !== null && val !== undefined && String(val).toLowerCase().includes(query)
      );
      if (!matches) return false;
    }

    // 2. Job Titles / Roles
    if (filters.jobTitles && filters.jobTitles.length > 0) {
      const vals = extractFieldValues(leadObj, ['jobtitle', 'title', 'role', 'designation', 'position', 'occupation']);
      if (!vals.some(v => filters.jobTitles.includes(v))) return false;
    }

    // 3. Companies / Organizations
    if (filters.companies && filters.companies.length > 0) {
      const vals = extractFieldValues(leadObj, ['organization', 'company', 'employer', 'business', 'org', 'firm']);
      if (!vals.some(v => filters.companies.includes(v))) return false;
    }

    // 4. Cities / Locations
    if (filters.cities && filters.cities.length > 0) {
      const vals = extractFieldValues(leadObj, ['city', 'location', 'town', 'country', 'state', 'address', 'region']);
      if (!vals.some(v => filters.cities.includes(v))) return false;
    }

    // 5. Sources
    if (filters.sources && filters.sources.length > 0) {
      const vals = extractFieldValues(leadObj, ['sourcename', 'source', 'leadsource']);
      if (!vals.some(v => filters.sources.includes(v))) return false;
    }

    // 6. Approval Statuses
    if (filters.statuses && filters.statuses.length > 0) {
      const vals = extractFieldValues(leadObj, ['approvalstatus', 'status', 'approved', 'state']);
      if (!vals.some(v => filters.statuses.includes(v))) return false;
    }

    // 6.5 Dynamic CSV Custom Filters
    if (filters.customFilters) {
      for (const [col, selectedVals] of Object.entries(filters.customFilters)) {
        if (selectedVals && selectedVals.length > 0) {
          const val = (leadObj[col] !== undefined && leadObj[col] !== null) ? String(leadObj[col]).trim() : '';
          if (!selectedVals.includes(val)) return false;
        }
      }
    }



    // 7. Saved Only
    if (filters.savedOnly && !l.isSaved) {
      return false;
    }

    // 8. Net New Only
    if (filters.netNewOnly && l.isSaved) {
      return false;
    }

    // 9. Persona Filter
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

    // 10. Email Status Filter
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
  // Filter base leads (excluding savedOnly / netNewOnly flags for broad count calculation)
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

// Add New Lead
export const addLead = (newLeadData: Partial<Lead>): Lead => {
  const allLeads = getStoredLeads();
  const nextId = allLeads.length > 0 ? Math.max(...allLeads.map(l => l.id)) + 1 : 1;

  const lead: Lead = {
    id: nextId,
    firstName: newLeadData.firstName || 'Unknown',
    lastName: newLeadData.lastName || '',
    email: newLeadData.email || '',
    registrationTime: new Date().toLocaleString(),
    approvalStatus: newLeadData.approvalStatus || 'approved',
    city: newLeadData.city || '',
    phone: newLeadData.phone || '',
    organization: newLeadData.organization || '',
    jobTitle: newLeadData.jobTitle || '',
    questions: newLeadData.questions || '',
    sourceName: newLeadData.sourceName || 'Manual Entry',
    createdAt: new Date().toISOString(),
    isSaved: false,
    emailUnlocked: false,
    phoneUnlocked: false,
  };

  const updated = [lead, ...allLeads];
  saveStoredLeads(updated);

  // Real-time automatic background sync to Supabase
  pushLeadsToSupabase([lead]).catch(err => console.error('Auto-sync to Supabase failed:', err));

  return lead;
};

// Update Existing Lead
export const updateLead = (id: number, updateData: Partial<Lead>): Lead | null => {
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
    // Real-time automatic background sync to Supabase
    pushLeadsToSupabase([updatedLead]).catch(err => console.error('Auto-sync to Supabase failed:', err));
  }
  return updatedLead;
};

// Delete Lead
export const deleteLead = (id: number): void => {
  const allLeads = getStoredLeads();
  const target = allLeads.find(l => l.id === id);
  const updated = allLeads.filter(l => l.id !== id);
  saveStoredLeads(updated);

  if (target) {
    deleteLeadFromSupabase({ email: target.email, id: target.id }).catch(err => console.error('Delete sync to Supabase failed:', err));
  }
};

// Bulk Delete Leads
export const bulkDeleteLeads = (ids: number[]): void => {
  const allLeads = getStoredLeads();
  const idSet = new Set(ids);
  const targets = allLeads.filter(l => idSet.has(l.id));
  const updated = allLeads.filter(l => !idSet.has(l.id));
  saveStoredLeads(updated);

  targets.forEach(t => {
    deleteLeadFromSupabase({ email: t.email, id: t.id }).catch(err => console.error('Delete sync to Supabase failed:', err));
  });
};


// Bulk Import Leads
export const bulkImportLeads = (newLeadsList: Partial<Lead>[]): number => {
  const allLeads = getStoredLeads();
  let maxId = allLeads.length > 0 ? Math.max(...allLeads.map(l => l.id)) : 0;

  const createdLeads: Lead[] = newLeadsList.map(item => {
    maxId += 1;
    return {
      ...item, // Preserve _csvHeaders and all original CSV column header fields
      id: maxId,
      firstName: item.firstName || 'Unknown',
      lastName: item.lastName || '',
      email: item.email || '',
      registrationTime: item.registrationTime || new Date().toLocaleString(),
      approvalStatus: item.approvalStatus || 'approved',
      city: item.city || '',
      phone: item.phone || '',
      organization: item.organization || '',
      jobTitle: item.jobTitle || '',
      questions: item.questions || '',
      sourceName: item.sourceName || 'CSV Import',
      createdAt: new Date().toISOString(),
      isSaved: false,
      emailUnlocked: false,
      phoneUnlocked: false,
    };
  });

  if (newLeadsList.length > 0 && (newLeadsList[0] as any)._csvHeaders) {
    setActiveHeaders((newLeadsList[0] as any)._csvHeaders);
  }

  saveStoredLeads([...createdLeads, ...allLeads]);

  // Real-time automatic background sync to Supabase
  pushLeadsToSupabase(createdLeads).catch(err => console.error('Auto-sync import to Supabase failed:', err));

  return createdLeads.length;
};


