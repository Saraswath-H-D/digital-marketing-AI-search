import React, { useState, useMemo } from 'react';
import { Filters, FilterOptions } from '../types.ts';
import { formatHeaderName } from '../data/leadStorage.ts';
import { 
  ChevronDown, 
  ChevronUp,
  X, 
  RefreshCw, 
  Search,
  SlidersHorizontal,
  Tag,
  RotateCcw,
  Users,
  Building,
  Briefcase,
  MapPin,
  ShieldCheck,
  Zap,
  HelpCircle,
  Check,
  Layers,
  Sparkles,
  Bookmark,
  Filter
} from 'lucide-react';

interface FiltersSidebarProps {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  filterOptions: FilterOptions;
  onClear: () => void;
  isLoading: boolean;
}

export default function FiltersSidebar({
  filters,
  setFilters,
  filterOptions,
  onClear,
  isLoading,
}: FiltersSidebarProps) {
  // Global filter search state
  const [filterSearch, setFilterSearch] = useState('');
  
  // Custom Accordion Open/Closed State
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    persona: true,
    jobTitles: true,
    seniority: true,
    companySize: true,
    industry: true,
    cities: false,
    companies: false,
    emailStatuses: false,
    intents: false,
    technologies: false,
    sources: false,
    statuses: false,
    csvColumns: false,
  });

  // Option Search strings for each category
  const [optionSearches, setOptionSearches] = useState<Record<string, string>>({});
  
  // Dedicated Job Title Search Input
  const [jobTitleInput, setJobTitleInput] = useState('');

  // Toggle accordion section
  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // CSV Columns filter options
  const customFiltersObj = filterOptions.customFilters || {};
  const totalCustomColumnCount = Object.keys(customFiltersObj).length;

  // Active filter counts
  const activeCounts = useMemo(() => {
    let count = 0;
    if (filters.persona) count += 1;
    if (filters.jobTitles?.length) count += filters.jobTitles.length;
    if (filters.seniorities?.length) count += filters.seniorities.length;
    if (filters.cities?.length) count += filters.cities.length;
    if (filters.companies?.length) count += filters.companies.length;
    if (filters.companySizes?.length) count += filters.companySizes.length;
    if (filters.industries?.length) count += filters.industries.length;
    if (filters.emailStatuses?.length) count += filters.emailStatuses.length;
    if (filters.intents?.length) count += filters.intents.length;
    if (filters.technologies?.length) count += filters.technologies.length;
    if (filters.sources?.length) count += filters.sources.length;
    if (filters.statuses?.length) count += filters.statuses.length;
    if (filters.tags?.length) count += filters.tags.length;
    if (filters.savedOnly) count += 1;
    if (filters.netNewOnly) count += 1;
    if (filters.customFilters) {
      count += Object.values(filters.customFilters).reduce((acc, vals) => acc + (vals ? vals.length : 0), 0);
    }
    return count;
  }, [filters]);

  const hasActiveFilters = activeCounts > 0;

  const handleClearAll = () => {
    setFilters(prev => ({
      search: '',
      jobTitles: [],
      companies: [],
      cities: [],
      sources: [],
      statuses: [],
      savedOnly: false,
      netNewOnly: false,
      selectedList: null,
      persona: null,
      emailStatuses: [],
      seniorities: [],
      companySizes: [],
      industries: [],
      intents: [],
      technologies: [],
      tags: [],
      customFilters: {},
    }));
    onClear();
  };

  // Helper checkbox handler for array filters
  const toggleArrayFilter = (key: keyof Filters, item: string) => {
    setFilters(prev => {
      const current = (prev[key] as string[]) || [];
      const updated = current.includes(item)
        ? current.filter(v => v !== item)
        : [...current, item];
      return { ...prev, [key]: updated };
    });
  };

  // Helper to render searchable filter category accordion
  const renderFilterAccordion = (
    id: string,
    title: string,
    icon: React.ReactNode,
    options: string[],
    selectedItems: string[],
    onToggle: (val: string) => void,
    badgeColor: string = 'bg-purple-600'
  ) => {
    const isOpen = !!openSections[id];
    const query = (optionSearches[id] || filterSearch || '').trim().toLowerCase();
    const filteredOptions = query
      ? options.filter(opt => opt.toLowerCase().includes(query))
      : options;

    if (filterSearch && filteredOptions.length === 0 && !title.toLowerCase().includes(filterSearch.toLowerCase())) {
      return null;
    }

    return (
      <div key={id} className="select-none">
        <button
          onClick={() => toggleSection(id)}
          className={`w-full flex items-center justify-between py-2.5 px-3 rounded-2xl border transition-all duration-200 text-left cursor-pointer group super-3d-card ${
            selectedItems.length > 0
              ? 'bg-[var(--accent-primary-soft)] border-purple-300 text-[var(--accent-section)] font-black shadow-xs'
              : 'bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] border-[var(--border-subtle)] text-[var(--text-secondary)] font-bold'
          }`}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border ${
              selectedItems.length > 0 ? 'bg-purple-600 text-white border-purple-700' : 'bg-[var(--accent-primary-soft)] text-purple-600 border-[var(--border-subtle)]'
            }`}>
              {icon}
            </div>
            <span className="text-xs tracking-tight truncate max-w-[150px]">{title}</span>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {selectedItems.length > 0 && (
              <span className={`px-2 py-0.5 text-[9px] font-black text-white rounded-full ${badgeColor}`}>
                {selectedItems.length}
              </span>
            )}
            <div className="w-5 h-5 rounded-full bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] flex items-center justify-center">
              {isOpen ? <ChevronUp className="w-3 h-3 text-purple-700" /> : <ChevronDown className="w-3 h-3 text-purple-700" />}
            </div>
          </div>
        </button>

        {isOpen && (
          <div className="p-3 bg-[var(--surface-card-elevated)] rounded-2xl border border-[var(--border-subtle)] shadow-xs space-y-2 mt-1 animate-fadeIn super-3d-card">
            {options.length > 5 && (
              <div className="relative mb-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-purple-400">
                  <Search className="w-3 h-3" />
                </span>
                <input
                  type="text"
                  value={optionSearches[id] || ''}
                  onChange={(e) => setOptionSearches(prev => ({ ...prev, [id]: e.target.value }))}
                  placeholder={`Search ${title.toLowerCase()}...`}
                  className="w-full pl-7 pr-6 py-1 text-xs border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-purple-500 bg-[var(--surface-input)] text-[var(--text-primary)] font-bold"
                />
                {optionSearches[id] && (
                  <button
                    type="button"
                    onClick={() => setOptionSearches(prev => ({ ...prev, [id]: '' }))}
                    className="absolute inset-y-0 right-0 flex items-center pr-2 text-[var(--text-muted)] hover:text-purple-600"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            )}

            <div className="space-y-1 max-h-44 overflow-y-auto scrollbar-thin pr-1">
              {filteredOptions.length === 0 ? (
                <p className="text-2xs text-[var(--text-muted)] italic py-1 text-center">No options match</p>
              ) : (
                filteredOptions.map(val => {
                  const isChecked = selectedItems.includes(val);
                  return (
                    <label 
                      key={val} 
                      className={`flex items-center space-x-2 py-1 px-2 rounded-xl cursor-pointer text-xs transition-colors border ${
                        isChecked 
                          ? 'bg-[var(--accent-primary-soft)] border-purple-300 text-[var(--accent-section)] font-black shadow-2xs' 
                          : 'hover:bg-[var(--surface-hover)] border-transparent text-[var(--text-secondary)] font-semibold'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggle(val)}
                        className="w-3.5 h-3.5 rounded-sm text-purple-600 border-purple-300 focus:ring-purple-500 cursor-pointer accent-purple-600"
                      />
                      <span className="truncate">{val}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside id="filters-sidebar" className="w-80 border-r border-[var(--border-subtle)] bg-[var(--surface-card)] flex flex-col h-full overflow-hidden select-none shrink-0">
      
      {/* Sidebar Top Header & Reset Button */}
      <div className="p-3.5 bg-gradient-to-r from-purple-100 via-pink-50 to-purple-100 dark:from-purple-500/10 dark:via-transparent dark:to-purple-500/10 border-b border-[var(--border-subtle)] shrink-0 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 text-white flex items-center justify-center shadow-xs">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-black text-xs tracking-tight uppercase text-[var(--text-primary)] font-display">Filters</span>
              {activeCounts > 0 && (
                <span className="px-2 py-0.5 text-[9px] font-black text-white bg-purple-600 rounded-full shadow-2xs">
                  {activeCounts} Active
                </span>
              )}
            </div>
            <p className="text-[10px] text-[var(--text-muted)] font-bold">Target People & Firmographics</p>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleClearAll}
            className="text-2xs font-black text-[var(--text-primary)] flex items-center space-x-1 px-2.5 py-1 bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] border border-purple-300 rounded-xl transition-all cursor-pointer shadow-2xs"
            title="Reset all active search filters"
          >
            <RotateCcw className="w-3 h-3 text-purple-600" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Global Filter Search Input */}
      <div className="p-3 border-b border-[var(--border-subtle)] bg-[var(--surface-card-header)] shrink-0">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-purple-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="Search all filters & options..."
            className="w-full pl-9 pr-8 py-2 text-xs border border-[var(--border-input)] rounded-2xl focus:outline-none focus:border-purple-500 transition-all bg-[var(--surface-input)] font-bold text-[var(--text-primary)] placeholder-slate-400 shadow-2xs"
          />
          {filterSearch && (
            <button
              type="button"
              onClick={() => setFilterSearch('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-muted)] hover:text-purple-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Categorized Filters Accordion Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">

        {/* SECTION 1: PEOPLE FILTERS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black tracking-widest text-[var(--accent-section)] uppercase flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              PEOPLE FILTERS
            </span>
          </div>

          {/* 1. Job Titles & Roles Filter (TOP OF PEOPLE FILTERS WITH SEARCH BAR) */}
          <div className="select-none">
            <button
              onClick={() => toggleSection('jobTitles')}
              className={`w-full flex items-center justify-between py-2.5 px-3 rounded-2xl border transition-all duration-200 text-left cursor-pointer group super-3d-card ${
                filters.jobTitles && filters.jobTitles.length > 0
                  ? 'bg-[var(--accent-primary-soft)] border-purple-300 text-[var(--accent-section)] font-black shadow-xs'
                  : 'bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] border-[var(--border-subtle)] text-[var(--text-secondary)] font-bold'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border ${
                  filters.jobTitles && filters.jobTitles.length > 0 ? 'bg-purple-600 text-white border-purple-700' : 'bg-[var(--accent-primary-soft)] text-purple-600 border-[var(--border-subtle)]'
                }`}>
                  <Briefcase className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black tracking-tight truncate">Job Titles & Roles</span>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                {filters.jobTitles && filters.jobTitles.length > 0 && (
                  <span className="px-2 py-0.5 text-[9px] font-black text-white bg-purple-600 rounded-full shadow-2xs">
                    {filters.jobTitles.length} Active
                  </span>
                )}
                <div className="w-5 h-5 rounded-full bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] flex items-center justify-center">
                  {openSections.jobTitles ? <ChevronUp className="w-3 h-3 text-purple-700" /> : <ChevronDown className="w-3 h-3 text-purple-700" />}
                </div>
              </div>
            </button>

            {openSections.jobTitles && (
              <div className="p-3 bg-[var(--surface-card-elevated)] rounded-2xl border border-[var(--border-subtle)] shadow-xs space-y-2.5 mt-1 animate-fadeIn super-3d-card">
                {/* Dedicated Job Title Search & Add Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (jobTitleInput.trim()) {
                      const cleanTitle = jobTitleInput.trim();
                      if (!filters.jobTitles?.includes(cleanTitle)) {
                        setFilters(prev => ({
                          ...prev,
                          jobTitles: [...(prev.jobTitles || []), cleanTitle]
                        }));
                      }
                      setJobTitleInput('');
                    }
                  }}
                  className="relative flex items-center space-x-1.5"
                >
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-purple-500">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      value={jobTitleInput}
                      onChange={(e) => setJobTitleInput(e.target.value)}
                      placeholder="Type or search job title (e.g. CEO)..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-purple-500 bg-[var(--surface-input)] text-[var(--text-primary)] font-bold placeholder-slate-400"
                    />
                    {jobTitleInput && (
                      <button
                        type="button"
                        onClick={() => setJobTitleInput('')}
                        className="absolute inset-y-0 right-0 flex items-center pr-2 text-[var(--text-muted)] hover:text-purple-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={!jobTitleInput.trim()}
                    className="px-2.5 py-1.5 text-xs font-black bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-40 transition-all cursor-pointer shrink-0 shadow-2xs"
                  >
                    + Add
                  </button>
                </form>

                {/* Active Selected Job Title Chips */}
                {filters.jobTitles && filters.jobTitles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 pb-1 border-b border-purple-100">
                    {filters.jobTitles.map(t => (
                      <span
                        key={t}
                        className="inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-black bg-purple-100 text-purple-950 border border-purple-300 rounded-lg shadow-2xs"
                      >
                        <span className="truncate max-w-[140px]">{t}</span>
                        <button
                          type="button"
                          onClick={() => toggleArrayFilter('jobTitles', t)}
                          className="hover:text-purple-600 focus:outline-none cursor-pointer"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Matching Job Title Database Options */}
                <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                  {((filterOptions.jobTitles || []).filter(opt => 
                    !jobTitleInput.trim() || opt.toLowerCase().includes(jobTitleInput.trim().toLowerCase())
                  )).length === 0 ? (
                    <p className="text-2xs text-[var(--text-muted)] italic py-1 text-center">No matching titles in database. Press "+ Add" above to use "{jobTitleInput.trim()}".</p>
                  ) : (
                    ((filterOptions.jobTitles || []).filter(opt => 
                      !jobTitleInput.trim() || opt.toLowerCase().includes(jobTitleInput.trim().toLowerCase())
                    )).map(val => {
                      const isChecked = (filters.jobTitles || []).includes(val);
                      return (
                        <label 
                          key={val} 
                          className={`flex items-center space-x-2 py-1 px-2 rounded-xl cursor-pointer text-xs transition-colors border ${
                            isChecked 
                              ? 'bg-[var(--accent-primary-soft)] border-purple-300 text-[var(--accent-section)] font-black shadow-2xs' 
                              : 'hover:bg-[var(--surface-hover)] border-transparent text-[var(--text-secondary)] font-semibold'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleArrayFilter('jobTitles', val)}
                            className="w-3.5 h-3.5 rounded-sm text-purple-600 border-purple-300 focus:ring-purple-500 cursor-pointer accent-purple-600"
                          />
                          <span className="truncate">{val}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Target Persona ICP Filter */}
          <div className="select-none">
            <button
              onClick={() => toggleSection('persona')}
              className={`w-full flex items-center justify-between py-2.5 px-3 rounded-2xl border transition-all text-left cursor-pointer super-3d-card ${
                filters.persona
                  ? 'bg-[var(--accent-primary-soft)] border-purple-300 text-[var(--accent-section)] font-black shadow-xs'
                  : 'bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] border-[var(--border-subtle)] text-[var(--text-secondary)] font-bold'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border ${
                  filters.persona ? 'bg-purple-600 text-white border-purple-700' : 'bg-[var(--accent-primary-soft)] text-purple-600 border-[var(--border-subtle)]'
                }`}>
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs truncate">Target Persona ICP</span>
              </div>
              <div className="flex items-center space-x-1.5 shrink-0">
                {filters.persona && (
                  <span className="px-2 py-0.5 text-[9px] font-black text-white bg-purple-600 rounded-full">
                    1 Active
                  </span>
                )}
                <div className="w-5 h-5 rounded-full bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] flex items-center justify-center">
                  {openSections.persona ? <ChevronUp className="w-3 h-3 text-purple-700" /> : <ChevronDown className="w-3 h-3 text-purple-700" />}
                </div>
              </div>
            </button>

            {openSections.persona && (
              <div className="p-2.5 bg-[var(--surface-card-elevated)] rounded-2xl border border-[var(--border-subtle)] space-y-1 mt-1 animate-fadeIn super-3d-card">
                {['Founders & Executives', 'Finance Leaders', 'Auditors & Accountants', 'Marketing & Growth', 'Sales & Business Dev'].map(p => (
                  <button
                    key={p}
                    onClick={() => setFilters(prev => ({ ...prev, persona: prev.persona === p ? null : p }))}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all ${
                      filters.persona === p
                        ? 'bg-purple-600 text-white font-black shadow-xs'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] font-semibold'
                    }`}
                  >
                    <span>{p}</span>
                    {filters.persona === p && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Seniority / Management Level */}
          {renderFilterAccordion(
            'seniority',
            'Management Level',
            <SlidersHorizontal className="w-3.5 h-3.5" />,
            filterOptions.seniorities || ['C-Suite', 'VP / Vice President', 'Director', 'Manager', 'Owner / Partner', 'Entry Level'],
            filters.seniorities || [],
            (val) => toggleArrayFilter('seniorities', val)
          )}

          {/* Person Location / Cities */}
          {renderFilterAccordion(
            'cities',
            'Person Location / City',
            <MapPin className="w-3.5 h-3.5" />,
            filterOptions.cities || [],
            filters.cities || [],
            (val) => toggleArrayFilter('cities', val)
          )}
        </div>

        {/* SECTION 2: COMPANY FILTERS (FIRMOGRAPHICS) */}
        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black tracking-widest text-[var(--accent-section)] uppercase flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-emerald-600" />
              COMPANY & FIRMOGRAPHICS
            </span>
          </div>

          {/* Companies / Organizations */}
          {renderFilterAccordion(
            'companies',
            'Company / Organization',
            <Building className="w-3.5 h-3.5" />,
            filterOptions.companies || [],
            filters.companies || [],
            (val) => toggleArrayFilter('companies', val),
            'bg-emerald-600'
          )}

          {/* Employee Headcount / Company Size */}
          {renderFilterAccordion(
            'companySize',
            'Employee Headcount',
            <Users className="w-3.5 h-3.5" />,
            filterOptions.companySizes || ['1-10 employees', '11-50 employees', '51-200 employees', '201-500 employees', '501-1000 employees', '1000+ employees'],
            filters.companySizes || [],
            (val) => toggleArrayFilter('companySizes', val),
            'bg-emerald-600'
          )}

          {/* Industry Sectors */}
          {renderFilterAccordion(
            'industry',
            'Industry & Sector',
            <Layers className="w-3.5 h-3.5" />,
            filterOptions.industries || ['Software & SaaS', 'Financial Services', 'Healthcare & Biotech', 'Marketing & Advertising', 'E-Commerce & Retail', 'Education & Research', 'Consulting & IT'],
            filters.industries || [],
            (val) => toggleArrayFilter('industries', val),
            'bg-emerald-600'
          )}

          {/* Tech Stack & Technologies */}
          {renderFilterAccordion(
            'technologies',
            'Technologies Stack',
            <Zap className="w-3.5 h-3.5" />,
            filterOptions.technologies || ['React', 'Salesforce', 'HubSpot', 'AWS', 'Google Cloud', 'Stripe', 'Node.js', 'WordPress'],
            filters.technologies || [],
            (val) => toggleArrayFilter('technologies', val),
            'bg-emerald-600'
          )}
        </div>

        {/* SECTION 3: DATA & SIGNALS */}
        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black tracking-widest text-[var(--accent-section)] uppercase flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />
              DATA & INTENT SIGNALS
            </span>
          </div>

          {/* Email Verification Status */}
          {renderFilterAccordion(
            'emailStatuses',
            'Email Verification',
            <ShieldCheck className="w-3.5 h-3.5" />,
            filterOptions.emailStatuses || ['Valid / Safe', 'Risky / Catch-all', 'Invalid / Bounce'],
            filters.emailStatuses || [],
            (val) => toggleArrayFilter('emailStatuses', val),
            'bg-cyan-600'
          )}

          {/* Buying Intent Level */}
          {renderFilterAccordion(
            'intents',
            'Buying Intent Score',
            <Sparkles className="w-3.5 h-3.5" />,
            filterOptions.intents || ['High Intent', 'Medium Intent', 'Low Intent'],
            filters.intents || [],
            (val) => toggleArrayFilter('intents', val),
            'bg-cyan-600'
          )}

          {/* Lead Source & CSV Tags */}
          {renderFilterAccordion(
            'sources',
            'Lead Source & Tag',
            <Tag className="w-3.5 h-3.5" />,
            filterOptions.sources || [],
            filters.sources || [],
            (val) => toggleArrayFilter('sources', val),
            'bg-cyan-600'
          )}

          {/* Saved Records Quick Filter */}
          <div className="select-none">
            <button
              onClick={() => setFilters(prev => ({ ...prev, savedOnly: !prev.savedOnly, netNewOnly: false }))}
              className={`w-full flex items-center justify-between py-2.5 px-3 rounded-2xl border transition-all text-left cursor-pointer ${
                filters.savedOnly
                  ? 'bg-purple-600 text-white font-black border-purple-700 shadow-xs'
                  : 'bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] border-[var(--border-subtle)] text-[var(--text-secondary)] font-bold'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Bookmark className={`w-4 h-4 ${filters.savedOnly ? 'text-white' : 'text-purple-600'}`} />
                <span className="text-xs">Saved Contacts Only</span>
              </div>
              {filters.savedOnly && <Check className="w-4 h-4 text-white" />}
            </button>
          </div>
        </div>

        {/* SECTION 4: CSV CUSTOM COLUMNS */}
        {totalCustomColumnCount > 0 && (
          <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black tracking-widest text-[var(--accent-section)] uppercase flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-pink-600" />
                CSV COLUMN FILTERS ({totalCustomColumnCount})
              </span>
            </div>

            {Object.entries(customFiltersObj).map(([columnName, options]) => {
              const selectedCustomValues = (filters.customFilters && filters.customFilters[columnName]) || [];
              return renderFilterAccordion(
                `csv_${columnName}`,
                formatHeaderName(columnName),
                <SlidersHorizontal className="w-3.5 h-3.5" />,
                options,
                selectedCustomValues,
                (val) => {
                  setFilters(prev => {
                    const currentCustom = prev.customFilters || {};
                    const currentColVals = currentCustom[columnName] || [];
                    const updatedColVals = currentColVals.includes(val)
                      ? currentColVals.filter(v => v !== val)
                      : [...currentColVals, val];
                    return {
                      ...prev,
                      customFilters: {
                        ...currentCustom,
                        [columnName]: updatedColVals
                      }
                    };
                  });
                },
                'bg-pink-600'
              );
            })}
          </div>
        )}

      </div>

      {/* Sync / Loading Footer Overlay */}
      {isLoading && (
        <div className="px-4 py-2 bg-[var(--accent-primary-soft)] border-t border-[var(--border-subtle)] flex items-center justify-center space-x-2 text-2xs font-extrabold text-purple-600 animate-pulse shrink-0">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" />
          <span>Refreshing search filters...</span>
        </div>
      )}
    </aside>
  );
}
