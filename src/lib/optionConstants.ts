// Shared option lists for Seniority / Industry / Employee Size — used by both
// AddLeadModal.tsx and AddCompanyModal.tsx (previously duplicated separately in each
// file) and kept consistent with the equivalent lists in leadStorage.ts's
// getFilterOptions() static fallbacks.
export const SENIORITY_OPTIONS = [
  'C-Suite', 'VP / Vice President', 'Director', 'Manager', 'Owner / Partner', 'Entry Level',
];

export const INDUSTRY_OPTIONS = [
  'Software & SaaS', 'Financial Services', 'Healthcare & Biotech', 'Marketing & Advertising',
  'E-Commerce & Retail', 'Education & Research', 'Consulting & IT',
];

export const EMPLOYEE_SIZE_OPTIONS = [
  '1-10 employees', '11-50 employees', '51-200 employees', '201-500 employees', '501-1000 employees', '1000+ employees',
];
