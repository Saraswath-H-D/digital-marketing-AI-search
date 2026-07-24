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
}

export interface FilterOptions {
  jobTitles: string[];
  companies: string[];
  cities: string[];
  sources: string[];
  statuses: string[];
  customFilters?: Record<string, string[]>;
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
  // Newly activated sidebar filters
  persona?: string | null;
  emailStatuses?: string[];
  peopleLookalike?: string | null;
  companyLookalike?: string | null;
  educations?: string[];
  enrichmentTypes?: string[];
}


export interface AuthState {
  user: any;
  loading: boolean;
  token: string | null;
}
