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
}

export interface FilterOptions {
  jobTitles: string[];
  companies: string[];
  cities: string[];
  sources: string[];
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
