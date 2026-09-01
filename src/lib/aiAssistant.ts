import { Lead, Filters, FilterOptions } from '../types.ts';

export interface AICommandResult {
  action: 'search' | 'create' | 'update' | 'delete' | 'restore' | 'show_deleted' | 'show_revived' | 'unlock' | 'chat';
  explanation: string;
  // Search payload
  searchQuery?: string;
  filterUpdates?: Partial<Filters>;
  matchingLeadIds?: number[];
  // Create payload
  newLeadData?: Partial<Lead>;
  // Update payload
  targetLeadId?: number;
  targetLeadName?: string;
  updateData?: Partial<Lead>;
  // Delete payload
  deleteLeadId?: number;
  deleteLeadName?: string;
}

export interface ChatHistoryItem {
  sender: 'user' | 'assistant';
  text: string;
}

// ==================== CSV UPLOAD TAG INTENT (chat-driven CSV import) ====================
// Precise tag resolution for a CSV attached in the AI Assistant composer. Never invents
// a tag: an unresolvable/absent reference always comes back as `tag: null`, exactly
// like an unspecified tag — the caller is the only place a default (e.g. the filename)
// may ever be applied, and even then only when the caller explicitly chooses to.

export interface CsvTagResolution {
  // explicit    — user named a real tag ("with the SaaS Founders tag")
  // none        — user explicitly declined a tag ("without a tag")
  // same        — user referred to a previous tag ("same tag as before")
  // unspecified — tag wasn't mentioned at all; caller should default to null, never invent one
  mode: 'explicit' | 'none' | 'same' | 'unspecified';
  tag: string | null;
  needsClarification: boolean;
  clarificationQuestion?: string;
}

export const NO_TAG_RE = /\b(without\s+(?:a\s+|any\s+)?tag|no\s+tag|don'?t\s+(?:assign\s+(?:a\s+|any\s+)?tag|tag\s+(?:it|them|these|this)?)|dont\s+tag|leave\s+the\s+tag\s+empty|untagged|(?:import|upload)(?:ed)?\s+(?:them\s+|it\s+)?normally)\b/i;

const SAME_TAG_RE = /\b(same\s+tag|previous\s+tag|last\s+tag|tag\s+(?:we|i)\s+used\s+(?:before|previously|last\s+time))\b/i;

// Non-greedy value capture that stops at sentence-ending punctuation or a common
// trailing conjunction/filler word, so "with the SaaS Founders tag, please" captures
// just "SaaS Founders" rather than swallowing the rest of the sentence.
const TAG_VALUE = `([A-Za-z0-9][A-Za-z0-9 &/'’_-]*?)(?=[.,!?]|\\s+(?:and|but|please|for|from|to|instead)\\b|$)`;

const EXPLICIT_TAG_PATTERNS: RegExp[] = [
  new RegExp(`\\btag(?:ged)?\\s+(?:it|them|these|this)?\\s*as\\s+["“']?${TAG_VALUE}`, 'i'),
  new RegExp(`\\bwith\\s+(?:the\\s+)?tag\\s+["“']?${TAG_VALUE}`, 'i'),
  new RegExp(`\\bwith\\s+(?:the\\s+)?["“']?${TAG_VALUE}["”']?\\s+tag\\b`, 'i'),
  new RegExp(`\\btag\\s*[:=]\\s*["“']?${TAG_VALUE}`, 'i'),
  new RegExp(`\\bunder\\s+(?:the\\s+)?["“']?${TAG_VALUE}["”']?\\s+(?:group|tag)\\b`, 'i'),
  new RegExp(`\\buse\\s+(?:the\\s+)?["“']?${TAG_VALUE}["”']?\\s+tag\\b`, 'i'),
  new RegExp(`\\b(?:use|make\\s+it)\\s+["“']?${TAG_VALUE}["”']?\\s+instead\\b`, 'i'),
];

/**
 * Resolve tag intent from one message (Design.md-independent — this is the AI Assistant's
 * own NL logic). `lastUsedTag` is the most recent tag this conversation actually used in
 * a completed upload (or null); it's the only thing "same tag as before" is allowed to
 * resolve against — never a guess.
 */
export function resolveCsvTagIntent(text: string, lastUsedTag: string | null): CsvTagResolution {
  const clean = (text || '').trim();

  if (NO_TAG_RE.test(clean)) {
    return { mode: 'none', tag: null, needsClarification: false };
  }

  if (SAME_TAG_RE.test(clean)) {
    if (lastUsedTag) {
      return { mode: 'same', tag: lastUsedTag, needsClarification: false };
    }
    return {
      mode: 'same',
      tag: null,
      needsClarification: true,
      clarificationQuestion: "I don't have a previous tag from this conversation to reuse — which tag should I use, or should I leave these contacts untagged?",
    };
  }

  for (const re of EXPLICIT_TAG_PATTERNS) {
    const m = clean.match(re);
    if (m && m[1] && m[1].trim()) {
      return { mode: 'explicit', tag: m[1].trim().replace(/\s+/g, '-'), needsClarification: false };
    }
  }

  return { mode: 'unspecified', tag: null, needsClarification: false };
}

// Recognizes an explicit request to delete/remove a CSV or its members — out of scope
// for the current upload flow, so callers can decline honestly instead of misreading it
// as an upload.
export const CSV_DELETE_INTENT_RE = /\b(delete|remove|get rid of)\s+(?:the\s+|this\s+|that\s+)?(csv|file|import|members?|contacts?)\b/i;

// ==================== NATURAL-LANGUAGE LEAD FILTERING ====================
// Converts an English lead-search sentence into the application's OWN Filters object —
// never a separate filtering mechanism (Design.md/AI-assistant spec §11) — grounded
// strictly in values that actually exist in filterOptions. Never invents a filter value
// or field; a requested concept the data doesn't support is reported, not guessed at.

export interface FilterQueryResult {
  mode: 'apply' | 'clarify' | 'unavailable' | 'none';
  /** Full, ready-to-apply Filters object (current filters merged with this query's intent) — only set when mode === 'apply'. */
  mergedFilters?: Filters;
  /** Bullet lines describing the FINAL cumulative filter state, for the "I understood: ..." summary. */
  understood: string[];
  /** Requested concepts with no matching field/data in this application. */
  unavailable: string[];
  clarificationQuestion?: string;
}

const JOB_TITLE_SYNONYMS: Record<string, string[]> = {
  ceo: ['ceo', 'chief executive officer'],
  cto: ['cto', 'chief technology officer', 'chief technical officer'],
  cfo: ['cfo', 'chief financial officer'],
  coo: ['coo', 'chief operating officer'],
  cmo: ['cmo', 'chief marketing officer'],
  cio: ['cio', 'chief information officer'],
  ciso: ['ciso', 'chief information security officer'],
  vp: ['vp', 'vice president'],
  hr: ['hr', 'human resources', 'human resource'],
  engineer: ['engineer', 'developer', 'programmer', 'swe', 'software engineer'],
  developer: ['developer', 'engineer', 'programmer', 'swe'],
  manager: ['manager', 'mgr'],
  director: ['director', 'dir'],
  executive: ['executive', 'exec'],
  founder: ['founder', 'co-founder', 'cofounder', 'co founder'],
  president: ['president'],
  representative: ['representative', 'rep'],
  admin: ['admin', 'administrator'],
};

const FILTER_STOPWORDS = new Set(['the', 'a', 'an', 'of', 'people', 'person', 'who', 'are', 'is', 'working', 'as', 'for', 'with', 'from', 'all', 'me', 'some', 'any', 'in']);

// Known concepts this application has no real field for — matched explicitly so the
// assistant can decline honestly (Design.md/AI-assistant §5) instead of pretending.
const UNSUPPORTED_FIELD_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(university|college|graduated|alma mater|\bdegree\b)\b/i, label: 'education/university' },
  { re: /\byears?\s*(?:of\s*)?experience\b|\d+\+?\s*years?\s*(?:of\s*)?experience/i, label: 'years of experience' },
  { re: /\bfounded\s+(?:in|after|before)\b|\bfounding\s+(?:year|date)\b/i, label: 'company founding date' },
  { re: /\brevenue\b/i, label: 'company revenue' },
  { re: /\bfunding\b|\bseries\s+[a-e]\b/i, label: 'funding stage' },
  { re: /\bstartups?\b/i, label: 'company stage (startup vs. enterprise)' },
];

function normalizeToken(t: string): string {
  const lower = t.toLowerCase().trim();
  return lower.endsWith('s') && lower.length > 3 && !lower.endsWith('ss') ? lower.slice(0, -1) : lower;
}

function expandTokenSynonyms(tok: string): string[] {
  const norm = normalizeToken(tok);
  const hits = new Set<string>([norm]);
  Object.entries(JOB_TITLE_SYNONYMS).forEach(([key, syns]) => {
    if (key === norm || syns.some(s => normalizeToken(s) === norm)) {
      hits.add(key);
      syns.forEach(s => hits.add(normalizeToken(s)));
    }
  });
  return Array.from(hits);
}

// Extracts the "role phrase" — text right after a request trigger ("show me", "find",
// "I want", ...), stopping at the first qualifier-introducing word so "software
// engineers in Hyderabad" yields just "software engineers".
function extractRolePhrase(query: string): string | null {
  let text = query.trim();
  const triggerMatch = text.match(/^(?:show me|find|give me|get all|get me|i want|i need|list|display|only show|show)\s+(?:all\s+)?/i);
  if (triggerMatch) text = text.slice(triggerMatch[0].length);
  const stopMatch = text.match(/\b(in|at|from|based in|located in|working|with|who|having|founded|and)\b/i);
  const phrase = stopMatch ? text.slice(0, stopMatch.index) : text;
  const cleaned = phrase.replace(/[.,!?]+$/, '').trim();
  return cleaned || null;
}

function matchJobTitles(query: string, options: string[]): string[] {
  const rolePhrase = extractRolePhrase(query);
  if (!rolePhrase) return [];
  const tokens = rolePhrase.split(/\s+/).map(t => t.replace(/[^a-zA-Z-]/g, '')).filter(t => t && !FILTER_STOPWORDS.has(t.toLowerCase()));
  if (tokens.length === 0) return [];

  // Each token expands to its synonym family; a real jobTitle option must contain at
  // least one member of EVERY group to count as a match — so "software engineer" never
  // matches a bare "Manager", and "CEO" matches "Chief Executive Officer" even though
  // it isn't a literal substring.
  const groups = tokens.map(expandTokenSynonyms);
  return options.filter(opt => {
    const optLower = opt.toLowerCase();
    return groups.every(group => group.some(term => optLower.includes(term)));
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Grounded, safe matcher for categorical fields whose real option values are typically
// already phrased the way people naturally say them (city/state/country/company/
// industry names) — scans for the REAL option text appearing in the query, never the
// reverse, so nothing not actually in the data can ever get selected.
function scanForOptionMatches(query: string, options: string[]): string[] {
  return options.filter(opt => {
    const optLower = (opt || '').trim();
    if (!optLower || optLower === '-') return false;
    try {
      return new RegExp(`\\b${escapeRegExp(optLower)}\\b`, 'i').test(query);
    } catch {
      return false;
    }
  });
}

// A small, finite hint table for industry phrasing that doesn't literally appear inside
// the real option labels (e.g. "technology companies" vs. the option "Software & SaaS")
// — still only ever selects real existing option values, never invents one.
const INDUSTRY_HINTS: Record<string, string[]> = {
  technology: ['software', 'tech', 'saas', 'it'],
  tech: ['software', 'tech', 'saas', 'it'],
  healthcare: ['health', 'biotech', 'medical'],
  finance: ['financial', 'bank', 'fintech'],
  retail: ['e-commerce', 'ecommerce', 'retail'],
  education: ['education'],
};

function matchIndustries(query: string, options: string[]): string[] {
  const direct = scanForOptionMatches(query, options);
  if (direct.length > 0) return direct;
  const hinted = new Set<string>();
  Object.entries(INDUSTRY_HINTS).forEach(([trigger, keywords]) => {
    if (new RegExp(`\\b${escapeRegExp(trigger)}\\b`, 'i').test(query)) {
      options.forEach(opt => {
        const optLower = opt.toLowerCase();
        if (keywords.some(k => optLower.includes(k))) hinted.add(opt);
      });
    }
  });
  return Array.from(hinted);
}

function parseCompanySizeQuery(query: string, options: string[]): string[] {
  const lower = query.toLowerCase();
  let threshold: number | null = null;
  let comparison: 'more' | 'less' | null = null;

  let m = lower.match(/(?:more than|over|above|greater than)\s+(\d+)\+?\s*employees?/);
  if (!m) m = lower.match(/(\d+)\s*\+\s*employees?/);
  if (m) { threshold = parseInt(m[1], 10); comparison = 'more'; }

  if (threshold === null) {
    m = lower.match(/(?:less than|under|fewer than|below)\s+(\d+)\s*employees?/);
    if (m) { threshold = parseInt(m[1], 10); comparison = 'less'; }
  }
  if (threshold === null || !comparison) return [];

  const matched: string[] = [];
  options.forEach(opt => {
    const rangeMatch = opt.match(/(\d+)\s*-\s*(\d+)/);
    const plusMatch = opt.match(/(\d+)\s*\+/);
    if (rangeMatch) {
      const lo = parseInt(rangeMatch[1], 10), hi = parseInt(rangeMatch[2], 10);
      if (comparison === 'more' && hi > (threshold as number)) matched.push(opt);
      if (comparison === 'less' && lo < (threshold as number)) matched.push(opt);
    } else if (plusMatch && comparison === 'more') {
      const lo = parseInt(plusMatch[1], 10);
      if (lo >= (threshold as number)) matched.push(opt);
    }
  });
  return matched;
}

function detectRemovalIntent(query: string): (keyof Filters)[] {
  const lower = query.toLowerCase();
  const removals: (keyof Filters)[] = [];
  const wantsClear = /\b(remove|clear|drop)\b/.test(lower);
  if (!wantsClear) return removals;
  if (/\blocation\b|\bcity\b|\bstate\b|\bcountry\b/.test(lower)) removals.push('cities', 'states', 'countries');
  if (/\bjob title\b|\brole\b/.test(lower)) removals.push('jobTitles');
  if (/\bcompany\b/.test(lower)) removals.push('companies');
  if (/\bindustry\b/.test(lower)) removals.push('industries');
  if (/\btag\b|\bsource\b/.test(lower)) { removals.push('sources'); removals.push('tags'); }
  if (/\b(company size|employee)\b/.test(lower)) removals.push('companySizes');
  if (/\bseniority\b/.test(lower)) removals.push('seniorities');
  return removals;
}

function describeFilters(f: Filters): string[] {
  const lines: string[] = [];
  if (f.jobTitles?.length) lines.push(`Job Title: ${f.jobTitles.join(', ')}`);
  if (f.cities?.length) lines.push(`City: ${f.cities.join(', ')}`);
  if (f.states?.length) lines.push(`State: ${f.states.join(', ')}`);
  if (f.countries?.length) lines.push(`Country: ${f.countries.join(', ')}`);
  if (f.companies?.length) lines.push(`Company: ${f.companies.join(', ')}`);
  if (f.industries?.length) lines.push(`Industry: ${f.industries.join(', ')}`);
  if (f.seniorities?.length) lines.push(`Seniority: ${f.seniorities.join(', ')}`);
  if (f.companySizes?.length) lines.push(`Company Size: ${f.companySizes.join(', ')}`);
  if (f.sources?.length) lines.push(`Tag/Source: ${f.sources.join(', ')}`);
  return lines;
}

export function interpretFilterQuery(
  query: string,
  filterOptions: FilterOptions,
  currentFilters: Filters
): FilterQueryResult {
  const clean = query.trim();
  const lower = clean.toLowerCase();

  // Sidebar fallback defaults (FiltersSidebar.tsx) — matched here too so the assistant
  // offers exactly the same option universe the sidebar itself does, even before real
  // data has populated filterOptions.
  const seniorityOptions = filterOptions.seniorities?.length ? filterOptions.seniorities : ['C-Suite', 'VP / Vice President', 'Director', 'Manager', 'Owner / Partner', 'Entry Level'];
  const companySizeOptions = filterOptions.companySizes?.length ? filterOptions.companySizes : ['1-10 employees', '11-50 employees', '51-200 employees', '201-500 employees', '501-1000 employees', '1000+ employees'];
  const industryOptions = filterOptions.industries?.length ? filterOptions.industries : ['Software & SaaS', 'Financial Services', 'Healthcare & Biotech', 'Marketing & Advertising', 'E-Commerce & Retail', 'Education & Research', 'Consulting & IT'];

  const removals = detectRemovalIntent(clean);
  const keepOnlyMatch = clean.match(/^keep only\s+(.+)/i);
  const resetOthers = !!keepOnlyMatch;
  const effectiveQuery = keepOnlyMatch ? keepOnlyMatch[1] : clean;

  // Ambiguity check (spec example): "senior" alone could mean a job-title prefix or a
  // seniority-level filter — ask rather than guess, but only when it's genuinely
  // standalone (not already resolved by an unambiguous role match below).
  const jobTitleMatches = matchJobTitles(effectiveQuery, filterOptions.jobTitles || []);
  if (jobTitleMatches.length === 0 && /\bsenior\b/i.test(effectiveQuery) && (filterOptions.jobTitles || []).some(t => /^senior\b/i.test(t.trim()))) {
    return {
      mode: 'clarify',
      understood: [],
      unavailable: [],
      clarificationQuestion: 'Do you mean:\n• Senior job titles (e.g. "Senior Sales Manager")?\n• Seniority level = Senior/Director?',
    };
  }

  const cityMatches = scanForOptionMatches(effectiveQuery, filterOptions.cities || []);
  const stateMatches = scanForOptionMatches(effectiveQuery, filterOptions.states || []);
  const countryMatches = scanForOptionMatches(effectiveQuery, filterOptions.countries || []);
  const companyMatches = scanForOptionMatches(effectiveQuery, filterOptions.companies || []);
  const industryMatches = matchIndustries(effectiveQuery, industryOptions);
  const seniorityMatches = scanForOptionMatches(effectiveQuery, seniorityOptions);
  const sizeMatches = parseCompanySizeQuery(effectiveQuery, companySizeOptions);
  const tagMatches = scanForOptionMatches(effectiveQuery, filterOptions.sources || []);

  const unavailable: string[] = [];
  UNSUPPORTED_FIELD_PATTERNS.forEach(({ re, label }) => {
    if (re.test(clean) && !unavailable.includes(label)) unavailable.push(label);
  });

  const hasAnyMatch = jobTitleMatches.length + cityMatches.length + stateMatches.length + countryMatches.length +
    companyMatches.length + industryMatches.length + seniorityMatches.length + sizeMatches.length + tagMatches.length > 0;

  if (!hasAnyMatch && removals.length === 0) {
    if (unavailable.length > 0) {
      // Declining one field never wipes filters already active from earlier turns —
      // restate them so the conversation stays legible (§8 conversational continuity).
      return { mode: 'unavailable', understood: describeFilters(currentFilters), unavailable };
    }
    return { mode: 'none', understood: [], unavailable: [] }; // not a filter-shaped query — let the caller fall through
  }

  const base: Filters = resetOthers
    ? { ...currentFilters, jobTitles: [], companies: [], cities: [], states: [], countries: [], sources: [], statuses: [], industries: [], seniorities: [], companySizes: [], tags: [], search: currentFilters.search }
    : { ...currentFilters };

  const merged: Filters = { ...base };
  if (jobTitleMatches.length > 0) merged.jobTitles = Array.from(new Set([...(resetOthers ? [] : merged.jobTitles || []), ...jobTitleMatches]));
  if (cityMatches.length > 0) merged.cities = Array.from(new Set([...(resetOthers ? [] : merged.cities || []), ...cityMatches]));
  if (stateMatches.length > 0) merged.states = Array.from(new Set([...(resetOthers ? [] : merged.states || []), ...stateMatches]));
  if (countryMatches.length > 0) merged.countries = Array.from(new Set([...(resetOthers ? [] : merged.countries || []), ...countryMatches]));
  if (companyMatches.length > 0) merged.companies = Array.from(new Set([...(resetOthers ? [] : merged.companies || []), ...companyMatches]));
  if (industryMatches.length > 0) merged.industries = Array.from(new Set([...(resetOthers ? [] : merged.industries || []), ...industryMatches]));
  if (seniorityMatches.length > 0) merged.seniorities = Array.from(new Set([...(resetOthers ? [] : merged.seniorities || []), ...seniorityMatches]));
  if (sizeMatches.length > 0) merged.companySizes = Array.from(new Set([...(resetOthers ? [] : merged.companySizes || []), ...sizeMatches]));
  if (tagMatches.length > 0) { merged.sources = Array.from(new Set([...(resetOthers ? [] : merged.sources || []), ...tagMatches])); merged.tags = merged.sources; }

  removals.forEach(key => {
    (merged as any)[key] = [];
  });

  const understood = describeFilters(merged);

  if (understood.length === 0 && removals.length === 0) {
    return unavailable.length > 0
      ? { mode: 'unavailable', understood: describeFilters(currentFilters), unavailable }
      : { mode: 'none', understood: [], unavailable: [] };
  }

  return { mode: 'apply', mergedFilters: merged, understood, unavailable };
}

/**
 * Helper to scan chat history backwards and resolve the last referenced/created/updated lead object.
 */
function extractLastMentionedLeadFromHistory(chatHistory: ChatHistoryItem[], allLeads: Lead[]): Lead | undefined {
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const text = chatHistory[i].text;
    
    // Look for ID pattern e.g. lead #12
    const idMatch = text.match(/(?:lead|#)\s*#?(\d+)/i);
    if (idMatch) {
      const found = allLeads.find(l => l.id === parseInt(idMatch[1]));
      if (found) return found;
    }

    // Look for quoted names e.g. "Yas Na" or "Yash"
    const nameMatch = text.match(/"([A-Za-z0-9\s]+)"/);
    if (nameMatch) {
      const targetName = nameMatch[1].trim().toLowerCase();
      if (targetName && !['create', 'update', 'delete', 'chat', 'search'].includes(targetName)) {
        const found = allLeads.find(l => {
          const full = `${l.firstName} ${l.lastName && l.lastName !== '-' ? l.lastName : ''}`.trim().toLowerCase();
          return full === targetName || l.firstName.toLowerCase() === targetName || (l.email && l.email.toLowerCase() === targetName);
        });
        if (found) return found;
      }
    }

    // Scan for lead first names in history text
    for (const lead of allLeads) {
      const fName = (lead.firstName || '').toLowerCase();
      if (fName.length > 2 && text.toLowerCase().includes(fName)) {
        return lead;
      }
    }
  }
  return undefined;
}

/**
 * Process any natural language input string with full ChatGPT-level key-value, informal text & conversation history scanning:
 * - "name is yash" -> strips "is" -> firstName: "Yash", lastName: "-"
 * - "name is Yash Daxini" -> strips "is" -> firstName: "Yash", lastName: "Daxini"
 * - Handles key-value prompts like "insert name yas na,organisation bitm,gmail hlo@gmail"
 */
export async function processNaturalLanguageCommand(
  prompt: string,
  allLeads: Lead[],
  filterOptions: FilterOptions,
  chatHistory: ChatHistoryItem[] = [],
  activeLeadsOnPage: Lead[] = []
): Promise<AICommandResult> {
  const cleanPrompt = prompt.trim();

  const leadsContext = activeLeadsOnPage.length > 0 ? activeLeadsOnPage : allLeads;

  // Try Gemini AI API if key is available
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '');
  
  if (apiKey) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      const topCompanies = Array.from(new Set(leadsContext.map(l => l.organization).filter(Boolean))).slice(0, 15).join(', ');
      const topCities = Array.from(new Set(leadsContext.map(l => l.city).filter(Boolean))).slice(0, 15).join(', ');
      const sampleLeads = leadsContext.slice(0, 5).map(l => `#${l.id}: ${l.firstName} ${l.lastName || ''} (${l.jobTitle || '-'} at ${l.organization || '-'}, ${l.city || '-'})`).join(' | ');

      const systemInstruction = `
You are a ChatGPT-level intelligent AI Assistant for a B2B Lead Intelligence Platform.
You have FULL context of conversation history.

NAME EXTRACTION RULES:
- If user types "name is yash" or "name yash": firstName MUST be "Yash", lastName MUST be "-".
- If user types "name is Yash Daxini" or "name Yash Daxini": firstName MUST be "Yash", lastName MUST be "Daxini".
- Always strip filler words like "is", "are", "as", "=", ":".

EMAIL EXTRACTION RULES:
- Extract full or casual emails (e.g. "gmail hlo@gmail", "email hlo@gmail.com", "hlo@gmail"). If .com is missing from domain, append ".com".

Return ONLY a JSON object with this exact shape:
{
  "action": "search" | "create" | "update" | "delete" | "restore" | "show_revived" | "show_deleted" | "chat",
  "explanation": "Detailed, natural response or explanation answering the user's prompt using conversation history & page data",
  "searchQuery": "string keyword if search",
  "filterUpdates": { "search": "", "cities": [], "companies": [], "jobTitles": [] },
  "newLeadData": { "firstName": "-", "lastName": "-", "email": "-", "organization": "-", "jobTitle": "-", "city": "-", "phone": "-", "questions": "-" },
  "targetLeadId": 123,
  "targetLeadName": "string",
  "matchingLeadIds": [1, 2, 3],
  "updateData": { "email": "", "organization": "", "jobTitle": "", "city": "", "phone": "", "approvalStatus": "" },
  "deleteLeadId": 123
}
`;

      const contents: any[] = chatHistory.slice(-6).map(item => ({
        role: item.sender === 'user' ? 'user' : 'model',
        parts: [{ text: item.text }]
      }));

      contents.push({
        role: 'user',
        parts: [{ text: `User Prompt: "${cleanPrompt}"\n\nPage & Database Context:\n- Visible Leads on Page: ${leadsContext.length}\n- Top Companies: ${topCompanies}\n- Top Cities: ${topCities}\n- Sample Leads: ${sampleLeads}` }]
      });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        if (parsed && parsed.action) {
          if (parsed.action === 'create' && parsed.newLeadData) {
            parsed.newLeadData.firstName = parsed.newLeadData.firstName || '-';
            parsed.newLeadData.lastName = parsed.newLeadData.lastName || '-';
            parsed.newLeadData.email = parsed.newLeadData.email || '-';
            parsed.newLeadData.organization = parsed.newLeadData.organization || '-';
            parsed.newLeadData.jobTitle = parsed.newLeadData.jobTitle || '-';
            parsed.newLeadData.city = parsed.newLeadData.city || '-';
            parsed.newLeadData.phone = parsed.newLeadData.phone || '-';
            parsed.newLeadData.questions = parsed.newLeadData.questions || '-';
          }
          return parsed as AICommandResult;
        }
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to local NLP & context engine:', err);
    }
  }

  // Fallback: ChatGPT-Style Client-side Key-Value & Natural Language Entity Parser
  return parseCommandLocally(cleanPrompt, allLeads, filterOptions, chatHistory, leadsContext);
}

/**
 * ChatGPT-Style Ultra-Flexible Natural Language & Entity Extractor with Chat History Scanner
 */
function parseCommandLocally(
  prompt: string,
  allLeads: Lead[],
  filterOptions: FilterOptions,
  chatHistory: ChatHistoryItem[],
  leadsContext: Lead[]
): AICommandResult {
  const clean = prompt.trim();
  const lower = clean.toLowerCase();

  const lastMentioned = extractLastMentionedLeadFromHistory(chatHistory, allLeads);

  // 1. INTENT: SHOW / QUERY INTENTS
  const containsQueryWord = /\b(show|list|view|display|which|what|tell|see|get|check)\b/i.test(clean) ||
                            /(?:show|list|view|display)\s*$/i.test(clean);

  if (containsQueryWord) {
    if (/\b(revive|revived|restore|restored|recovered|un-deleted|undeleted)\b/i.test(clean)) {
      return {
        action: 'show_revived',
        explanation: `Viewing list of recently revived/restored lead records.`
      };
    }

    if (/\b(deleted|delete|trash|removed|erased|dropped|earlier)\b/i.test(clean)) {
      return {
        action: 'show_deleted',
        explanation: `Viewing list of earlier & recently deleted lead records.`
      };
    }
  }

  // 2. INTENT: EXECUTE RESTORE / REVIVE DELETED LEADS
  const isRestore = /\b(revive|restore|undo|bring back|recover|un-delete|undelete|cancel delete|no revive|get back|bring all back)\b/i.test(clean) &&
    !containsQueryWord;

  if (isRestore) {
    return {
      action: 'restore',
      explanation: `Understood restore/revive command. Restoring all recently deleted lead records back into the database.`
    };
  }

  // 3. INTENT: DELETE RECORD
  const isDelete = /\b(delete|remove|drop|erase|trash|get rid of)\b/i.test(clean);
  if (isDelete) {
    const idMatch = clean.match(/(?:lead|id|#)\s*#?(\d+)/i);
    if (idMatch) {
      const delId = parseInt(idMatch[1]);
      const lead = allLeads.find(l => l.id === delId);
      return {
        action: 'delete',
        explanation: `Understood delete command for lead #${delId}.`,
        deleteLeadId: delId,
        deleteLeadName: lead ? `${lead.firstName} ${lead.lastName && lead.lastName !== '-' ? lead.lastName : ''}` : `Lead #${delId}`
      };
    }

    if (/\b(it|this|that|him|her|same)\b/i.test(clean) && lastMentioned) {
      return {
        action: 'delete',
        explanation: `Deleting lead #${lastMentioned.id} (${lastMentioned.firstName} ${lastMentioned.lastName || ''}) from previous chat context.`,
        deleteLeadId: lastMentioned.id,
        deleteLeadName: `${lastMentioned.firstName} ${lastMentioned.lastName || ''}`
      };
    }

    let deleteCondition = clean
      .replace(/\b(delete|remove|drop|erase|trash|get rid of|all|leads|lead|contacts|contact|records|record|where|with|named|called|is|are|equal|to|the)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const fnMatch = clean.match(/(?:first\s*name|name)\s*(?:is|=|:)?\s*([A-Za-z0-9._-]+)/i);
    let targetNameOrVal = fnMatch ? fnMatch[1].trim().toLowerCase() : deleteCondition.toLowerCase();

    const matchingIds = allLeads.filter(l => {
      const fName = (l.firstName || '').toLowerCase();
      const lName = (l.lastName || '').toLowerCase();
      const full = `${fName} ${lName}`.trim();
      const org = (l.organization || '').toLowerCase();
      const email = (l.email || '').toLowerCase();
      const city = (l.city || '').toLowerCase();

      if (targetNameOrVal === 'as' && (fName === 'as' || fName === '-')) return true;
      if (fName === targetNameOrVal || lName === targetNameOrVal || full === targetNameOrVal) return true;
      if (email === targetNameOrVal || email.includes(targetNameOrVal)) return true;
      if (org === targetNameOrVal || city === targetNameOrVal) return true;

      const fullStr = `${full} ${org} ${email} ${city}`.toLowerCase();
      return deleteCondition.length > 0 && fullStr.includes(deleteCondition.toLowerCase());
    }).map(l => l.id);

    return {
      action: 'delete',
      explanation: `Identified deletion request for "${deleteCondition || targetNameOrVal}". Found ${matchingIds.length} matching lead record(s) to delete.`,
      matchingLeadIds: matchingIds
    };
  }

  // 4. INTENT: CREATE NEW RECORD
  const isCreate = /\b(add|create|insert|new lead|new contact|register|save lead)\b/i.test(clean);
  if (isCreate) {
    const newLeadData = parseLeadEntitiesFromText(clean);

    const displayName = newLeadData.lastName && newLeadData.lastName !== '-'
      ? `${newLeadData.firstName} ${newLeadData.lastName}`
      : `${newLeadData.firstName}`;

    return {
      action: 'create',
      explanation: `Parsed record for "${displayName}". Organization: "${newLeadData.organization}", Email: "${newLeadData.email}".`,
      newLeadData
    };
  }

  // 5. INTENT: UPDATE EXISTING RECORD
  const isUpdate = /\b(update|change|modify|set|edit|rename)\b/i.test(clean);
  if (isUpdate) {
    let targetLeadId: number | undefined = undefined;
    const idMatch = clean.match(/(?:lead|id|#)\s*#?(\d+)/i);
    if (idMatch) {
      targetLeadId = parseInt(idMatch[1]);
    }

    let targetLeadName: string | undefined = undefined;
    if (!targetLeadId) {
      const targetMatch = clean.match(/(?:for|lead|contact)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
      if (targetMatch) targetLeadName = targetMatch[1].trim();
    }

    let targetLead: Lead | undefined = undefined;
    if (targetLeadId) {
      targetLead = allLeads.find(l => l.id === targetLeadId);
    } else if (targetLeadName) {
      targetLead = allLeads.find(l => `${l.firstName} ${l.lastName || ''}`.toLowerCase().includes(targetLeadName!.toLowerCase()));
    } else if (lastMentioned) {
      targetLead = lastMentioned;
    } else {
      targetLead = leadsContext[0] || allLeads[0];
    }

    const updateData: Partial<Lead> = {};

    const emailMatch = clean.match(/(?:email|gmail)\s*(?:to|:|=)?\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)/i);
    if (emailMatch) {
      const captured = emailMatch[1].trim();
      updateData.email = captured.includes('.') ? captured : `${captured}.com`;
    }

    const cityMatch = clean.match(/\b(?:city|location)\b\s*(?:to|:|=)?\s*([A-Za-z\s]+?)(?:,|\.|$|\s+and)/i);
    if (cityMatch) updateData.city = cityMatch[1].trim();

    const orgMatch = clean.match(/\b(?:company|organization|organisation|oranisation|org)\b\s*(?:to|:|=)?\s*([A-Za-z0-9\s&]+?)(?:,|\.|$|\s+and)/i);
    if (orgMatch) updateData.organization = orgMatch[1].trim();

    const titleMatch = clean.match(/\b(?:title|role|job)\b\s*(?:to|:|=)?\s*([A-Za-z0-9\s&]+?)(?:,|\.|$|\s+and)/i);
    if (titleMatch) updateData.jobTitle = titleMatch[1].trim();

    if (lower.includes('approved') || lower.includes('approve')) updateData.approvalStatus = 'approved';
    if (lower.includes('denied') || lower.includes('deny')) updateData.approvalStatus = 'denied';

    if (targetLead) {
      return {
        action: 'update',
        explanation: `Understood update command for lead #${targetLead.id} (${targetLead.firstName} ${targetLead.lastName && targetLead.lastName !== '-' ? targetLead.lastName : ''}). Fields to update: ${Object.keys(updateData).join(', ')}.`,
        targetLeadId: targetLead.id,
        targetLeadName: `${targetLead.firstName} ${targetLead.lastName && targetLead.lastName !== '-' ? targetLead.lastName : ''}`,
        updateData
      };
    }
  }

  // 6. INTENT: GENERAL QUESTIONS / CONVERSATIONAL
  const isGeneralQuestion = 
    /\b(what|how|why|tell|explain|summarize|summary|who|list|which|count|many|detail)\b/i.test(clean) ||
    lower.includes('previous') || lower.includes('before') || lower.includes('above') || lower.includes('page');

  if (isGeneralQuestion) {
    const prevTurn = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
    const count = leadsContext.length;
    const companies = Array.from(new Set(leadsContext.map(l => l.organization).filter(b => b && b !== '-')));
    const cities = Array.from(new Set(leadsContext.map(l => l.city).filter(b => b && b !== '-')));
    const roles = Array.from(new Set(leadsContext.map(l => l.jobTitle).filter(b => b && b !== '-')));

    let chatResponse = '';

    if (lower.includes('summarize') || lower.includes('summary')) {
      chatResponse = `Here is a summary of the ${count} leads currently displayed on the page:\n- Companies: ${companies.slice(0, 6).join(', ') || '-'}\n- Primary Locations: ${cities.slice(0, 6).join(', ') || '-'}\n- Core Roles: ${roles.slice(0, 6).join(', ') || '-'}`;
    } else if (lower.includes('company') || lower.includes('companies')) {
      chatResponse = `The leads currently on your page belong to the following companies:\n${companies.map(c => `• ${c}`).join('\n') || 'No explicit companies listed.'}`;
    } else if (lower.includes('city') || lower.includes('cities') || lower.includes('location')) {
      chatResponse = `Locations represented on the current page view:\n${cities.map(c => `• ${c}`).join('\n') || 'No explicit locations listed.'}`;
    } else if (lower.includes('how many') || lower.includes('count')) {
      const approved = leadsContext.filter(l => l.approvalStatus === 'approved').length;
      const saved = leadsContext.filter(l => l.isSaved).length;
      chatResponse = `Currently showing ${count} total leads on the page (${approved} approved, ${saved} saved).`;
    } else if (lastMentioned) {
      chatResponse = `Regarding your recent lead ${lastMentioned.firstName} ${lastMentioned.lastName && lastMentioned.lastName !== '-' ? lastMentioned.lastName : ''} (#${lastMentioned.id}):\n- Organization: ${lastMentioned.organization || '-'}\n- Job Title: ${lastMentioned.jobTitle || '-'}\n- Email: ${lastMentioned.email || '-'}\n- City: ${lastMentioned.city || '-'}`;
    } else if (prevTurn) {
      chatResponse = `Based on your previous query ("${prevTurn.text}") and the current ${count} records on page:\n- Top matches include ${leadsContext.slice(0, 3).map(l => `${l.firstName} (${l.jobTitle || '-'} at ${l.organization || '-'})`).join(', ')}.`;
    } else {
      chatResponse = `Currently displaying ${count} leads on page across ${companies.length} companies and ${cities.length} locations. You can ask me to filter, summarize, add new leads, or edit records!`;
    }

    return {
      action: 'chat',
      explanation: chatResponse
    };
  }

  // 7. INTENT: SEARCH & IDENTIFY
  const isSearch = /\b(find|search|show|filter|display|locate|get)\b/i.test(clean) || clean.length > 0;
  if (isSearch) {
    let cleanSearch = clean
      .replace(/\b(find|search|show|me|all|leads|contacts|records|the|where|who|is|are|in|at|with)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const matchingIds = allLeads.filter(l => {
      const fullStr = `${l.firstName || ''} ${l.lastName || ''} ${l.organization || ''} ${l.jobTitle || ''} ${l.city || ''} ${l.email || ''} ${l.approvalStatus || ''}`.toLowerCase();
      const tokens = cleanSearch.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      if (tokens.length === 0) return fullStr.includes(lower);
      return tokens.some(t => fullStr.includes(t));
    }).map(l => l.id);

    return {
      action: 'search',
      explanation: `Identified search query for "${cleanSearch || clean}". Found ${matchingIds.length} matching lead records directly on page.`,
      searchQuery: cleanSearch || clean,
      matchingLeadIds: matchingIds,
      filterUpdates: {
        search: cleanSearch || clean
      }
    };
  }

  return {
    action: 'chat',
    explanation: `I am your Operon AI Assistant. I can search records, summarize page context, answer questions based on chat history, or edit contacts.`
  };
}

/**
 * ChatGPT-Style Filler-Word Stripping Name & Entity Parser
 */
function parseLeadEntitiesFromText(text: string): Partial<Lead> {
  const cleanText = text.trim();

  // Email extraction
  let email = '-';
  const fullEmailMatch = cleanText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  if (fullEmailMatch) {
    email = fullEmailMatch[0];
  } else {
    const casualEmailMatch = cleanText.match(/(?:email|gmail|mail)\s*[:=]?\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)/i);
    if (casualEmailMatch && casualEmailMatch[1]) {
      const captured = casualEmailMatch[1].trim();
      email = captured.includes('.') ? captured : `${captured}.com`;
    } else {
      const orphanEmailMatch = cleanText.match(/\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)\b/);
      if (orphanEmailMatch && orphanEmailMatch[1]) {
        const captured = orphanEmailMatch[1].trim();
        email = captured.includes('.') ? captured : `${captured}.com`;
      }
    }
  }

  const phoneMatch = cleanText.match(/\b\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/);
  const phone = phoneMatch ? phoneMatch[0] : '-';

  let org = '-';
  const orgMatch = cleanText.match(/\b(?:organization|organisation|oranisation|company|org|firm|employer)\b\s*[:=]?\s*([A-Za-z0-9._\s-&]+?)(?:,|$|\s+\b(?:email|gmail|mail|phone|city|location|title|role|job|name)\b)/i);
  if (orgMatch && orgMatch[1] && orgMatch[1].trim()) {
    let candidate = orgMatch[1].trim().replace(/^(?:is|are|as|to|=|\s)+/i, '').replace(/[,:=]+$/, '').trim();
    if (!['lead', 'contact', 'name', 'new'].includes(candidate.toLowerCase())) {
      org = candidate;
    }
  }

  let title = '-';
  const titleMatch = cleanText.match(/\b(?:title|role|job|designation|position)\b\s*[:=]?\s*([A-Za-z0-9._\s-&]+?)(?:,|$|\s+\b(?:email|gmail|mail|phone|city|location|company|org|organisation|oranisation|name)\b)/i);
  if (titleMatch && titleMatch[1] && titleMatch[1].trim()) {
    let candidate = titleMatch[1].trim().replace(/^(?:is|are|as|to|=|\s)+/i, '').replace(/[,:=]+$/, '').trim();
    if (!['lead', 'contact', 'name', 'new'].includes(candidate.toLowerCase())) {
      title = candidate;
    }
  }

  let city = '-';
  const cityMatch = cleanText.match(/\b(?:city|location|town|based in)\b\s*[:=]?\s*([A-Za-z\s]+?)(?:,|$|\s+\b(?:email|gmail|mail|phone|company|org|organisation|oranisation|role|title|job|name)\b)/i);
  if (cityMatch && cityMatch[1] && cityMatch[1].trim()) {
    let candidate = cityMatch[1].trim().replace(/^(?:is|are|as|to|=|\s)+/i, '').replace(/[,:=]+$/, '').trim();
    if (!['lead', 'contact', 'name', 'new'].includes(candidate.toLowerCase())) {
      city = candidate;
    }
  }

  let firstName = '-';
  let lastName = '-';

  // 1. Explicit name field match: e.g. "name is yash", "name: Yash Daxini", "first name is yash"
  const explicitNameMatch = cleanText.match(/\b(?:full\s*name|contact\s*name|lead\s*name|first\s*name|name)\b\s*[:=]?\s*([A-Za-z0-9._\s-]+?)(?:,|$|\s+\b(?:organization|organisation|oranisation|company|org|firm|email|gmail|mail|phone|city|location|title|role|job)\b)/i);
  
  if (explicitNameMatch && explicitNameMatch[1] && explicitNameMatch[1].trim()) {
    let nameVal = explicitNameMatch[1].trim();
    nameVal = nameVal.replace(/^(?:is|are|as|to|=|\s)+/i, '').replace(/[,:=]+$/, '').trim();

    if (nameVal && !['lead', 'contact', 'new', 'as'].includes(nameVal.toLowerCase())) {
      const parts = nameVal.split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        firstName = parts[0];
        lastName = '-';
      } else if (parts.length >= 2) {
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      }
    }
  }

  // 2. Freeform name match: e.g. "insert Yash Daxini company reva" or "add lead Yash"
  if (firstName === '-') {
    const freeformMatch = cleanText.match(/\b(?:add|create|insert|save)\b\s+(?:a\s+)?(?:new\s+)?(?:lead|contact)?\s*(?:as\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
    if (freeformMatch && freeformMatch[1]) {
      let rawVal = freeformMatch[1].trim().replace(/^(?:is|are|as|to|=|\s)+/i, '').trim();
      const parts = rawVal.split(/\s+/).filter(Boolean);
      if (parts.length > 0 && !['name', 'lead', 'contact', 'as', 'new'].includes(parts[0].toLowerCase())) {
        if (parts.length === 1) {
          firstName = parts[0];
          lastName = '-';
        } else if (parts.length >= 2) {
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        }
      }
    }
  }

  // 3. Email username fallback
  if (firstName === '-' && email !== '-') {
    const uname = email.split('@')[0].replace(/[^a-zA-Z]/g, ' ');
    const parts = uname.trim().split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      if (parts.length > 1) {
        lastName = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      } else {
        lastName = '-';
      }
    }
  }

  if (firstName !== '-') {
    firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  }
  if (lastName !== '-' && lastName !== '') {
    lastName = lastName.charAt(0).toUpperCase() + lastName.slice(1);
  } else {
    lastName = '-';
  }

  return {
    firstName,
    lastName,
    email,
    organization: org,
    jobTitle: title,
    city,
    phone,
    approvalStatus: 'approved',
    questions: '-'
  };
}
