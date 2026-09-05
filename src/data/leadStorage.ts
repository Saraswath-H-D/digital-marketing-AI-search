import { Lead, Filters, FilterOptions } from '../types.ts';
import { initialLeads } from './initialLeads.ts';
import { pushLeadsToSupabase, pullLeadsFromSupabase, deleteLeadFromSupabase, bulkDeleteLeadsFromSupabase, deleteLeadsByTagFromSupabase, deleteAllLeadsFromSupabase, getSupabaseConfig, getLastConfirmedDeletedEmails, getExistingLeadIndexForSignatures } from '../lib/supabase.ts';
import { dedupeLeadRows, buildDuplicateSignature } from '../lib/dedupe.ts';

const STORAGE_KEY = 'operon_leads_v9';
const LEGACY_STORAGE_KEY = 'apollo_leads_v9';
const HEADERS_KEY = 'operon_active_headers';
const LEGACY_HEADERS_KEY = 'apollo_active_headers';
const TRASH_KEY = 'operon_deleted_trash_v1';
const DELETED_HISTORY_KEY = 'operon_deleted_history_v1';
const CSV_TAGS_KEY = 'operon_csv_upload_tags_v2';
const LEGACY_CSV_TAGS_KEY = 'apollo_csv_upload_tags_v2';

// Independent CSV Upload Tag Storage Registry
export const getStoredCsvTags = (): string[] => {
  try {
    const data = localStorage.getItem(CSV_TAGS_KEY) || localStorage.getItem(LEGACY_CSV_TAGS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter(t => t && t !== '-' && t.trim() !== '');
      }
    }
  } catch (err) {
    console.error('Error reading CSV upload tags:', err);
  }
  return [];
};

export const addCsvTag = (tag: string): void => {
  if (!tag || !tag.trim() || tag.trim() === '-') return;
  const clean = tag.trim().replace(/\s+/g, '-');
  const current = getStoredCsvTags();
  if (!current.some(t => t.toLowerCase() === clean.toLowerCase())) {
    const updated = [clean, ...current];
    try {
      localStorage.setItem(CSV_TAGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Error writing CSV tag:', e);
    }
  }
};

export const removeCsvTag = (tag: string): void => {
  if (!tag || !tag.trim()) return;
  const clean = tag.trim().replace(/\s+/g, '-').toLowerCase();
  const current = getStoredCsvTags();
  const updated = current.filter(t => t.toLowerCase() !== clean);
  try {
    localStorage.setItem(CSV_TAGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Error removing CSV tag:', e);
  }
};

// Immediate cleanup of any legacy blank lead rows from localStorage
(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
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

// Fixed, canonical column schema for the app. This NEVER changes based on what CSV is
// uploaded — every incoming file's own column names are synonym-mapped onto this exact
// list (see CsvImporter's SYSTEM_FIELDS + autoDetectColumn), so the table columns, CSV
// export, and Supabase header metadata stay identical no matter which file was imported.
export const FIXED_HEADERS: string[] = [
  'First Name', 'Last Name', 'Email', 'Phone Number', 'Job Title', 'Company Name',
  'City', 'State', 'Country', 'Source', 'Email Status', 'Seniority', 'Department',
  'Industry', 'Employee Size', 'Person Linkedin Url', 'Website', 'Company Linkedin Url'
];

// Exact 1:1 mapping from a fixed header label to its Lead field value (used by CSV
// export & Supabase header metadata so columns can never drift or be mis-mapped).
export const getFixedHeaderValue = (lead: Lead, header: string): string => {
  const v = (val: any) => {
    if (val === undefined || val === null) return '-';
    const str = String(val).trim();
    return (str === '' || str === 'undefined' || str === 'null') ? '-' : str;
  };
  switch (header) {
    case 'First Name': return v(lead.firstName);
    case 'Last Name': return v(lead.lastName);
    case 'Email': return v(lead.email);
    case 'Phone Number': return v(lead.phone);
    case 'Job Title': return v(lead.jobTitle);
    case 'Company Name': return v(lead.organization);
    case 'City': return v(lead.city);
    case 'State': return v(lead.state);
    case 'Country': return v(lead.country);
    case 'Source': return v(lead.sourceName);
    case 'Email Status': return v(lead.emailStatus);
    case 'Seniority': return v(lead.seniority);
    case 'Department': return v(lead.department);
    case 'Industry': return v(lead.industry);
    case 'Employee Size': return v(lead.companySize);
    case 'Person Linkedin Url': return v(lead.linkedinUrl);
    case 'Website': return v(lead.website);
    case 'Company Linkedin Url': return v(lead.companyLinkedinUrl);
    default: return '-';
  }
};

// Headers are permanently fixed to FIXED_HEADERS (see above) — this always returns the
// same schema regardless of what was uploaded, so table columns / CSV export / Supabase
// metadata never drift between imports.
export const getActiveHeaders = (): string[] => {
  return FIXED_HEADERS;
};

// Kept as no-ops so existing call sites (CSV import, Supabase pull) don't need to change:
// the header schema is fixed by design and can no longer be overwritten by an upload.
export const replaceActiveHeaders = (_headers: string[]): void => {};
export const setActiveHeaders = (_headers: string[], _forceReplace: boolean = false): void => {};

const cleanVal = (val: any) => {
  if (val === undefined || val === null) return '-';
  const str = String(val).trim();
  return (str === '' || str === 'undefined' || str === 'null') ? '-' : str;
};

// Known City Name Aliases & Standardizations dictionary
const CITY_ALIASES_MAP: Record<string, string> = {
  'mumbai': 'Mumbai',
  'bombay': 'Mumbai',
  'mumbai city': 'Mumbai',
  'bengaluru': 'Bengaluru',
  'bangalore': 'Bengaluru',
  'bangluru': 'Bengaluru',
  'bengluru': 'Bengaluru',
  'bangaluru': 'Bengaluru',
  'bengaluru city': 'Bengaluru',
  'blore': 'Bengaluru',
  'blr': 'Bengaluru',
  'delhi': 'Delhi',
  'new delhi': 'New Delhi',
  'dilli': 'Delhi',
  'ncr': 'Delhi',
  'kolkata': 'Kolkata',
  'calcutta': 'Kolkata',
  'chennai': 'Chennai',
  'madras': 'Chennai',
  'gurugram': 'Gurugram',
  'gurgaon': 'Gurugram',
  'pune': 'Pune',
  'poona': 'Pune',
  'hyderabad': 'Hyderabad',
  'hyd': 'Hyderabad',
  'ahmedabad': 'Ahmedabad',
  'amdavad': 'Ahmedabad',
  'surat': 'Surat',
  'jaipur': 'Jaipur',
  'lucknow': 'Lucknow',
  'kanpur': 'Kanpur',
  'nagpur': 'Nagpur',
  'indore': 'Indore',
  'thane': 'Thane',
  'bhopal': 'Bhopal',
  'visakhapatnam': 'Visakhapatnam',
  'patna': 'Patna',
  'vadodara': 'Vadodara',
  'ghaziabad': 'Ghaziabad',
  'ludhiana': 'Ludhiana',
  'agra': 'Agra',
  'nashik': 'Nashik',
  'faridabad': 'Faridabad',
  'meerut': 'Meerut',
  'rajkot': 'Rajkot',
  'kalyan': 'Kalyan',
  'vasai': 'Vasai',
  'varanasi': 'Varanasi',
  'srinagar': 'Srinagar',
  'aurangabad': 'Aurangabad',
  'dhanbad': 'Dhanbad',
  'amritsar': 'Amritsar',
  'navi mumbai': 'Navi Mumbai',
  'allahabad': 'Prayagraj',
  'prayagraj': 'Prayagraj',
  'new york': 'New York',
  'new york city': 'New York',
  'nyc': 'New York',
  'ny': 'New York',
  'san francisco': 'San Francisco',
  'san fran': 'San Francisco',
  'sf': 'San Francisco',
  'los angeles': 'Los Angeles',
  'la': 'Los Angeles',
  'chicago': 'Chicago',
  'boston': 'Boston',
  'seattle': 'Seattle',
  'austin': 'Austin',
  'london': 'London',
  'london, uk': 'London',
  'paris': 'Paris',
  'tokyo': 'Tokyo',
  'singapore': 'Singapore',
  'dubai': 'Dubai',
  'sydney': 'Sydney',
  'toronto': 'Toronto',
  'berlin': 'Berlin',
};

/**
 * Convert string to Title Case with standard capitalization rules
 */
export const toProperTitleCase = (str: string): string => {
  if (!str || str === '-') return '-';
  const clean = str.trim().replace(/\s+/g, ' ');
  if (!clean || clean === '-') return '-';

  const lowerWords = new Set(['of', 'and', 'in', 'on', 'at', 'to', 'for', 'with', 'the']);
  const upperAcronyms: Record<string, string> = {
    'ceo': 'CEO',
    'cfo': 'CFO',
    'cto': 'CTO',
    'coo': 'COO',
    'cmo': 'CMO',
    'cio': 'CIO',
    'vp': 'VP',
    'hr': 'HR',
    'it': 'IT',
    'ai': 'AI',
    'ui': 'UI',
    'ux': 'UX',
    'se': 'SE',
    'gm': 'GM',
    'qa': 'QA',
    'bdr': 'BDR',
    'sdr': 'SDR',
    'ca': 'CA',
  };

  const words = clean.split(' ');
  const titleCased = words.map((w, idx) => {
    const lower = w.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (upperAcronyms[lower]) {
      return upperAcronyms[lower];
    }
    if (idx > 0 && lowerWords.has(lower)) {
      return lower;
    }
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });

  return titleCased.join(' ');
};

const HEADER_NAME_MAP: Record<string, string> = {
  'fname': 'First Name',
  'first_name': 'First Name',
  'f_name': 'First Name',
  'firstname': 'First Name',
  'given_name': 'First Name',
  'given name': 'First Name',
  'name': 'First Name',
  'lname': 'Last Name',
  'last_name': 'Last Name',
  'l_name': 'Last Name',
  'lastname': 'Last Name',
  'surname': 'Last Name',
  'email': 'Email',
  'e-mail': 'Email',
  'mail': 'Email',
  'email_id': 'Email',
  'email_status': 'Email Status',
  'emailstatus': 'Email Status',
  'phone': 'Phone Number',
  'phone_number': 'Phone Number',
  'phone_no': 'Phone Number',
  'mobile': 'Phone Number',
  'mobile_no': 'Phone Number',
  'organization': 'Company',
  'company': 'Company',
  'company_name': 'Company',
  'org': 'Company',
  'job_title': 'Job Title',
  'jobtitle': 'Job Title',
  'title': 'Job Title',
  'designation': 'Job Title',
  'role': 'Job Title',
  'seniority': 'Seniority',
  'seniority_level': 'Seniority',
  'department': 'Department',
  'dept': 'Department',
  'industry': 'Industry',
  'sector': 'Industry',
  'company_size': 'Employee Size',
  'employee_size': 'Employee Size',
  'headcount': 'Employee Size',
  'city': 'Location',
  'location': 'Location',
  'country': 'Country',
  'linkedin_url': 'LinkedIn URL',
  'linkedin': 'LinkedIn URL',
  'website': 'Website',
  'url': 'Website',
  'registration_time': 'Registration Time',
  'registrationtime': 'Registration Time',
  'created_at': 'Registration Time',
  'createdat': 'Registration Time',
  'approval_status': 'Approval Status',
  'approvalstatus': 'Approval Status',
  'status': 'Approval Status',
  'source_name': 'Lead Source',
  'sourcename': 'Lead Source',
};

/**
 * Format raw CSV header keys to clean Title Case standard display header names
 */
export const formatHeaderName = (header: string): string => {
  if (!header || !header.trim()) return '';
  const cleanKey = header.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
  if (HEADER_NAME_MAP[cleanKey]) {
    return HEADER_NAME_MAP[cleanKey];
  }
  return header
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
};

/**
 * Normalize city names across variations & aliases to standard original name
 */
export const normalizeCityName = (val: any): string => {
  if (val === undefined || val === null) return '-';
  const str = String(val).trim();
  if (!str || str === '-' || str === 'undefined' || str === 'null') return '-';

  const clean = str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  if (CITY_ALIASES_MAP[clean]) {
    return CITY_ALIASES_MAP[clean];
  }

  for (const [key, target] of Object.entries(CITY_ALIASES_MAP)) {
    if (clean === key || clean.startsWith(key + ' ') || clean.endsWith(' ' + key)) {
      return target;
    }
  }

  return toProperTitleCase(str);
};

/**
 * Normalize names, job titles, and organization strings to Title Case
 */
export const normalizeNameOrTitle = (val: any): string => {
  if (val === undefined || val === null) return '-';
  const str = String(val).trim();
  if (!str || str === '-' || str === 'undefined' || str === 'null') return '-';

  return toProperTitleCase(str);
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
  if (!srcName || /^contacts$|^export$|^leads$|^data$|^apollo_.*export|^operon_.*export|^supabase/i.test(srcName)) {
    srcName = '-';
  } else {
    srcName = srcName.replace(/\s+/g, '-');
  }

  return {
    ...l,
    firstName: normalizeNameOrTitle(fName),
    lastName: normalizeNameOrTitle(lName),
    email: cleanVal(l.email),
    organization: normalizeNameOrTitle(l.organization),
    jobTitle: normalizeNameOrTitle(l.jobTitle),
    city: normalizeCityName(l.city),
    phone: cleanVal(l.phone),
    approvalStatus: cleanVal(l.approvalStatus || 'approved'),
    sourceName: srcName,
    registrationTime: cleanVal(l.registrationTime),
    questions: cleanVal(l.questions),
    emailUnlocked: false,
    phoneUnlocked: false,
  };
};

// In-memory cache for ultra-fast handling of large datasets (up to 100,000+ leads)
let memoryLeadCache: Lead[] | null = null;

// Get leads from memory cache / localStorage & purge any blank (- - -) junk rows
export const getStoredLeads = (): Lead[] => {
  if (memoryLeadCache !== null) {
    return memoryLeadCache;
  }
  try {
    const data = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
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

        const result = validOnly.map((l, idx) => ({
          ...sanitizeLead(l),
          id: idx + 1
        }));
        memoryLeadCache = result;
        return result;
      }
    }
  } catch (err) {
    console.error('Error reading leads from localStorage:', err);
  }

  // Only load initialLeads on the very FIRST app startup when localStorage key does not exist at all
  const sanitizedDefaults = initialLeads.map((l, idx) => ({
    ...sanitizeLead(l),
    id: idx + 1
  }));
  sanitizedDefaults.forEach(l => {
    if (l.sourceName && l.sourceName !== '-') {
      addCsvTag(l.sourceName);
    }
  });
  memoryLeadCache = sanitizedDefaults;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedDefaults));
  } catch (e) {
    // Ignore quota error
  }
  return sanitizedDefaults;
};

// Save leads array to memory cache & localStorage
export const saveStoredLeads = (leads: Lead[]): void => {
  memoryLeadCache = leads;
  try {
    if (leads.length <= 15000) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(leads.slice(0, 10000)));
    }
  } catch (err) {
    console.warn('LocalStorage quota limit reached, maintaining 100,000+ leads in memory cache & Supabase:', err);
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
// A column name merely *containing* an alias as a substring (e.g. a raw CSV column
// literally named "Org Phone" containing "org") is enough to match below — that column
// holds a phone number, not a company name, but the key-name check alone can't tell the
// difference. None of the categories extractFieldValues serves (company, job title,
// city, state, country, source, status) should ever legitimately be a bare phone
// number, so reject values that are unambiguously phone-shaped regardless of which key
// they came from — this is what actually stops a mismatched column from polluting a
// filter's suggestions, rather than trying to guess every possible bad column name.
const looksLikePhoneNumber = (val: string): boolean => {
  const trimmed = val.trim();
  if (trimmed.length < 7) return false;
  const digitCount = (trimmed.match(/\d/g) || []).length;
  const nonPhoneChars = trimmed.replace(/[\d\s\-+().]/g, '');
  return nonPhoneChars.length === 0 && digitCount >= 7;
};

const extractFieldValues = (l: any, aliases: string[]): string[] => {
  const values: string[] = [];
  Object.keys(l).forEach(k => {
    const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (aliases.some(a => cleanK.includes(a))) {
      const val = l[k];
      if (val !== undefined && val !== null && String(val).trim() !== '' && !looksLikePhoneNumber(String(val))) {
        values.push(String(val).trim());
      }
    }
  });
  return values;
};

// Get unique filter options for sidebar dropdowns dynamically
export const getFilterOptions = (): FilterOptions => {
  const leads = getStoredLeads();
  
  const getUniqueForAliases = (aliases: string[], isCityField: boolean = false): string[] => {
    const set = new Set<string>();
    leads.forEach(l => {
      const vals = extractFieldValues(l, aliases);
      vals.forEach(v => {
        const normalized = isCityField ? normalizeCityName(v) : normalizeNameOrTitle(v);
        if (normalized && normalized !== '-') {
          set.add(normalized);
        }
      });
    });
    return Array.from(set).sort();
  };

  const customFilterMap: Record<string, string[]> = {};

  // Fixed schema fields are already covered by dedicated filter arrays above; only
  // surface genuinely extra/custom CSV columns (beyond FIXED_HEADERS) as ad-hoc filters.
  const KNOWN_LEAD_KEYS = new Set([
    'id', 'firstName', 'lastName', 'email', 'phone', 'organization', 'jobTitle', 'city',
    'state', 'country', 'sourceName', 'emailStatus', 'seniority', 'department', 'industry',
    'companySize', 'linkedinUrl', 'website', 'companyLinkedinUrl', 'registrationTime',
    'approvalStatus', 'questions', 'createdAt', 'isSaved', 'emailUnlocked', 'phoneUnlocked',
    '_csvHeaders', 'intent', 'technologies', 'tags', 'notes', 'aiScore', 'aiValueReasons',
    'revenue', 'funding'
  ]);
  const allCsvColumns = leads.length > 0
    ? Object.keys(leads[0]).filter(k => !KNOWN_LEAD_KEYS.has(k))
    : [];

  allCsvColumns.forEach(col => {
    const valSet = new Set<string>();
    leads.forEach(l => {
      const val = (l as any)[col];
      if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-') {
        const norm = col.toLowerCase().includes('city') || col.toLowerCase().includes('location') 
          ? normalizeCityName(val) 
          : normalizeNameOrTitle(val);
        if (norm && norm !== '-') valSet.add(norm);
      }
    });
    if (valSet.size > 0 && valSet.size <= 250) {
      customFilterMap[col] = Array.from(valSet).sort();
    }
  });

  return {
    jobTitles: getUniqueForAliases(['jobtitle', 'title', 'role', 'designation', 'position', 'occupation']),
    companies: getUniqueForAliases(['organization', 'company', 'employer', 'business', 'org', 'firm']),
    // city/state/country used to be lumped into one "Person Location / City" filter
    // (the cities alias list included 'state' and 'country'), which showed a jumbled
    // mix of cities, states, and countries together — now split into 3 dedicated lists.
    cities: getUniqueForAliases(['city', 'location', 'town', 'address'], true),
    states: getUniqueForAliases(['state', 'province', 'region']),
    countries: getUniqueForAliases(['country', 'nation']),
    sources: getUniqueForAliases(['sourcename', 'source', 'leadsource']),
    statuses: getUniqueForAliases(['approvalstatus', 'status', 'approved', 'state']),
    seniorities: ['C-Suite', 'VP / Vice President', 'Director', 'Manager', 'Owner / Partner', 'Entry Level'],
    companySizes: ['1-10 employees', '11-50 employees', '51-200 employees', '201-500 employees', '501-1000 employees', '1000+ employees'],
    industries: ['Software & SaaS', 'Financial Services', 'Healthcare & Biotech', 'Marketing & Advertising', 'E-Commerce & Retail', 'Education & Research', 'Consulting & IT'],
    emailStatuses: ['Valid / Safe', 'Risky / Catch-all', 'Invalid / Bounce'],
    intents: ['High Intent', 'Medium Intent', 'Low Intent'],
    technologies: ['React', 'Salesforce', 'HubSpot', 'AWS', 'Google Cloud', 'Stripe', 'Node.js', 'WordPress'],
    tags: getStoredCsvTags(),
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
      const vals = extractFieldValues(leadObj, ['city', 'location', 'town', 'address']);
      const lowerSelected = filters.cities.map(c => c.toLowerCase());
      if (!vals.some(v => lowerSelected.includes(v.toLowerCase()))) return false;
    }

    if (filters.states && filters.states.length > 0) {
      const vals = extractFieldValues(leadObj, ['state', 'province', 'region']);
      const lowerSelected = filters.states.map(s => s.toLowerCase());
      if (!vals.some(v => lowerSelected.includes(v.toLowerCase()))) return false;
    }

    if (filters.countries && filters.countries.length > 0) {
      const vals = extractFieldValues(leadObj, ['country', 'nation']);
      const lowerSelected = filters.countries.map(c => c.toLowerCase());
      if (!vals.some(v => lowerSelected.includes(v.toLowerCase()))) return false;
    }

    if (filters.sources && filters.sources.length > 0) {
      // Match on the same csvTag-or-sourceName logic deleteLeadsByTag uses, so a tag
      // search here finds exactly the rows a delete-by-tag would remove — no row can
      // "appear selected" in a search that delete then fails to reach.
      const vals = extractFieldValues(leadObj, ['sourcename', 'source', 'leadsource']);
      const lowerSelected = filters.sources.map(s => s.toLowerCase());
      const matchesSource = vals.some(v => lowerSelected.includes(v.toLowerCase()));
      const matchesCsvTag = filters.sources.some(s => leadMatchesTag(l, s));
      if (!matchesSource && !matchesCsvTag) return false;
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
      } else if (filters.persona === 'Marketing & Growth') {
        const isMkt = ['marketing', 'growth', 'brand', 'content', 'seo'].some(k => title.includes(k));
        if (!isMkt) return false;
      } else if (filters.persona === 'Sales & Business Dev') {
        const isSales = ['sales', 'business development', 'account', 'bdr', 'sdr'].some(k => title.includes(k));
        if (!isSales) return false;
      }
    }

    if (filters.seniorities && filters.seniorities.length > 0) {
      const titleLower = (l.jobTitle || '').toLowerCase();
      const matchSeniority = filters.seniorities.some(sen => {
        const s = sen.toLowerCase();
        if (s.includes('c-suite')) return ['ceo', 'cfo', 'cto', 'coo', 'cmo', 'cio', 'chief', 'founder', 'president'].some(k => titleLower.includes(k));
        if (s.includes('vp')) return ['vp', 'vice president'].some(k => titleLower.includes(k));
        if (s.includes('director')) return ['director', 'head'].some(k => titleLower.includes(k));
        if (s.includes('manager')) return ['manager', 'lead', 'supervisor'].some(k => titleLower.includes(k));
        if (s.includes('owner')) return ['owner', 'partner', 'proprietor'].some(k => titleLower.includes(k));
        if (s.includes('entry')) return ['assistant', 'associate', 'intern', 'specialist', 'executive', 'analyst'].some(k => titleLower.includes(k));
        return titleLower.includes(s);
      });
      if (!matchSeniority) return false;
    }

    if (filters.companySizes && filters.companySizes.length > 0) {
      const sizeLower = (l.companySize || '').toLowerCase();
      const orgLower = (l.organization || '').toLowerCase();
      const matchSize = filters.companySizes.some(cs => {
        const targetNum = cs.split(' ')[0];
        if (sizeLower.includes(targetNum)) return true;
        if (!sizeLower && (targetNum === '1-10' || targetNum === '11-50')) return true;
        return false;
      });
      if (!matchSize) return false;
    }

    if (filters.industries && filters.industries.length > 0) {
      const indStr = (l.industry || `${l.organization || ''} ${l.jobTitle || ''}`).toLowerCase();
      const matchInd = filters.industries.some(ind => {
        const keyword = ind.toLowerCase().split(' ')[0];
        return indStr.includes(keyword);
      });
      if (!matchInd) return false;
    }

    if (filters.intents && filters.intents.length > 0) {
      const intentVal = l.intent || (l.aiScore && l.aiScore > 80 ? 'High Intent' : l.aiScore && l.aiScore > 50 ? 'Medium Intent' : 'Low Intent');
      const matchIntent = filters.intents.some(i => intentVal.toLowerCase().includes(i.toLowerCase().split(' ')[0]));
      if (!matchIntent) return false;
    }

    if (filters.technologies && filters.technologies.length > 0) {
      const techStr = (l.technologies ? l.technologies.join(' ') : `${l.questions || ''} ${l.sourceName || ''}`).toLowerCase();
      const matchTech = filters.technologies.some(tech => techStr.includes(tech.toLowerCase()));
      if (!matchTech) return false;
    }

    if (filters.tags && filters.tags.length > 0) {
      const srcLower = (l.sourceName || '').toLowerCase();
      const matchTag = filters.tags.some(tag => srcLower.includes(tag.toLowerCase()));
      if (!matchTag) return false;
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
    firstName: normalizeNameOrTitle(fName),
    lastName: normalizeNameOrTitle(lName),
    email: emailVal,
    registrationTime: new Date().toLocaleString(),
    approvalStatus: cleanVal(newLeadData.approvalStatus || 'approved'),
    city: normalizeCityName(newLeadData.city),
    phone: cleanVal(newLeadData.phone),
    organization: normalizeNameOrTitle(newLeadData.organization),
    jobTitle: normalizeNameOrTitle(newLeadData.jobTitle),
    questions: cleanVal(newLeadData.questions),
    sourceName: newLeadData.sourceName && String(newLeadData.sourceName).trim() ? String(newLeadData.sourceName).trim().replace(/\s+/g, '-') : 'Manual-Entry',
    createdAt: new Date().toISOString(),
    isSaved: false,
    emailUnlocked: false,
    phoneUnlocked: false,
  };

  const updated = [lead, ...allLeads];
  saveStoredLeads(updated);

  if (getSupabaseConfig().autoSync) {
    try {
      await pushLeadsToSupabase([lead]);
    } catch (err) {
      console.error('Auto-sync add to Supabase failed:', err);
    }
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
    if (getSupabaseConfig().autoSync) {
      try {
        await pushLeadsToSupabase([updatedLead]);
      } catch (err) {
        console.error('Auto-sync update to Supabase failed:', err);
      }
    }
  }
  return updatedLead;
};

// Delete Lead (with automatic Trash backup). Supabase FIRST — only remove locally
// once Supabase actually confirms the delete, so a failed remote delete can't leave a
// lead "gone" from the UI but still present in Supabase (which reappears next reload).
export const deleteLead = async (id: number): Promise<{ error?: string }> => {
  const allLeads = getStoredLeads();
  const target = allLeads.find(l => l.id === id);
  if (!target) return {};

  // Prefer _rawEmail (the row's real, un-scrubbed email — see pullLeadsFromSupabase)
  // when present, so a blank-contact lead (displayed email always "-") can actually be
  // deleted from Supabase for real instead of the delete having nothing to target.
  const deleteEmail = (target as any)._rawEmail || target.email;
  let supabaseError: string | undefined;
  try {
    const result = await deleteLeadFromSupabase({ email: deleteEmail, id: target.id });
    if (!result.success) supabaseError = result.error || 'Could not confirm this contact was deleted from Supabase.';
  } catch (err: any) {
    console.error('Delete sync to Supabase failed:', err);
    supabaseError = err?.message || 'Delete sync to Supabase failed';
  }

  // A blank-contact row with no real email at all (not even a raw synthetic one) has no
  // reliable identifier to delete by — still remove it locally rather than get stuck.
  const isBlankContact = !deleteEmail || deleteEmail === '-';
  if (!supabaseError || isBlankContact) {
    const updated = allLeads.filter(l => l.id !== id);
    saveStoredLeads(updated);
    addLeadsToTrash([target]);
    return {};
  }

  return { error: supabaseError };
};

// Bulk Delete Leads (with automatic Trash backup). Supabase FIRST, local storage
// SECOND, and only remove locally what Supabase actually confirmed deleting — same
// reasoning as deleteLeadsByTag: removing locally regardless of whether the remote
// delete actually succeeded is exactly how a lead can vanish from the UI while
// Supabase silently keeps it, then reappear on the next reload/pull.
export const bulkDeleteLeads = async (ids: number[]): Promise<{ count: number; error?: string }> => {
  const allLeads = getStoredLeads();
  const idSet = new Set(ids);
  const targets = allLeads.filter(l => idSet.has(l.id));
  if (targets.length === 0) return { count: 0 };

  let supabaseError: string | undefined;
  let confirmedEmails = new Set<string>();
  try {
    const result = await bulkDeleteLeadsFromSupabase(targets);
    confirmedEmails = getLastConfirmedDeletedEmails();
    if (!result.success) supabaseError = result.error || 'Some records could not be confirmed deleted from Supabase.';
  } catch (err: any) {
    console.error('Bulk delete sync to Supabase failed:', err);
    supabaseError = err?.message || 'Bulk delete failed';
  }

  const isConfirmedRemoved = (l: Lead) => {
    // Check _rawEmail first — a blank-contact lead's displayed email is always "-", but
    // bulkDeleteLeadsFromSupabase actually targets (and Supabase confirms deletion by)
    // its real, un-scrubbed email (see pullLeadsFromSupabase).
    const rawEmail = ((l as any)._rawEmail || '').trim().toLowerCase();
    if (rawEmail && rawEmail !== '-' && confirmedEmails.has(rawEmail)) return true;
    const email = (l.email || '').trim().toLowerCase();
    return email && email !== '-' && confirmedEmails.has(email);
  };
  const removedLeads = targets.filter(l => isConfirmedRemoved(l) || (!supabaseError && (!l.email || l.email === '-')));
  const removedIdSet = new Set(removedLeads.map(l => l.id));
  const updated = allLeads.filter(l => !removedIdSet.has(l.id));
  saveStoredLeads(updated);

  if (removedLeads.length > 0) addLeadsToTrash(removedLeads);

  return { count: removedLeads.length, error: supabaseError };
};

// Delete All Leads (Purge Directory & Supabase)
export const deleteAllLeads = async (): Promise<void> => {
  const allLeads = getStoredLeads();
  if (allLeads.length > 0) {
    addLeadsToTrash(allLeads);
  }
  saveStoredLeads([]);
  try {
    await deleteAllLeadsFromSupabase();
  } catch (err) {
    console.error('Delete all from Supabase failed:', err);
  }
};

// Delete all leads associated with a specific CSV Tag / Source Name
// Shared by search/filter and delete-by-tag so "found by search" and "deleted by tag"
// can never disagree on which rows a tag actually covers. Normalizes hyphens/spaces to
// a single form (CSV tags are stored hyphenated, but a typed search term may have
// spaces) so "Test Tag" and "Test-Tag" are recognized as the same tag.
const normalizeTagValue = (s: string | null | undefined): string =>
  (s || '').trim().toLowerCase().replace(/[-_\s]+/g, '-');

export const leadMatchesTag = (lead: Lead, tag: string): boolean => {
  const cleanTag = normalizeTagValue(tag);
  if (!cleanTag) return false;
  // csvTag is the reliable per-upload identity; sourceName is checked too so leads
  // tagged before this field existed (or created outside the CSV importer) still match.
  return normalizeTagValue(lead.csvTag) === cleanTag || normalizeTagValue(lead.sourceName) === cleanTag;
};

export const deleteLeadsByTag = async (tag: string): Promise<{ count: number; error?: string }> => {
  if (!tag || !tag.trim()) return { count: 0 };

  const allLeads = getStoredLeads();
  const targetLeads = allLeads.filter(l => leadMatchesTag(l, tag));

  // Supabase FIRST, local storage SECOND — and only remove locally what Supabase
  // actually confirmed deleting. The previous order (remove locally, then best-effort
  // sync with every error swallowed) is exactly how a lead could vanish from the UI
  // while Supabase silently kept it, then reappear on the next reload/pull.
  let supabaseError: string | undefined;
  let confirmedEmails = new Set<string>();
  try {
    // deleteLeadsByTagFromSupabase now queries Supabase directly for every row
    // carrying this tag — it doesn't need (or trust) targetLeads to know what to
    // delete, so there's no longer a distinct "no local matches" branch: the
    // authoritative sweep runs the same way either way.
    const result = await deleteLeadsByTagFromSupabase(tag);
    confirmedEmails = getLastConfirmedDeletedEmails();
    if (!result.success) supabaseError = result.error || 'Some records could not be confirmed deleted from Supabase.';
  } catch (err: any) {
    console.error(`Delete leads by tag '${tag}' from Supabase failed:`, err);
    supabaseError = err?.message || 'Delete leads by tag failed';
  }

  // On full success, trust the authoritative Supabase sweep completely and clear every
  // locally-tag-matching lead — it queried the live table itself, independent of
  // whatever this local list happens to contain, so it's the more trustworthy source.
  // Only fall back to precise per-email reconciliation when something went wrong, so a
  // partial failure doesn't locally remove rows that weren't actually confirmed gone.
  const removedLeads = !supabaseError
    ? targetLeads
    : targetLeads.filter(l => {
        const email = (l.email || '').trim().toLowerCase();
        return email && email !== '-' && confirmedEmails.has(email);
      });
  const updatedLeads = allLeads.filter(l => !removedLeads.includes(l));

  saveStoredLeads(updatedLeads);

  // Only drop the tag from the suggestions registry once nothing with that tag remains
  // — if some rows couldn't be confirmed deleted, the tag is still real and should keep
  // showing up so the user can retry rather than losing track of the leftover data.
  const stillHasMatches = updatedLeads.some(l => leadMatchesTag(l, tag));
  if (!stillHasMatches) removeCsvTag(tag);

  if (removedLeads.length > 0) {
    addLeadsToTrash(removedLeads);
  }

  return { count: removedLeads.length, error: supabaseError };
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

  if (getSupabaseConfig().autoSync) {
    try {
      await pushLeadsToSupabase(restoredLeadsWithFreshIds);
    } catch (err) {
      console.error('Restore sync to Supabase failed:', err);
    }
  }

  return {
    updatedLeads,
    restoredCount: restoredLeadsWithFreshIds.length,
    restoredList: restoredLeadsWithFreshIds
  };
};

export interface BulkImportResult {
  count: number;
  supabaseResult: { success: boolean; count: number; error?: string };
  totalRows: number;
  uniqueRows: number;
  duplicatesSkipped: number;
  duplicateLeadNames: string[];
}

export interface DuplicatePreviewResult {
  totalRows: number;
  uniqueRows: number;
  duplicatesSkipped: number;
  duplicateLeadNames: string[];
}

// Session-scoped record of the most recent CSV import's real result — shared by every
// import entry point (manual CsvImporter, AI-assistant chat upload) so the AI Assistant
// can answer follow-up questions ("were there duplicates?", "why wasn't X a duplicate?")
// from actual processing results rather than guessing, regardless of which UI triggered
// the import.
let lastImportReport: { result: BulkImportResult; tag: string | null; at: string } | null = null;
export const getLastImportReport = () => lastImportReport;

// Builds duplicate signatures for every lead already sitting in local storage — this
// app's own in-memory/localStorage cache, already loaded, so this costs nothing extra
// over the network. Layered under the Supabase-backed check below so a previously
// imported lead is still caught as a duplicate even when Supabase is unreachable,
// unconfigured, mid-migration, or simply hasn't caught up (a partially-failed sync,
// autoSync having been off at the time it was created, etc.) — duplicate detection must
// never silently depend on Supabase alone.
const buildLocalExistingIndex = (): Map<string, import('../lib/dedupe.ts').ExistingRecordRef> => {
  const index = new Map<string, import('../lib/dedupe.ts').ExistingRecordRef>();
  getStoredLeads().forEach(lead => {
    const { signature } = buildDuplicateSignature(lead as any);
    if (!signature) return;
    const first = (lead.firstName || '').trim();
    const last = (lead.lastName || '').trim();
    const leadName = [first, last !== '-' ? last : ''].filter(Boolean).join(' ').trim() || (lead.email && lead.email !== '-' ? lead.email : '') || 'Unknown lead';
    const email = (lead.email && lead.email !== '-') ? lead.email : '';
    index.set(signature, { signature, leadName, email });
  });
  return index;
};

// Combines the local-storage index above with a targeted Supabase lookup for the
// signatures this batch could actually match (see getExistingLeadIndexForSignatures) —
// local first (cheap, always available), Supabase entries layered on top (authoritative
// when reachable, and the only source that sees leads imported on a different
// device/session). Shared by the read-only preview and the real import so both see the
// exact same "what already exists" picture.
const buildExistingIndexFor = async (
  newLeadsList: Partial<Lead>[]
): Promise<Map<string, import('../lib/dedupe.ts').ExistingRecordRef>> => {
  const existingIndex = buildLocalExistingIndex();
  try {
    // Only ask Supabase about the signatures THIS batch could actually match — never
    // downloads the whole table (see getExistingLeadIndexForSignatures).
    const candidateSignatures = newLeadsList.map(row => buildDuplicateSignature(row).signature);
    const remoteIndex = await getExistingLeadIndexForSignatures(candidateSignatures);
    remoteIndex.forEach((ref, sig) => existingIndex.set(sig, ref));
  } catch (err) {
    console.warn('Existing-Supabase duplicate check failed — still backed by the local-storage check above', err);
  }
  return existingIndex;
};

// Read-only dry run of the same exact-duplicate check bulkImportLeads runs — used by
// every CSV import entry point to ask the user, BEFORE anything is written, whether to
// import only the new leads or the full file (duplicates included). Runs the same check
// regardless of whether a tag was given for this upload or not — tag plays no part in
// the comparison at all (see buildDuplicateSignature). Nothing is created or pushed here.
export const previewBulkImportDuplicates = async (
  newLeadsList: Partial<Lead>[]
): Promise<DuplicatePreviewResult> => {
  const existingIndex = await buildExistingIndexFor(newLeadsList);

  const dedupeResult = dedupeLeadRows(newLeadsList, existingIndex);
  return {
    totalRows: newLeadsList.length,
    uniqueRows: dedupeResult.kept.length,
    duplicatesSkipped: dedupeResult.duplicatesSkipped,
    duplicateLeadNames: dedupeResult.duplicateLeadNames,
  };
};

// Bulk Import Leads — enforces the exact-duplicate rule (see lib/dedupe.ts): a row is a
// duplicate ONLY when EVERY relevant mapped field matches (after safe normalization)
// another row already kept in this batch or already present in Supabase. Tag plays NO
// part in this comparison — a lead under a different tag than an existing match is
// STILL the same duplicate lead, never imported as a second record. Tag-name
// uniqueness is a completely separate, independent check (see getActiveTagSet /
// the tag-conflict flow in CsvImporter.tsx and AICopilotDrawer.tsx) that runs before
// this and never influences whether a LEAD counts as a duplicate. Filename is never
// part of this comparison either (see lib/csvFileRegistry.ts for the unrelated,
// file-content-hash-based "already uploaded this exact file" check).
//
// `options.includeDuplicates` — set only after the caller showed the user the
// duplicate-preview choice (see previewBulkImportDuplicates) and they explicitly picked
// "import the full file": every row is imported as its own record, exact duplicates
// included, instead of the default skip-duplicates behavior. Note this still goes
// through pushLeadsToSupabase's normal upsert-by-email — a duplicate row sharing a real
// email with an existing lead updates that lead rather than creating a second Supabase
// row; only rows with a genuinely different (or no) email actually land as new rows.
export const bulkImportLeads = async (
  newLeadsList: Partial<Lead>[],
  options?: { includeDuplicates?: boolean }
): Promise<BulkImportResult> => {
  const includeDuplicates = options?.includeDuplicates === true;

  let dedupeResult: ReturnType<typeof dedupeLeadRows> | null = null;
  if (!includeDuplicates) {
    const existingIndex = await buildExistingIndexFor(newLeadsList);
    dedupeResult = dedupeLeadRows(newLeadsList, existingIndex);
  }

  const uniqueItems = includeDuplicates ? newLeadsList : dedupeResult!.kept;

  const allLeads = getStoredLeads();
  let maxId = allLeads.length > 0 ? Math.max(...allLeads.map(l => l.id)) : 0;

  const createdLeads: Lead[] = uniqueItems.map(item => {
    maxId += 1;
    // sourceName is the row's own lead-origin value, exactly as the CSV had it (or '-'
    // if it had none) — never defaulted to the batch tag, so a lead with no real source
    // correctly shows "-" rather than the upload's tag name.
    const cleanSourceName = item.sourceName && String(item.sourceName).trim() ? String(item.sourceName).trim().replace(/\s+/g, '-') : '-';
    // csvTag is the upload batch's own identity (set by CsvImporter on every row in the
    // batch, independent of each row's sourceName) — preserve it as-is so tag search/
    // select/delete can reliably find the whole batch regardless of per-row sourceName.
    // Only THIS is registered as a suggestible tag — a row's own arbitrary sourceName
    // (which could be anything from the CSV, e.g. "Referral") is real lead data, not a
    // deliberate batch tag, and registering it as one is what let unrelated one-off
    // values leak into the tag-suggestion list.
    const csvTagVal = item.csvTag && String(item.csvTag).trim()
      ? String(item.csvTag).trim().replace(/\s+/g, '-')
      : null;
    if (csvTagVal) addCsvTag(csvTagVal);
    return {
      ...item,
      id: maxId,
      firstName: normalizeNameOrTitle(item.firstName),
      lastName: normalizeNameOrTitle(item.lastName),
      email: cleanVal(item.email),
      registrationTime: cleanVal(item.registrationTime),
      approvalStatus: cleanVal(item.approvalStatus || 'approved'),
      city: normalizeCityName(item.city),
      phone: cleanVal(item.phone),
      organization: normalizeNameOrTitle(item.organization),
      jobTitle: normalizeNameOrTitle(item.jobTitle),
      questions: cleanVal(item.questions),
      sourceName: cleanSourceName,
      csvTag: csvTagVal,
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

  let supabaseResult: { success: boolean; count: number; error?: string } = { success: false, count: 0, error: 'Auto-sync disabled' };
  if (createdLeads.length > 0 && getSupabaseConfig().autoSync) {
    try {
      supabaseResult = await pushLeadsToSupabase(createdLeads);
      if (supabaseResult.success) {
        // Re-sync local storage from Supabase's own confirmed state rather than trusting
        // the optimistic local append above — this is what keeps the app's displayed
        // record count matching Supabase exactly. pushLeadsToSupabase's `success` only
        // means "at least one row made it" (a batch can partially fail column/schema
        // issues and still report success); re-pulling reflects exactly what actually
        // landed, dropping anything that silently didn't. Best-effort: if the re-pull
        // itself fails, the optimistic local state from saveStoredLeads above stands —
        // still better than nothing, just not re-verified against Supabase this round.
        const pull = await pullLeadsFromSupabase();
        if (pull.success) saveStoredLeads(pull.leads);
      }
    } catch (err: any) {
      console.error('Auto-sync import to Supabase failed:', err);
      supabaseResult = { success: false, count: 0, error: err?.message || 'Sync failed' };
    }
  }

  const importResult: BulkImportResult = {
    count: createdLeads.length,
    supabaseResult,
    totalRows: newLeadsList.length,
    uniqueRows: uniqueItems.length,
    // Nothing was actually skipped when the caller chose to include duplicates — the
    // report should reflect what really happened, not what the check would have skipped.
    duplicatesSkipped: includeDuplicates ? 0 : dedupeResult!.duplicatesSkipped,
    duplicateLeadNames: includeDuplicates ? [] : dedupeResult!.duplicateLeadNames,
  };

  lastImportReport = {
    result: importResult,
    tag: newLeadsList[0]?.csvTag ? String(newLeadsList[0].csvTag) : null,
    at: new Date().toISOString(),
  };

  return importResult;
};
