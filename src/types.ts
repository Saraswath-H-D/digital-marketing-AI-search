export interface Lead {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  registrationTime: string | null;
  approvalStatus: string;
  city: string | null;
  phone: string | null;
  organization: string | null; // Company
  jobTitle: string | null;
  questions: string | null;
  sourceName: string | null;
  createdAt: string;
  isSaved: boolean;
  emailUnlocked: boolean;
  phoneUnlocked: boolean;
  // Extended Enterprise Fields
  seniority?: string;
  companySize?: string;
  industry?: string;
  emailStatus?: 'Verified' | 'Risky' | 'Invalid';
  intent?: 'High Intent' | 'Medium Intent' | 'Low Intent';
  technologies?: string[];
  tags?: string[];
  notes?: string;
  linkedinUrl?: string;
  aiScore?: number;
  aiValueReasons?: string[];
  state?: string;
  country?: string;
  department?: string;
  website?: string;
  companyLinkedinUrl?: string;
  revenue?: string;
  funding?: string;
  // Reliable per-upload-batch identifier, independent of sourceName. sourceName is a
  // per-row lead-origin value (e.g. from the CSV's own "Source" column) and can differ
  // row-to-row within one upload; csvTag is the tag the user gave THIS UPLOAD and is
  // stamped identically on every row in the batch, so searching/selecting/deleting by
  // tag reliably captures the whole upload regardless of individual sourceName values.
  csvTag?: string | null;
  // Which group(s)/pod(s) this lead belongs to — a labeling/filtering convenience
  // only, NOT an access-control boundary (this app has no enforced authentication and
  // Supabase RLS is fully public — see podTags on Company for the same caveat in one
  // place, not repeated on every field). An array (not a single value) so the same
  // central record can belong to multiple pods without duplicating it — see the
  // merge-on-duplicate-import logic in leadStorage.ts's bulkImportLeads.
  podTags?: string[];
}

export interface Company {
  id: number;
  name: string;
  domain: string | null;
  linkedinUrl?: string | null;
  industry?: string | null;
  companySize?: string | null; // "Employee Size" in the Add Single Company form
  city?: string | null;
  state?: string | null;
  country?: string | null;
  // User-defined, freeform "Company Tags" — distinct from podTags below (those are
  // group/pod membership; this is arbitrary, editable, multi-value tagging, same
  // relationship as Lead.tags vs Lead.csvTag).
  tags?: string[];
  // Which group(s)/pod(s) this company belongs to — same labeling-only caveat as
  // Lead.podTags above: NOT a security/access-control boundary. This app has no
  // enforced authentication anywhere (Firebase login is cosmetic) and Supabase's
  // row-level security policies are public (`USING (true)`) for every operation, so
  // podTags only filters what the CURRENT app UI chooses to show — it never restricts
  // who can read or write a record. Real per-pod privacy would require actual
  // authentication wired into Supabase RLS, which is a separate, larger project. An
  // array so a company uploaded independently by two different pods collapses onto
  // ONE central record carrying both pods, instead of duplicating — see the
  // merge-on-duplicate-import logic in companyStorage.ts's bulkImportCompanies.
  podTags?: string[];
  createdAt: string;
}

export interface FilterOptions {
  jobTitles: string[];
  companies: string[];
  cities: string[];
  sources: string[];
  // Distinct csv_tag values (the upload-batch identity — separate from sourceName,
  // see Lead.csvTag's doc comment), surfaced as its own dedicated filter section.
  csvTags?: string[];
  statuses: string[];
  customFilters?: Record<string, string[]>;
  seniorities?: string[];
  companySizes?: string[];
  industries?: string[];
  intents?: string[];
  emailStatuses?: string[];
  technologies?: string[];
  tags?: string[];
  states?: string[];
  countries?: string[];
}

export interface Filters {
  search: string;
  jobTitles: string[];
  companies: string[];
  cities: string[];
  sources: string[];
  csvTags?: string[];
  statuses: string[];
  customFilters?: Record<string, string[]>;
  savedOnly: boolean;
  netNewOnly?: boolean;
  selectedList?: string | null;
  persona?: string | null;
  emailStatuses?: string[];
  peopleLookalike?: string | null;
  companyLookalike?: string | null;
  educations?: string[];
  enrichmentTypes?: string[];
  // Extended Enterprise Filters
  seniorities?: string[];
  companySizes?: string[];
  industries?: string[];
  locations?: string[];
  states?: string[];
  countries?: string[];
  intents?: string[];
  technologies?: string[];
  tags?: string[];
  departments?: string[];
  funding?: string[];
  revenue?: string[];
}

export interface SavedSearch {
  id: string;
  name: string;
  count: number;
  lastUpdated: string;
  createdDate: string;
  filters: Filters;
}

// A named, reusable Ideal Customer Profile — narrower than SavedSearch (which embeds a
// whole arbitrary Filters snapshot): an ICP is deliberately scoped to just Job Titles +
// Industries, matching how it's defined and applied to future searches/campaign
// targeting.
export interface CustomICP {
  id: number;
  name: string;
  jobTitles: string[];
  industries: string[];
  createdAt: string;
}

export interface OutreachCampaign {
  id: string;
  name: string;
  status: 'Active' | 'Paused' | 'Completed' | 'Draft';
  contactsCount: number;
  emailsSent: number;
  openRate: number;
  replyRate: number;
  bounceRate: number;
  createdAt: string;
}

export interface AuthState {
  user: any;
  loading: boolean;
  token: string | null;
}
