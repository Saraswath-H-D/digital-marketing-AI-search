// Shared CSV parsing / column-mapping engine — extracted out of CsvImporter.tsx so the
// AI Assistant's chat-driven CSV upload (AICopilotDrawer) can reuse the exact same
// header-detection, alias-matching, and lead-mapping logic as the manual importer,
// instead of maintaining a second, drifting copy of it.
import Papa from 'papaparse';
import { normalizeCityName, normalizeNameOrTitle } from '../data/leadStorage.ts';

export interface SystemField {
  key: string;
  label: string;
  required: boolean;
  aliases: string[];
}

// System 18 Standard Headers Configuration & Auto-Detect Aliases
export const SYSTEM_FIELDS: SystemField[] = [
  { key: 'firstName', label: 'First Name', required: true, aliases: ['fast name', 'first name', 'firstname', 'fname', 'first_name', 'f_name', 'given name', 'given_name', 'f name', 'first'] },
  { key: 'lastName', label: 'Last Name', required: false, aliases: ['lastname', 'last name', 'lname', 'last_name', 'l_name', 'surname', 'family name', 'family_name', 'l name', 'last'] },
  { key: 'email', label: 'Email', required: true, aliases: ['email', 'email address', 'primary email', 'work email', 'mail', 'e-mail', 'contact email', 'email_id', 'emailid'] },
  { key: 'phone', label: 'Phone Number', required: false, aliases: ['phone number', 'phone', 'mobile', 'telephone', 'contact number', 'cell', 'phone_no', 'mobile_no', 'phone_number'] },
  { key: 'jobTitle', label: 'Job Title', required: false, aliases: ['jobtitle', 'job title', 'title', 'role', 'designation', 'position', 'occupation', 'job_title'] },
  { key: 'organization', label: 'Company Name', required: false, aliases: ['companyname', 'company name', 'company', 'organization', 'org', 'employer', 'business', 'firm', 'company_name', 'organization_name'] },
  { key: 'city', label: 'City', required: false, aliases: ['city', 'city_name', 'town', 'address', 'person location', 'location'] },
  { key: 'state', label: 'State', required: false, aliases: ['state', 'province', 'state_name', 'region'] },
  { key: 'country', label: 'Country', required: false, aliases: ['country', 'nation', 'country_name'] },
  { key: 'sourceName', label: 'Source', required: false, aliases: ['source', 'source name', 'source_name', 'lead source', 'lead_source', 'registration source', 'channel', 'utm_source'] },
  { key: 'emailStatus', label: 'Email Status', required: false, aliases: ['email status', 'email verification status', 'email_status', 'verification status', 'deliverability', 'email_verification_status'] },
  { key: 'seniority', label: 'Seniority', required: false, aliases: ['seniority', 'management level', 'seniority level', 'level', 'seniority_level', 'job level', 'experience level'] },
  { key: 'department', label: 'Department', required: false, aliases: ['department', 'dept', 'function', 'team', 'department_name', 'business unit'] },
  { key: 'industry', label: 'Industry', required: false, aliases: ['industry', 'sector', 'market sector', 'domain', 'business_type', 'industry_name'] },
  { key: 'companySize', label: 'Employee Size', required: false, aliases: ['employee size', 'company size', 'employee headcount', 'headcount', 'no of employees', 'number of employees', 'employees', 'company_size', 'employee_size'] },
  { key: 'linkedinUrl', label: 'Person Linkedin Url', required: false, aliases: ['person linkdin url', 'person linkedin url', 'linkedin', 'linkedin url', 'linkedin_url', 'person linkedin', 'linkedin profile', 'profile url'] },
  { key: 'website', label: 'Website', required: false, aliases: ['website', 'company website', 'url', 'web', 'domain', 'company url', 'site'] },
  { key: 'companyLinkedinUrl', label: 'Company Linkedin Url', required: false, aliases: ['company linkdin url', 'company linkedin url', 'company linkedin', 'company_linkedin_url', 'org linkedin', 'organization linkedin'] },
  { key: 'registrationTime', label: 'Registration Time', required: false, aliases: ['registration time', 'registrationtime', 'registration_time', 'reg time', 'registered at', 'registered on', 'submitted at', 'timestamp', 'created time', 'date registered'] },
  { key: 'approvalStatus', label: 'Approval Status', required: false, aliases: ['approval status', 'approvalstatus', 'approval_status', 'registration status', 'rsvp status', 'attendee status'] },
  { key: 'questions', label: 'Questions to Speaker', required: false, aliases: ['questions', 'question', 'questions to speaker', 'attendee questions', 'comments', 'remarks'] },
];

// Scan every system field against every CSV column and produce a collision-free
// mapping: all fields get a shot at an EXACT synonym match first (so e.g. an "Email
// Status" column is claimed by the emailStatus field before the email field's looser
// substring match can steal it), then any still-unmapped fields fall back to substring
// matching against whatever columns remain unclaimed.
export const autoDetectAllColumns = (fields: SystemField[], csvHeaders: string[]): Record<string, string> => {
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();

  // Pass 1: exact (whole-header) synonym match
  fields.forEach(field => {
    for (const csvH of csvHeaders) {
      if (usedHeaders.has(csvH)) continue;
      const cleanH = csvH.toLowerCase().trim();
      if (field.aliases.some(alias => cleanH === alias.toLowerCase().trim())) {
        mapping[field.key] = csvH;
        usedHeaders.add(csvH);
        break;
      }
    }
  });

  // Pass 2: substring synonym match, only among columns no other field has claimed yet.
  // Skip question-phrased headers here (e.g. "Do Have A Source Name" — a yes/no
  // attendee question, not an actual source value) since a long free-text sentence
  // can coincidentally contain a short alias as a substring; only an exact match
  // (pass 1) should ever claim those.
  const looksLikeQuestion = (h: string): boolean => {
    const words = h.trim().split(/\s+/);
    if (words.length > 5) return true;
    return /^(do|did|does|have|has|are|is|will|would|can|could|should)\s/i.test(h.trim()) || /\?\s*$/.test(h.trim());
  };
  fields.forEach(field => {
    if (mapping[field.key]) return;
    for (const csvH of csvHeaders) {
      if (usedHeaders.has(csvH)) continue;
      const cleanH = csvH.toLowerCase().trim();
      if (looksLikeQuestion(cleanH)) continue;
      if (field.aliases.some(alias => cleanH.includes(alias.toLowerCase().trim()))) {
        mapping[field.key] = csvH;
        usedHeaders.add(csvH);
        break;
      }
    }
  });

  return mapping;
};

// Score how strongly a raw row looks like the real header row — how many of its cells
// match a known field alias. Report-style exports (Zoom webinar registration reports,
// event platform exports, etc.) prepend several title/summary rows before the actual
// attendee table; Papa.parse's header:true assumes row 1 is always the header, which
// would treat that preamble as columns and silently mis-map every field.
const scoreHeaderRow = (row: string[]): number => {
  let score = 0;
  row.forEach(cell => {
    const clean = (cell || '').toLowerCase().trim();
    if (!clean) return;
    const isMatch = SYSTEM_FIELDS.some(f =>
      f.aliases.some(alias => clean === alias || clean.includes(alias))
    );
    if (isMatch) score += 1;
  });
  return score;
};

export type ParseCsvResult =
  | { ok: true; headers: string[]; rows: Record<string, string>[]; skippedPreambleRows: number }
  | { ok: false; error: string };

// This project's tsconfig doesn't enable `strict`/`strictNullChecks`, so a plain
// `if (!result.ok)` doesn't reliably narrow this discriminated union — an explicit type
// predicate does, regardless of that setting.
export function isCsvParseError(r: ParseCsvResult): r is { ok: false; error: string } {
  return r.ok === false;
}

// Parse a CSV File into { headers, rows }, auto-locating the real header row (skipping
// any report/summary preamble rows). Resolves with a discriminated result instead of
// throwing so callers (manual importer UI, AI chat flow) can render/speak the exact
// same natural-language error message.
export function parseCsvFile(file: File): Promise<ParseCsvResult> {
  return new Promise<ParseCsvResult>((resolve) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parse warnings:', results.errors);
        }

        const rows = results.data as string[][];
        if (rows.length === 0) {
          resolve({ ok: false, error: 'The uploaded CSV file is empty.' });
          return;
        }

        const SCAN_LIMIT = Math.min(20, rows.length);
        let bestIdx = 0;
        let bestScore = -1;
        for (let i = 0; i < SCAN_LIMIT; i++) {
          const row = rows[i];
          const nonEmptyCount = row.filter(c => (c || '').trim()).length;
          if (nonEmptyCount < 2) continue;
          const score = scoreHeaderRow(row);
          if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }
        const headerRowIdx = bestScore >= 2 ? bestIdx : 0;

        const headerRow = rows[headerRowIdx].map(h => (h || '').trim());
        const headers = headerRow.filter(Boolean);

        if (headers.length === 0) {
          resolve({ ok: false, error: 'Could not find a valid header row in this CSV file.' });
          return;
        }

        const data = rows
          .slice(headerRowIdx + 1)
          .filter(r => r.some(c => (c || '').trim()))
          .map(r => {
            const obj: Record<string, string> = {};
            headerRow.forEach((h, idx) => {
              if (h) obj[h] = r[idx] !== undefined ? r[idx] : '';
            });
            return obj;
          });

        if (data.length === 0) {
          resolve({ ok: false, error: 'No contact rows found below the header row in this CSV file.' });
          return;
        }

        resolve({ ok: true, headers, rows: data, skippedPreambleRows: headerRowIdx });
      },
      error: (err: any) => {
        resolve({ ok: false, error: `Failed to parse CSV file: ${err?.message || 'Unknown parse error'}` });
      }
    });
  });
}

// Best-effort automatic header→field mapping, including the "single full-name column"
// fallback used when no separate first/last name columns were detected.
export function buildAutoMapping(headers: string[]): Record<string, string> {
  const initialMapping = autoDetectAllColumns(SYSTEM_FIELDS, headers);
  if (!initialMapping.firstName) {
    const fullNameCol = headers.find(h => ['full name', 'fullname', 'contact name', 'attendee name', 'name'].includes(h.toLowerCase().trim()));
    if (fullNameCol) {
      initialMapping.firstName = fullNameCol;
    }
  }
  return initialMapping;
}

// Map raw CSV rows (keyed by original header) into lead-shaped objects using a given
// header mapping. Does NOT set csvTag/sourceName-as-tag — callers stamp the tag
// themselves so the "no tag" (null) path never gets invented here.
export function mapRowsToLeads(rows: Record<string, string>[], headerMapping: Record<string, string>, rawHeaders: string[]): any[] {
  return rows.map((r: any) => {
    const getVal = (sysKey: string): string => {
      const mappedCsvHeader = headerMapping[sysKey];
      if (!mappedCsvHeader || r[mappedCsvHeader] === undefined || r[mappedCsvHeader] === null) {
        return '';
      }
      return String(r[mappedCsvHeader]).trim();
    };

    let fName = getVal('firstName');
    let lName = getVal('lastName');

    // If First Name mapping points to a full name column, split it
    if (fName && (!lName || lName === '-') && fName.includes(' ')) {
      const parts = fName.split(/\s+/);
      fName = parts[0] || '';
      lName = parts.slice(1).join(' ');
    }

    const cleanVal = (val: any) => {
      if (val === undefined || val === null) return '-';
      const str = String(val).trim();
      return (str === '' || str === 'undefined' || str === 'null') ? '-' : str;
    };

    const leadObj: any = {
      _csvHeaders: rawHeaders,
      firstName: normalizeNameOrTitle(fName),
      lastName: normalizeNameOrTitle(lName),
      email: cleanVal(getVal('email')),
      phone: cleanVal(getVal('phone')),
      jobTitle: normalizeNameOrTitle(getVal('jobTitle')),
      organization: normalizeNameOrTitle(getVal('organization')),
      city: normalizeCityName(getVal('city')),
      state: cleanVal(getVal('state')),
      country: cleanVal(getVal('country')),
      sourceName: getVal('sourceName') ? getVal('sourceName').replace(/\s+/g, '-') : '-',
      emailStatus: cleanVal(getVal('emailStatus')) || 'Verified',
      seniority: cleanVal(getVal('seniority')),
      department: cleanVal(getVal('department')),
      industry: cleanVal(getVal('industry')),
      companySize: cleanVal(getVal('companySize')),
      linkedinUrl: cleanVal(getVal('linkedinUrl')),
      website: cleanVal(getVal('website')),
      companyLinkedinUrl: cleanVal(getVal('companyLinkedinUrl')),
      registrationTime: cleanVal(getVal('registrationTime') || new Date().toLocaleString()),
      approvalStatus: cleanVal(getVal('approvalStatus') || 'approved'),
      questions: cleanVal(getVal('questions')),
    };

    // Also copy all original raw CSV fields onto lead object for custom field support
    Object.keys(r).forEach(k => {
      if (k.trim()) leadObj[k.trim()] = r[k];
    });

    const hasAnyData = Object.values(r).some(v => v !== undefined && v !== null && String(v).trim() !== '');
    return hasAnyData ? leadObj : null;
  }).filter(Boolean);
}
