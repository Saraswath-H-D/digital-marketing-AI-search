import { Company } from '../types.ts';
import { dedupeLeadRows, buildCompanyDuplicateSignature, companyNameOf, ExistingRecordRef, DuplicateMatch } from '../lib/dedupe.ts';

const STORAGE_KEY = 'operon_companies_v1';

let memoryCompanyCache: Company[] | null = null;

const cleanVal = (val: any) => {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  return (str === '' || str === 'undefined' || str === 'null' || str === '-') ? '' : str;
};

// Get companies from memory cache / localStorage — same in-memory-cache-first pattern
// as leadStorage.ts's getStoredLeads, for the same reason (fast repeated reads without
// re-parsing localStorage on every call).
export const getStoredCompanies = (): Company[] => {
  if (memoryCompanyCache !== null) return memoryCompanyCache;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data !== null) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        memoryCompanyCache = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading companies from localStorage:', err);
  }
  memoryCompanyCache = [];
  return [];
};

export const saveStoredCompanies = (companies: Company[]): void => {
  memoryCompanyCache = companies;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
  } catch (err) {
    console.warn('LocalStorage quota limit reached while saving companies:', err);
  }
};

// Builds duplicate signatures for every company already in local storage — the sole
// source of truth for "what already exists" now that there's no shared backend.
const buildLocalExistingIndex = (): Map<string, ExistingRecordRef> => {
  const index = new Map<string, ExistingRecordRef>();
  getStoredCompanies().forEach(company => {
    const { signature } = buildCompanyDuplicateSignature(company as any);
    if (!signature) return;
    index.set(signature, { signature, leadName: companyNameOf(company as any), email: '' });
  });
  return index;
};

const buildExistingIndexFor = async (
  _newCompaniesList: Partial<Company>[]
): Promise<Map<string, ExistingRecordRef>> => {
  return buildLocalExistingIndex();
};

export interface CompanyDuplicatePreviewResult {
  totalRows: number;
  uniqueRows: number;
  duplicatesSkipped: number;
  duplicateLeadNames: string[];
}

// Read-only dry run of the same exact-duplicate check bulkImportCompanies runs — same
// contract as leadStorage.ts's previewBulkImportDuplicates. Nothing is created or
// pushed here.
export const previewBulkImportCompanyDuplicates = async (
  newCompaniesList: Partial<Company>[]
): Promise<CompanyDuplicatePreviewResult> => {
  const existingIndex = await buildExistingIndexFor(newCompaniesList);
  const dedupeResult = dedupeLeadRows(newCompaniesList, existingIndex, {
    buildSignature: buildCompanyDuplicateSignature,
    nameOf: companyNameOf,
  });
  return {
    totalRows: newCompaniesList.length,
    uniqueRows: dedupeResult.kept.length,
    duplicatesSkipped: dedupeResult.duplicatesSkipped,
    duplicateLeadNames: dedupeResult.duplicateLeadNames,
  };
};

export interface BulkImportCompanyResult {
  count: number;
  totalRows: number;
  uniqueRows: number;
  duplicatesSkipped: number;
  duplicateLeadNames: string[];
  // How many of the "duplicates" above were actually merged into their existing
  // central record (blank fields enriched, this import's pod tag added) rather than
  // silently discarded — see mergeDuplicateCompaniesIntoExisting.
  mergedIntoExisting: number;
}

// Mirrors leadStorage.ts's mergeDuplicateLeadsIntoExisting — same "enrich blank fields,
// append this import's pod tag" behavior, but matched by domain (companies have no
// email-equivalent identity) falling back to an exact name match.
const mergeDuplicateCompaniesIntoExisting = async (
  duplicates: DuplicateMatch<Partial<Company>>[],
  importPodTag: string | null
): Promise<number> => {
  if (duplicates.length === 0) return 0;

  const allCompanies = getStoredCompanies();
  const byDomain = new Map(allCompanies.filter(c => c.domain).map(c => [String(c.domain).trim().toLowerCase(), c]));
  const byName = new Map(allCompanies.map(c => [c.name.trim().toLowerCase(), c]));
  const mergedById = new Map<number, Company>();

  duplicates.forEach(dup => {
    const incoming = dup.row;
    const incomingDomain = (incoming.domain || '').trim().toLowerCase();
    const existingCompany = (incomingDomain && byDomain.get(incomingDomain))
      || byName.get((dup.existing.leadName || '').trim().toLowerCase());
    if (!existingCompany) return; // no local copy to merge into — leave it alone

    const base = mergedById.get(existingCompany.id) || existingCompany;
    const enriched: Company = { ...base };
    (Object.keys(incoming) as (keyof Company)[]).forEach(key => {
      if (key === 'id' || key === 'podTags') return;
      const existingVal: any = (base as any)[key];
      const incomingVal: any = (incoming as any)[key];
      const isBlank = existingVal === undefined || existingVal === null || existingVal === '';
      const hasValue = incomingVal !== undefined && incomingVal !== null && incomingVal !== '';
      if (isBlank && hasValue) (enriched as any)[key] = incomingVal;
    });
    const podSet = new Set(base.podTags || []);
    if (importPodTag) podSet.add(importPodTag);
    enriched.podTags = Array.from(podSet);

    mergedById.set(existingCompany.id, enriched);
  });

  if (mergedById.size === 0) return 0;

  const mergedCompanies = Array.from(mergedById.values());
  const byId = new Map(allCompanies.map(c => [c.id, c]));
  mergedCompanies.forEach(m => byId.set(m.id, m));
  saveStoredCompanies(Array.from(byId.values()));

  return mergedCompanies.length;
};

// Bulk Import Companies — same exact-duplicate rule and `includeDuplicates` contract as
// leadStorage.ts's bulkImportLeads (see that function's own doc comment for the full
// reasoning; not repeated here).
export const bulkImportCompanies = async (
  newCompaniesList: Partial<Company>[],
  options?: { includeDuplicates?: boolean }
): Promise<BulkImportCompanyResult> => {
  const includeDuplicates = options?.includeDuplicates === true;

  let dedupeResult: ReturnType<typeof dedupeLeadRows> | null = null;
  let mergedIntoExisting = 0;
  if (!includeDuplicates) {
    const existingIndex = await buildExistingIndexFor(newCompaniesList);
    dedupeResult = dedupeLeadRows(newCompaniesList, existingIndex, {
      buildSignature: buildCompanyDuplicateSignature,
      nameOf: companyNameOf,
    });

    const batchPodTag = (newCompaniesList[0] as any)?.podTag && String((newCompaniesList[0] as any).podTag).trim()
      ? String((newCompaniesList[0] as any).podTag).trim().replace(/\s+/g, '-')
      : null;
    mergedIntoExisting = await mergeDuplicateCompaniesIntoExisting(dedupeResult.duplicates, batchPodTag);
  }

  const uniqueItems = includeDuplicates ? newCompaniesList : dedupeResult!.kept;

  const allCompanies = getStoredCompanies();
  let maxId = allCompanies.length > 0 ? Math.max(...allCompanies.map(c => c.id)) : 0;

  const createdCompanies: Company[] = uniqueItems.map(item => {
    maxId += 1;
    return {
      id: maxId,
      name: cleanVal(item.name) || 'Unnamed Company',
      domain: cleanVal(item.domain) || null,
      linkedinUrl: cleanVal(item.linkedinUrl),
      industry: cleanVal(item.industry),
      companySize: cleanVal(item.companySize),
      city: cleanVal(item.city),
      state: cleanVal(item.state),
      country: cleanVal(item.country),
      tags: Array.isArray(item.tags) ? item.tags : [],
      // The importer UI still collects ONE pod tag per batch (see CompanyImporter.tsx)
      // — one import is one pod's action — so it arrives here as a single value and
      // gets wrapped into the stored array.
      podTags: (item as any).podTag && String((item as any).podTag).trim()
        ? [String((item as any).podTag).trim().replace(/\s+/g, '-')]
        : [],
      createdAt: new Date().toISOString(),
    };
  });

  saveStoredCompanies([...createdCompanies, ...allCompanies]);

  return {
    count: createdCompanies.length,
    totalRows: newCompaniesList.length,
    uniqueRows: uniqueItems.length,
    duplicatesSkipped: includeDuplicates ? 0 : dedupeResult!.duplicatesSkipped,
    duplicateLeadNames: includeDuplicates ? [] : dedupeResult!.duplicateLeadNames,
    mergedIntoExisting: includeDuplicates ? 0 : mergedIntoExisting,
  };
};

// Add a single company — mirrors leadStorage.ts's addLead (duplicate detection is a
// separate, explicit step the caller runs first via previewBulkImportCompanyDuplicates
// if it wants to warn the user; this function itself always adds, same as addLead).
export const addCompany = async (data: Partial<Company>): Promise<Company> => {
  const allCompanies = getStoredCompanies();
  const maxId = allCompanies.length > 0 ? Math.max(...allCompanies.map(c => c.id)) : 0;

  const company: Company = {
    id: maxId + 1,
    name: cleanVal(data.name) || 'Unnamed Company',
    domain: cleanVal(data.domain) || null,
    linkedinUrl: cleanVal(data.linkedinUrl),
    industry: cleanVal(data.industry),
    companySize: cleanVal(data.companySize),
    city: cleanVal(data.city),
    state: cleanVal(data.state),
    country: cleanVal(data.country),
    tags: Array.isArray(data.tags) ? data.tags : [],
    podTags: (data as any).podTag && String((data as any).podTag).trim()
      ? [String((data as any).podTag).trim().replace(/\s+/g, '-')]
      : (Array.isArray(data.podTags) ? data.podTags : []),
    createdAt: new Date().toISOString(),
  };

  saveStoredCompanies([company, ...allCompanies]);

  return company;
};

// Delete a company locally (no trash/undo flow for companies yet).
export const deleteCompany = async (id: number): Promise<{ error?: string }> => {
  const allCompanies = getStoredCompanies();
  const target = allCompanies.find(c => c.id === id);
  if (!target) return {};

  saveStoredCompanies(allCompanies.filter(c => c.id !== id));
  return {};
};

// Distinct pod-tag values currently present across companies — same derivation style
// as leadStorage.ts's getStoredCsvTags, used to populate the Pod filter's option list.
export const getDistinctCompanyPodTags = (): string[] => {
  const set = new Set<string>();
  getStoredCompanies().forEach(c => { (c.podTags || []).forEach(t => set.add(t)); });
  return Array.from(set).sort();
};
