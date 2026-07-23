import { Lead, Filters, FilterOptions } from '../types.ts';
import { initialLeads } from './initialLeads.ts';

const STORAGE_KEY = 'apollo_leads_v4';

// Get leads from localStorage, initializing with default initialLeads if empty or outdated
export const getStoredLeads = (): Lead[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data !== null) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 5) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading leads from localStorage:', err);
  }
  // Default initialize with initialLeads
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

// Get unique filter options for sidebar dropdowns
export const getFilterOptions = (): FilterOptions => {
  const leads = getStoredLeads();
  const getUniqueClean = (fn: (l: Lead) => string | null | undefined): string[] => {
    const set = new Set<string>();
    leads.forEach(l => {
      const val = fn(l);
      if (val && val.trim() !== '') {
        set.add(val.trim());
      }
    });
    return Array.from(set).sort();
  };

  return {
    jobTitles: getUniqueClean(l => l.jobTitle),
    companies: getUniqueClean(l => l.organization),
    cities: getUniqueClean(l => l.city),
    sources: getUniqueClean(l => l.sourceName),
    statuses: getUniqueClean(l => l.approvalStatus),
  };
};

// Filter leads based on filter criteria
export const filterLeads = (leads: Lead[], filters: Filters): Lead[] => {
  return leads.filter(l => {
    // 1. Search Query
    if (filters.search && filters.search.trim()) {
      const query = filters.search.trim().toLowerCase();
      const fullName = `${l.firstName || ''} ${l.lastName || ''}`.toLowerCase();
      const email = (l.email || '').toLowerCase();
      const org = (l.organization || '').toLowerCase();
      const title = (l.jobTitle || '').toLowerCase();
      const city = (l.city || '').toLowerCase();

      const matches =
        fullName.includes(query) ||
        email.includes(query) ||
        org.includes(query) ||
        title.includes(query) ||
        city.includes(query);

      if (!matches) return false;
    }

    // 2. Job Titles
    if (filters.jobTitles && filters.jobTitles.length > 0) {
      if (!l.jobTitle || !filters.jobTitles.includes(l.jobTitle)) return false;
    }

    // 3. Companies
    if (filters.companies && filters.companies.length > 0) {
      if (!l.organization || !filters.companies.includes(l.organization)) return false;
    }

    // 4. Cities
    if (filters.cities && filters.cities.length > 0) {
      if (!l.city || !filters.cities.includes(l.city)) return false;
    }

    // 5. Sources
    if (filters.sources && filters.sources.length > 0) {
      if (!l.sourceName || !filters.sources.includes(l.sourceName)) return false;
    }

    // 6. Approval Statuses
    if (filters.statuses && filters.statuses.length > 0) {
      if (!l.approvalStatus || !filters.statuses.includes(l.approvalStatus)) return false;
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
  }
  return updatedLead;
};

// Delete Lead
export const deleteLead = (id: number): void => {
  const allLeads = getStoredLeads();
  const updated = allLeads.filter(l => l.id !== id);
  saveStoredLeads(updated);
};

// Bulk Delete Leads
export const bulkDeleteLeads = (ids: number[]): void => {
  const allLeads = getStoredLeads();
  const idSet = new Set(ids);
  const updated = allLeads.filter(l => !idSet.has(l.id));
  saveStoredLeads(updated);
};

// Bulk Import Leads
export const bulkImportLeads = (newLeadsList: Partial<Lead>[]): number => {
  const allLeads = getStoredLeads();
  let maxId = allLeads.length > 0 ? Math.max(...allLeads.map(l => l.id)) : 0;

  const createdLeads: Lead[] = newLeadsList.map(item => {
    maxId += 1;
    return {
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

  saveStoredLeads([...createdLeads, ...allLeads]);
  return createdLeads.length;
};
