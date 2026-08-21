import React, { useState } from 'react';
import { Filters, FilterOptions } from '../types.ts';
import { 
  ChevronDown, 
  ChevronRight, 
  ChevronUp,
  Filter, 
  X, 
  RefreshCw, 
  Briefcase, 
  Building, 
  MapPin, 
  Tag, 
  ShieldCheck, 
  Search,
  List,
  User,
  Settings,
  SlidersHorizontal,
  Check,
  Mail,
  Users,
  GraduationCap,
  Sparkles,
  Bookmark
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
  // Accordion state
  const [openSections, setOpenSections] = useState({
    persona: false,
    emailStatus: false,
    jobTitles: false,
    peopleLookalikes: false,
    companies: true,
    companyLookalikes: false,
    education: false,
    cities: false,
    enrichmentType: false,
    sources: false,
    statuses: false,
  });
  const [openCustomSections, setOpenCustomSections] = useState<Record<string, boolean>>({});


  // Lists UI states
  const [listsOpen, setListsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'people' | 'companies'>('people');
  const [listDropdownOpen, setListDropdownOpen] = useState(false);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [excludeLeads, setExcludeLeads] = useState(false);
  const [matchType, setMatchType] = useState<'any' | 'all'>('any');

  const peopleLists = [
    { name: 'My Hot Leads', desc: 'Leads saved in your database' },
    { name: 'Q3 Outreach Campaign', desc: 'Campaign sources: Email & Facebook Ads' },
    { name: 'Enterprise Prospects', desc: 'Finance directors, CEOs, partners, GMs' },
    { name: 'Tech Founders 2026', desc: 'CEOs and directors of businesses' },
    { name: 'Follow-up Required', desc: 'Leads awaiting approval (pending)' }
  ];

  const companiesLists = [
    { name: 'Fortune 500', desc: 'Top organization matches: Siemens, Mahindra, Macpower' },
    { name: 'SaaS Companies', desc: 'Modern software teams: SCMCUBE, TrilliantDigital, Om Logistics' },
    { name: 'Y-Combinator W26', desc: 'Early-stage tech startups: Scmcube, Trilliant' },
    { name: 'Local Tech Businesses', desc: 'Located in major tech hubs (Bangalore, Chennai, Mumbai)' },
    { name: 'Finance & Banking', desc: 'Finance roles and accountants' }
  ];

  const handleSelectList = (listName: string, type: 'people' | 'companies') => {
    if (filters.selectedList === listName) {
      setFilters(prev => ({
        ...prev,
        selectedList: null,
        savedOnly: false,
        jobTitles: [],
        companies: [],
        cities: [],
        sources: [],
        statuses: [],
      }));
      return;
    }

    if (type === 'people') {
      if (listName === 'My Hot Leads') {
        setFilters({
          search: '',
          savedOnly: true,
          jobTitles: [],
          companies: [],
          cities: [],
          sources: [],
          statuses: [],
          selectedList: listName
        });
      } else if (listName === 'Q3 Outreach Campaign') {
        setFilters({
          search: '',
          savedOnly: false,
          jobTitles: [],
          companies: [],
          cities: [],
          sources: ["Old Registrants Email Campaign", "Facebook Ads"],
          statuses: [],
          selectedList: listName
        });
      } else if (listName === 'Enterprise Prospects') {
        setFilters({
          search: '',
          savedOnly: false,
          jobTitles: ["Director Finance", "CEO", "Partner", "GM"],
          companies: [],
          cities: [],
          sources: [],
          statuses: [],
          selectedList: listName
        });
      } else if (listName === 'Tech Founders 2026') {
        setFilters({
          search: '',
          savedOnly: false,
          jobTitles: ["CEO", "Director"],
          companies: [],
          cities: [],
          sources: [],
          statuses: [],
          selectedList: listName
        });
      } else if (listName === 'Follow-up Required') {
        setFilters({
          search: '',
          savedOnly: false,
          jobTitles: [],
          companies: [],
          cities: [],
          sources: [],
          statuses: ["pending"],
          selectedList: listName
        });
      }
    } else { // Companies
      if (listName === 'Fortune 500') {
        setFilters({
          search: '',
          savedOnly: false,
          jobTitles: [],
          companies: ["Siemens", "Mahindra Steel Service Centre Limited", "Macpower CNC Machines Limited"],
          cities: [],
          sources: [],
          statuses: [],
          selectedList: listName
        });
      } else if (listName === 'SaaS Companies') {
        setFilters({
          search: '',
          savedOnly: false,
          jobTitles: [],
          companies: ["TrilliantDigital", "Scmcube", "Powersmart Media Pvt Ltd", "Om Logistics Supply Chain Pvt. Ltd."],
          cities: [],
          sources: [],
          statuses: [],
          selectedList: listName
        });
      } else if (listName === 'Y-Combinator W26') {
        setFilters({
          search: '',
          savedOnly: false,
          jobTitles: [],
          companies: ["TrilliantDigital", "Scmcube"],
          cities: [],
          sources: [],
          statuses: [],
          selectedList: listName
        });
      } else if (listName === 'Local Tech Businesses') {
        setFilters({
          search: '',
          savedOnly: false,
          jobTitles: [],
          companies: [],
          cities: ["Bangalore", "Chennai", "Mumbai"],
          sources: [],
          statuses: [],
          selectedList: listName
        });
      } else if (listName === 'Finance & Banking') {
        setFilters({
          search: '',
          savedOnly: false,
          jobTitles: ["Sr manager finance", "Finance Manager", "Accounting Manager", "Accountant"],
          companies: [],
          cities: [],
          sources: [],
          statuses: [],
          selectedList: listName
        });
      }
    }
  };

  // Search input states
  const [globalSearch, setGlobalSearch] = useState('');
  const [titleSearch, setTitleSearch] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [sourceSearch, setSourceSearch] = useState('');

  // Local Search states for other sections
  const [personaSearch, setPersonaSearch] = useState('');
  const [emailStatusSearch, setEmailStatusSearch] = useState('');
  const [peopleLookalikeSearch, setPeopleLookalikeSearch] = useState('');
  const [companyLookalikeSearch, setCompanyLookalikeSearch] = useState('');
  const [educationSearch, setEducationSearch] = useState('');
  const [enrichmentTypeSearch, setEnrichmentTypeSearch] = useState('');
  const [statusSearch, setStatusSearch] = useState('');

  // New Custom Sidebar States (screenshot-matching)
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [selectedEmailStatuses, setSelectedEmailStatuses] = useState<string[]>([]);
  const [selectedPeopleLookalike, setSelectedPeopleLookalike] = useState<string | null>(null);
  const [selectedCompanyLookalike, setSelectedCompanyLookalike] = useState<string | null>(null);
  const [selectedEducations, setSelectedEducations] = useState<string[]>([]);
  const [selectedEnrichmentTypes, setSelectedEnrichmentTypes] = useState<string[]>([]);

  // Handlers for Custom Sidebar filters that map to real filters
  const handleTogglePersona = (persona: string) => {
    if (selectedPersona === persona) {
      setSelectedPersona(null);
      setFilters(prev => ({ ...prev, persona: null, jobTitles: [] }));
    } else {
      setSelectedPersona(persona);
      let titles: string[] = [];
      if (persona === 'Founders & Executives') {
        titles = ["CEO", "Director", "Partner", "Proprietor", "Pradhan Sewak"];
      } else if (persona === 'Finance Leaders') {
        titles = ["Finance Manager", "Sr manager finance", "Senior Manager Finance", "Manager Accounts", "Director Finance"];
      } else if (persona === 'Auditors & Accountants') {
        titles = ["Accountant", "Auditor", "Audit Intern", "Account Auditor", "Audit Executive"];
      }
      setFilters(prev => ({ ...prev, persona, jobTitles: titles }));
    }
  };

  const handleToggleEmailStatus = (status: string) => {
    const next = selectedEmailStatuses.includes(status)
      ? selectedEmailStatuses.filter(s => s !== status)
      : [...selectedEmailStatuses, status];
    setSelectedEmailStatuses(next);

    const dbStatuses: string[] = [];
    if (next.includes('Verified')) dbStatuses.push('approved');
    if (next.includes('Pending')) dbStatuses.push('pending');
    setFilters(prev => ({ ...prev, emailStatuses: next, statuses: dbStatuses }));
  };

  const handleTogglePeopleLookalike = (person: string) => {
    if (selectedPeopleLookalike === person) {
      setSelectedPeopleLookalike(null);
      setFilters(prev => ({ ...prev, peopleLookalike: null, cities: [], companies: [] }));
    } else {
      setSelectedPeopleLookalike(person);
      let cities: string[] = [];
      let companies: string[] = [];
      if (person === 'Similar to Manoj S') {
        cities = ['Vadodara'];
      } else if (person === 'Similar to Vijay Athikary') {
        cities = ['Bangalore'];
        companies = ['Powersmart Media Pvt Ltd'];
      } else if (person === 'Similar to Mani M') {
        cities = ['Chennai'];
        companies = ['Scmcube'];
      }
      setFilters(prev => ({ ...prev, peopleLookalike: person, cities, companies }));
    }
  };

  const handleToggleCompanyLookalike = (company: string) => {
    if (selectedCompanyLookalike === company) {
      setSelectedCompanyLookalike(null);
      setFilters(prev => ({ ...prev, companyLookalike: null, companies: [] }));
    } else {
      setSelectedCompanyLookalike(company);
      let companies: string[] = [];
      if (company === 'Similar to Siemens') {
        companies = ['Siemens'];
      } else if (company === 'Similar to Mahindra Steel') {
        companies = ['Mahindra Steel Service Centre Limited'];
      } else if (company === 'Similar to Macpower CNC') {
        companies = ['Macpower CNC Machines Limited'];
      }
      setFilters(prev => ({ ...prev, companyLookalike: company, companies }));
    }
  };

  const handleToggleEducation = (edu: string) => {
    const next = selectedEducations.includes(edu)
      ? selectedEducations.filter(e => e !== edu)
      : [...selectedEducations, edu];
    setSelectedEducations(next);

    // Map education to cities where those major colleges are situated
    let cities: string[] = [];
    if (next.includes('Delhi University')) cities.push('New Delhi', 'Gurgaon');
    if (next.includes('Anna University') || next.includes('IIT Madras')) cities.push('Chennai');
    if (next.includes('Mumbai University')) cities.push('Mumbai');
    setFilters(prev => ({ ...prev, educations: next, cities: cities.length > 0 ? cities : prev.cities }));
  };

  const handleToggleEnrichmentType = (type: string) => {
    const next = selectedEnrichmentTypes.includes(type)
      ? selectedEnrichmentTypes.filter(t => t !== type)
      : [...selectedEnrichmentTypes, type];
    setSelectedEnrichmentTypes(next);

    let sources: string[] = [];
    if (next.includes('With WhatsApp Opt-In')) {
      sources.push('WhatsApp Invitation');
    }
    if (next.includes('Verified Corporate Email')) {
      sources.push('Old Registrants Email Campaign');
    }
    setFilters(prev => ({ ...prev, enrichmentTypes: next, sources: sources.length > 0 ? sources : [] }));
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const sectionColors: Record<string, { bg: string; text: string; icon: string; border: string }> = {
    persona: { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-600', border: 'border-purple-200' },
    emailStatus: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600', border: 'border-emerald-200' },
    jobTitles: { bg: 'bg-sky-50', text: 'text-sky-700', icon: 'text-sky-600', border: 'border-sky-200' },
    peopleLookalikes: { bg: 'bg-violet-50', text: 'text-violet-700', icon: 'text-violet-600', border: 'border-violet-200' },
    companies: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-600', border: 'border-amber-200' },
    companyLookalikes: { bg: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-600', border: 'border-orange-200' },
    education: { bg: 'bg-rose-50', text: 'text-rose-700', icon: 'text-rose-600', border: 'border-rose-200' },
    cities: { bg: 'bg-teal-50', text: 'text-teal-700', icon: 'text-teal-600', border: 'border-teal-200' },
    enrichmentType: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', icon: 'text-fuchsia-600', border: 'border-fuchsia-200' },
    sources: { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: 'text-indigo-600', border: 'border-indigo-200' },
    statuses: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600', border: 'border-emerald-200' },
  };

  const renderSectionHeader = (
    sectionKey: keyof typeof openSections,
    title: string,
    IconComponent: React.ComponentType<any>,
    isActive: boolean,
    activeCount: number,
    onClearSection: (e: React.MouseEvent) => void
  ) => {
    const isOpen = isSectionOpen(sectionKey);
    const theme = sectionColors[String(sectionKey)] || { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: 'text-indigo-600', border: 'border-indigo-200' };

    return (
      <button
        onClick={() => toggleSection(sectionKey)}
        className={`w-full flex items-center justify-between py-2.5 px-3.5 rounded-full border transition-all duration-200 text-left cursor-pointer group mb-2 shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01] active:scale-[0.98] ${
          isActive 
            ? `${theme.bg} ${theme.border} shadow-xs` 
            : 'bg-white hover:bg-slate-50 border-slate-200/90 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-full ${theme.bg} ${theme.icon} flex items-center justify-center shrink-0 border ${theme.border} group-hover:scale-110 transition-transform duration-200 shadow-2xs`}>
            <IconComponent className="w-4 h-4" />
          </div>
          <span className={`text-xs font-black tracking-tight ${isActive ? theme.text : 'text-slate-900 font-extrabold'}`}>
            {title}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          {isActive && (
            <span 
              onClick={(e) => {
                e.stopPropagation();
                onClearSection(e);
              }}
              className={`inline-flex items-center space-x-1 ${theme.bg} ${theme.border} ${theme.text} px-2.5 py-0.5 rounded-full text-[10px] font-extrabold hover:scale-105 active:scale-95 transition-all cursor-pointer border shadow-2xs`}
            >
              <span>✕</span>
              <span>{activeCount}</span>
            </span>
          )}
          <div className={`w-7 h-7 rounded-full flex items-center justify-center border border-slate-200/60 ${isActive ? `${theme.bg} ${theme.border}` : 'bg-slate-100/80 group-hover:bg-slate-200'} transition-colors duration-200`}>
            {isOpen ? (
              <ChevronDown className={`w-3.5 h-3.5 ${isActive ? theme.icon : 'text-slate-500'} transition-transform duration-200`} />
            ) : (
              <ChevronRight className={`w-3.5 h-3.5 ${isActive ? theme.icon : 'text-slate-500'} transition-transform duration-200`} />
            )}
          </div>
        </div>
      </button>
    );
  };

  const handleCheckboxChange = (
    field: keyof Omit<Filters, 'search' | 'savedOnly'>,
    value: string
  ) => {
    setFilters((prev) => {
      const currentValues = prev[field] as string[];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];
      return { ...prev, [field]: nextValues };
    });
  };

  const handleClearAll = () => {
    setGlobalSearch('');
    setTitleSearch('');
    setCompanySearch('');
    setCitySearch('');
    setSourceSearch('');
    setPersonaSearch('');
    setEmailStatusSearch('');
    setPeopleLookalikeSearch('');
    setCompanyLookalikeSearch('');
    setEducationSearch('');
    setEnrichmentTypeSearch('');
    setStatusSearch('');
    setSelectedPersona(null);
    setSelectedEmailStatuses([]);
    setSelectedPeopleLookalike(null);
    setSelectedCompanyLookalike(null);
    setSelectedEducations([]);
    setSelectedEnrichmentTypes([]);
    onClear();
  };

  const hasActiveFilters = 
    filters.jobTitles.length > 0 ||
    filters.companies.length > 0 ||
    filters.cities.length > 0 ||
    filters.sources.length > 0 ||
    filters.statuses.length > 0 ||
    filters.savedOnly;

  const hasActiveFiltersOrSearches =
    hasActiveFilters ||
    globalSearch !== '' ||
    titleSearch !== '' ||
    companySearch !== '' ||
    citySearch !== '' ||
    sourceSearch !== '' ||
    personaSearch !== '' ||
    emailStatusSearch !== '' ||
    peopleLookalikeSearch !== '' ||
    companyLookalikeSearch !== '' ||
    educationSearch !== '' ||
    enrichmentTypeSearch !== '' ||
    statusSearch !== '';

  // Filter option items based on global and local searches
  // Keep currently checked items visible regardless of search query
  const filteredPersonas = ['Founders & Executives', 'Finance Leaders', 'Auditors & Accountants'].filter((p) => {
    const isChecked = selectedPersona === p;
    if (isChecked) return true;
    const matchesGlobal = !globalSearch || p.toLowerCase().includes(globalSearch.toLowerCase());
    const matchesLocal = !personaSearch || p.toLowerCase().includes(personaSearch.toLowerCase());
    return matchesGlobal && matchesLocal;
  });

  const filteredEmailStatuses = [
    { label: 'Verified', color: 'bg-emerald-500' },
    { label: 'Pending', color: 'bg-amber-400' }
  ].filter((item) => {
    const isChecked = selectedEmailStatuses.includes(item.label);
    if (isChecked) return true;
    const matchesGlobal = !globalSearch || item.label.toLowerCase().includes(globalSearch.toLowerCase());
    const matchesLocal = !emailStatusSearch || item.label.toLowerCase().includes(emailStatusSearch.toLowerCase());
    return matchesGlobal && matchesLocal;
  });

  const filteredJobTitles = filterOptions.jobTitles.filter((title) => {
    const isChecked = filters.jobTitles.includes(title);
    if (isChecked) return true;
    
    const matchesGlobal = !globalSearch || title.toLowerCase().includes(globalSearch.toLowerCase());
    const matchesLocal = !titleSearch || title.toLowerCase().includes(titleSearch.toLowerCase());
    return matchesGlobal && matchesLocal;
  });

  const filteredPeopleLookalikes = ['Similar to Manoj S', 'Similar to Vijay Athikary', 'Similar to Mani M'].filter((p) => {
    const isChecked = selectedPeopleLookalike === p;
    if (isChecked) return true;
    const matchesGlobal = !globalSearch || p.toLowerCase().includes(globalSearch.toLowerCase());
    const matchesLocal = !peopleLookalikeSearch || p.toLowerCase().includes(peopleLookalikeSearch.toLowerCase());
    return matchesGlobal && matchesLocal;
  });

  const filteredCompanies = filterOptions.companies.filter((company) => {
    const isChecked = filters.companies.includes(company);
    if (isChecked) return true;

    const matchesGlobal = !globalSearch || company.toLowerCase().includes(globalSearch.toLowerCase());
    const matchesLocal = !companySearch || company.toLowerCase().includes(companySearch.toLowerCase());
    return matchesGlobal && matchesLocal;
  });

  const filteredCompanyLookalikes = ['Similar to Siemens', 'Similar to Mahindra Steel', 'Similar to Macpower CNC'].filter((c) => {
    const isChecked = selectedCompanyLookalike === c;
    if (isChecked) return true;
    const matchesGlobal = !globalSearch || c.toLowerCase().includes(globalSearch.toLowerCase());
    const matchesLocal = !companyLookalikeSearch || c.toLowerCase().includes(companyLookalikeSearch.toLowerCase());
    return matchesGlobal && matchesLocal;
  });

  const filteredEducationsList = ['Delhi University', 'Anna University', 'Mumbai University', 'IIT Madras'].filter((e) => {
    const isChecked = selectedEducations.includes(e);
    if (isChecked) return true;
    const matchesGlobal = !globalSearch || e.toLowerCase().includes(globalSearch.toLowerCase());
    const matchesLocal = !educationSearch || e.toLowerCase().includes(educationSearch.toLowerCase());
    return matchesGlobal && matchesLocal;
  });

  const filteredCities = filterOptions.cities.filter((city) => {
    const isChecked = filters.cities.includes(city);
    if (isChecked) return true;

    const matchesGlobal = !globalSearch || city.toLowerCase().includes(globalSearch.toLowerCase());
    const matchesLocal = !citySearch || city.toLowerCase().includes(citySearch.toLowerCase());
    return matchesGlobal && matchesLocal;
  });

  const filteredEnrichmentTypesList = ['With Mobile Phone', 'Verified Corporate Email', 'With WhatsApp Opt-In'].filter((t) => {
    const isChecked = selectedEnrichmentTypes.includes(t);
    if (isChecked) return true;
    const matchesGlobal = !globalSearch || t.toLowerCase().includes(globalSearch.toLowerCase());
    const matchesLocal = !enrichmentTypeSearch || t.toLowerCase().includes(enrichmentTypeSearch.toLowerCase());
    return matchesGlobal && matchesLocal;
  });

  const filteredSources = filterOptions.sources.filter((source) => {
    const isChecked = filters.sources.includes(source);
    if (isChecked) return true;

    const matchesGlobal = !globalSearch || source.toLowerCase().includes(globalSearch.toLowerCase());
    const matchesLocal = !sourceSearch || source.toLowerCase().includes(sourceSearch.toLowerCase());
    return matchesGlobal && matchesLocal;
  });

  const filteredStatuses = filterOptions.statuses.filter((status) => {
    const isChecked = filters.statuses.includes(status);
    if (isChecked) return true;

    const matchesGlobal = !globalSearch || status.toLowerCase().includes(globalSearch.toLowerCase());
    const matchesLocal = !statusSearch || status.toLowerCase().includes(statusSearch.toLowerCase());
    return matchesGlobal && matchesLocal;
  });

  const filteredPeopleLists = peopleLists.filter((item) => {
    return !globalSearch || 
      item.name.toLowerCase().includes(globalSearch.toLowerCase()) || 
      item.desc.toLowerCase().includes(globalSearch.toLowerCase());
  });

  const filteredCompaniesLists = companiesLists.filter((item) => {
    return !globalSearch || 
      item.name.toLowerCase().includes(globalSearch.toLowerCase()) || 
      item.desc.toLowerCase().includes(globalSearch.toLowerCase());
  });

  const totalMatchesCount = !globalSearch ? 0 : (
    filteredPeopleLists.length +
    filteredCompaniesLists.length +
    filteredPersonas.length +
    filteredEmailStatuses.length +
    filteredJobTitles.length +
    filteredPeopleLookalikes.length +
    filteredCompanies.length +
    filteredCompanyLookalikes.length +
    filteredEducationsList.length +
    filteredCities.length +
    filteredEnrichmentTypesList.length +
    filteredSources.length +
    filteredStatuses.length
  );

  const isSectionOpen = (sectionKey: keyof typeof openSections) => {
    if (globalSearch) {
      let hasMatch = false;
      if (sectionKey === 'persona') hasMatch = filteredPersonas.length > 0;
      else if (sectionKey === 'emailStatus') hasMatch = filteredEmailStatuses.length > 0;
      else if (sectionKey === 'jobTitles') hasMatch = filteredJobTitles.length > 0;
      else if (sectionKey === 'peopleLookalikes') hasMatch = filteredPeopleLookalikes.length > 0;
      else if (sectionKey === 'companies') hasMatch = filteredCompanies.length > 0;
      else if (sectionKey === 'companyLookalikes') hasMatch = filteredCompanyLookalikes.length > 0;
      else if (sectionKey === 'education') hasMatch = filteredEducationsList.length > 0;
      else if (sectionKey === 'cities') hasMatch = filteredCities.length > 0;
      else if (sectionKey === 'enrichmentType') hasMatch = filteredEnrichmentTypesList.length > 0;
      else if (sectionKey === 'sources') hasMatch = filteredSources.length > 0;
      else if (sectionKey === 'statuses') hasMatch = filteredStatuses.length > 0;
      
      return hasMatch;
    }
    return openSections[sectionKey];
  };

  return (
    <aside id="filters-sidebar" className="w-80 border-r border-gray-200 bg-white flex flex-col h-full overflow-hidden select-none shrink-0">
      {/* Sidebar Header */}
      <div className="p-4 bg-[#0f172a] text-white flex items-center justify-between shadow-xs border-b border-slate-800 shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-xs tracking-wider uppercase text-white font-display">Targeting Filters</span>
              {hasActiveFilters && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[9px] font-extrabold text-emerald-300 bg-emerald-950/60 border border-emerald-700/60 rounded-full">
                  {filters.jobTitles.length + filters.companies.length + filters.cities.length + filters.sources.length + filters.statuses.length + (filters.savedOnly ? 1 : 0)} Active
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Refine lead directory & personas</p>
          </div>
        </div>
        {hasActiveFiltersOrSearches && (
          <button
            onClick={handleClearAll}
            className="text-2xs font-extrabold text-slate-200 hover:text-white flex items-center space-x-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xs"
          >
            <X className="w-3 h-3 text-rose-400" />
            <span>Reset All</span>
          </button>
        )}
      </div>

      {/* Global Filter Search */}
      <div className="p-3 border-b border-indigo-100/70 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-slate-50/60">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-indigo-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Search all targeting filters..."
            className="w-full pl-9.5 pr-8 py-2 text-xs border border-indigo-200/80 rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 transition-all bg-white/90 placeholder-slate-400 font-semibold text-slate-800 shadow-2xs"
          />
          {globalSearch && (
            <button
              type="button"
              onClick={() => setGlobalSearch('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-indigo-600 active:scale-90"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Accordion List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-150 p-2 space-y-1">
        
        {/* Dynamic Search Results Panel (Separately displayed below search bar) */}
        {globalSearch && (
          <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-150 shadow-xs mb-3 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-1.5">
              <div className="flex items-center space-x-1.5 text-indigo-800 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                <span>Matching Filters</span>
              </div>
              <span className="text-[10px] text-indigo-700 bg-indigo-100 font-bold px-2 py-0.5 rounded-full">
                {totalMatchesCount} match{totalMatchesCount !== 1 ? 'es' : ''}
              </span>
            </div>

            {totalMatchesCount === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-gray-400 italic">No matching filter options found.</p>
                <button
                  onClick={() => setGlobalSearch('')}
                  className="mt-2 text-2xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="space-y-3.5 divide-y divide-indigo-100/50 max-h-[350px] overflow-y-auto pr-1">
                {filteredPeopleLists.length > 0 && (
                  <div className="pt-2.5 first:pt-0">
                    <div className="flex items-center space-x-1 mb-1.5">
                      <List className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">People Lists</span>
                    </div>
                    <div className="space-y-1.5">
                      {filteredPeopleLists.map((item) => {
                        const isSelected = filters.selectedList === item.name;
                        return (
                          <button
                            key={item.name}
                            onClick={() => handleSelectList(item.name, 'people')}
                            className={`w-full text-left p-1.5 rounded-lg border text-xs transition-all flex items-center justify-between ${
                              isSelected 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs font-semibold' 
                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>{item.desc}</div>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-1.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredCompaniesLists.length > 0 && (
                  <div className="pt-2.5 first:pt-0">
                    <div className="flex items-center space-x-1 mb-1.5">
                      <List className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Company Lists</span>
                    </div>
                    <div className="space-y-1.5">
                      {filteredCompaniesLists.map((item) => {
                        const isSelected = filters.selectedList === item.name;
                        return (
                          <button
                            key={item.name}
                            onClick={() => handleSelectList(item.name, 'companies')}
                            className={`w-full text-left p-1.5 rounded-lg border text-xs transition-all flex items-center justify-between ${
                              isSelected 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs font-semibold' 
                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>{item.desc}</div>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-1.5" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredPersonas.length > 0 && (
                  <div className="pt-2.5 first:pt-0">
                    <div className="flex items-center space-x-1.5 mb-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Persona</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {filteredPersonas.map((persona) => {
                        const isChecked = selectedPersona === persona;
                        return (
                          <label
                            key={persona}
                            className="flex items-center space-x-2 py-1.5 px-2 rounded-lg hover:bg-white cursor-pointer text-xs text-gray-750 transition-colors bg-white/50 border border-gray-100"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePersona(persona)}
                              className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{persona}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredEmailStatuses.length > 0 && (
                  <div className="pt-2.5 first:pt-0">
                    <div className="flex items-center space-x-1.5 mb-1.5">
                      <Mail className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Email Status</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {filteredEmailStatuses.map((item) => {
                        const isChecked = selectedEmailStatuses.includes(item.label);
                        return (
                          <label
                            key={item.label}
                            className="flex items-center space-x-2 py-1.5 px-2 rounded-lg hover:bg-white cursor-pointer text-xs text-gray-750 transition-colors bg-white/50 border border-gray-100"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleEmailStatus(item.label)}
                              className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <div className="flex items-center space-x-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                              <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{item.label}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredJobTitles.length > 0 && (
                  <div className="pt-2.5 first:pt-0">
                    <div className="flex items-center space-x-1.5 mb-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Job Titles</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
                      {filteredJobTitles.map((title) => {
                        const isChecked = filters.jobTitles.includes(title);
                        return (
                          <label
                            key={title}
                            className="flex items-center space-x-2 py-1.5 px-2 rounded-lg hover:bg-white cursor-pointer text-xs text-gray-750 transition-colors bg-white/50 border border-gray-100"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleCheckboxChange('jobTitles', title)}
                              className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{title}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredPeopleLookalikes.length > 0 && (
                  <div className="pt-2.5 first:pt-0">
                    <div className="flex items-center space-x-1.5 mb-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">People Lookalikes</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {filteredPeopleLookalikes.map((p) => {
                        const isChecked = selectedPeopleLookalike === p;
                        return (
                          <label
                            key={p}
                            className="flex items-center space-x-2 py-1.5 px-2 rounded-lg hover:bg-white cursor-pointer text-xs text-gray-750 transition-colors bg-white/50 border border-gray-100"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePeopleLookalike(p)}
                              className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{p}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredCompanies.length > 0 && (
                  <div className="pt-2.5 first:pt-0">
                    <div className="flex items-center space-x-1.5 mb-1.5">
                      <Building className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Companies</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
                      {filteredCompanies.map((company) => {
                        const isChecked = filters.companies.includes(company);
                        return (
                          <label
                            key={company}
                            className="flex items-center space-x-2 py-1.5 px-2 rounded-lg hover:bg-white cursor-pointer text-xs text-gray-750 transition-colors bg-white/50 border border-gray-100"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleCheckboxChange('companies', company)}
                              className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{company}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredCompanyLookalikes.length > 0 && (
                  <div className="pt-2.5 first:pt-0">
                    <div className="flex items-center space-x-1.5 mb-1.5">
                      <Building className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Company Lookalikes</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {filteredCompanyLookalikes.map((c) => {
                        const isChecked = selectedCompanyLookalike === c;
                        return (
                          <label
                            key={c}
                            className="flex items-center space-x-2 py-1.5 px-2 rounded-lg hover:bg-white cursor-pointer text-xs text-gray-750 transition-colors bg-white/50 border border-gray-100"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleCompanyLookalike(c)}
                              className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{c}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredEducationsList.length > 0 && (
                  <div className="pt-2.5 first:pt-0">
                    <div className="flex items-center space-x-1.5 mb-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Education</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {filteredEducationsList.map((e) => {
                        const isChecked = selectedEducations.includes(e);
                        return (
                          <label
                            key={e}
                            className="flex items-center space-x-2 py-1.5 px-2 rounded-lg hover:bg-white cursor-pointer text-xs text-gray-750 transition-colors bg-white/50 border border-gray-100"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleEducation(e)}
                              className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{e}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredCities.length > 0 && (
                  <div className="pt-2.5 first:pt-0">
                    <div className="flex items-center space-x-1.5 mb-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Cities</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
                      {filteredCities.map((city) => {
                        const isChecked = filters.cities.includes(city);
                        return (
                          <label
                            key={city}
                            className="flex items-center space-x-2 py-1.5 px-2 rounded-lg hover:bg-white cursor-pointer text-xs text-gray-750 transition-colors bg-white/50 border border-gray-100"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleCheckboxChange('cities', city)}
                              className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{city}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredEnrichmentTypesList.length > 0 && (
                  <div className="pt-2.5 first:pt-0">
                    <div className="flex items-center space-x-1.5 mb-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Enrichment Type</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {filteredEnrichmentTypesList.map((t) => {
                        const isChecked = selectedEnrichmentTypes.includes(t);
                        return (
                          <label
                            key={t}
                            className="flex items-center space-x-2 py-1.5 px-2 rounded-lg hover:bg-white cursor-pointer text-xs text-gray-750 transition-colors bg-white/50 border border-gray-100"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleEnrichmentType(t)}
                              className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{t}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredSources.length > 0 && (
                  <div className="pt-2.5 first:pt-0">
                    <div className="flex items-center space-x-1.5 mb-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Sources</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
                      {filteredSources.map((source) => {
                        const isChecked = filters.sources.includes(source);
                        return (
                          <label
                            key={source}
                            className="flex items-center space-x-2 py-1.5 px-2 rounded-lg hover:bg-white cursor-pointer text-xs text-gray-750 transition-colors bg-white/50 border border-gray-100"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleCheckboxChange('sources', source)}
                              className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{source}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredStatuses.length > 0 && (
                  <div className="pt-2.5 first:pt-0">
                    <div className="flex items-center space-x-1.5 mb-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide">Lead Status</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
                      {filteredStatuses.map((status) => {
                        const isChecked = filters.statuses.includes(status);
                        return (
                          <label
                            key={status}
                            className="flex items-center space-x-2 py-1.5 px-2 rounded-lg hover:bg-white cursor-pointer text-xs text-gray-750 transition-colors bg-white/50 border border-gray-100"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleCheckboxChange('statuses', status)}
                              className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{status}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Lists Accordion Section (Requested Custom UI) */}
        <div className="p-3.5 border border-indigo-200/80 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-purple-50/30 to-slate-50/80 shadow-2xs hover:shadow-md transition-all duration-200 mb-2.5">
          <button
            onClick={() => setListsOpen(!listsOpen)}
            className="w-full flex items-center justify-between py-1 px-1 text-xs font-bold text-slate-800 select-none cursor-pointer group"
          >
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 border border-indigo-200 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <List className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-black tracking-tight text-indigo-950 font-display">Lists</span>
            </div>
            <div className="w-6 h-6 rounded-full bg-white/80 border border-indigo-100 flex items-center justify-center">
              {listsOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-indigo-600" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
              )}
            </div>
          </button>

          {listsOpen && (
            <div className="mt-3 space-y-3.5 animate-fadeIn">
              {/* Tabs: Contacts / Organizations */}
              <div className="flex p-1 bg-white/80 rounded-full border border-indigo-100 shadow-3xs">
                <button
                  onClick={() => {
                    setActiveTab('people');
                    setListDropdownOpen(false);
                  }}
                  className={`flex-1 py-1.5 px-3 text-xs font-extrabold flex items-center justify-center space-x-1.5 rounded-full transition-all cursor-pointer ${
                    activeTab === 'people'
                      ? 'bg-indigo-600 text-white shadow-2xs scale-[1.02]'
                      : 'text-slate-600 hover:text-indigo-600'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Contacts</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('companies');
                    setListDropdownOpen(false);
                  }}
                  className={`flex-1 py-1.5 px-3 text-xs font-extrabold flex items-center justify-center space-x-1.5 rounded-full transition-all cursor-pointer ${
                    activeTab === 'companies'
                      ? 'bg-indigo-600 text-white shadow-2xs scale-[1.02]'
                      : 'text-slate-600 hover:text-indigo-600'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Organizations</span>
                </button>
              </div>

              {/* Action labels: Include lists and Most Recent */}
              <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-600 select-none">
                <div className="flex items-center space-x-1.5 text-slate-700">
                  <Settings className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Include lists</span>
                </div>
                <div className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Most Recent</span>
                </div>
              </div>

              {/* Select Input Bar */}
              <div className="relative">
                <div className="relative w-full">
                  <button
                    onClick={() => setListDropdownOpen(!listDropdownOpen)}
                    className="w-full flex items-center justify-between pl-3.5 pr-9 py-2 text-xs font-semibold border border-indigo-200/90 rounded-2xl bg-white/90 shadow-2xs hover:bg-white hover:border-indigo-400 transition-all text-left cursor-pointer"
                  >
                    <span className={filters.selectedList ? 'text-indigo-600 font-bold truncate max-w-[190px]' : 'text-slate-400 font-medium'}>
                      {filters.selectedList || 'Select lists...'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-indigo-500 transition-transform duration-200 ${listDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {filters.selectedList && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilters(prev => ({
                          ...prev,
                          selectedList: null,
                          savedOnly: false,
                          jobTitles: [],
                          companies: [],
                          cities: [],
                          sources: [],
                          statuses: [],
                        }));
                      }}
                      className="absolute right-7 top-1/2 -translate-y-1/2 p-1 hover:bg-indigo-50 rounded-full text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer z-10"
                      title="Clear selection"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown Options overlay */}
                {listDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setListDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-45 max-h-56 overflow-y-auto animate-fadeIn">
                      {(activeTab === 'people' ? filteredPeopleLists : filteredCompaniesLists).map((item) => {
                        const isSelected = filters.selectedList === item.name;
                        return (
                          <button
                            key={item.name}
                            onClick={() => {
                              handleSelectList(item.name, activeTab);
                              setListDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex flex-col hover:bg-gray-50 transition-colors cursor-pointer ${
                              isSelected ? 'bg-indigo-50/50 text-indigo-600' : 'text-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold">
                              <span>{item.name}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                            </div>
                            <span className="text-4xs font-normal text-gray-400 mt-0.5 leading-normal">
                              {item.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Advanced settings toggler */}
              <div className="px-1">
                <button
                  onClick={() => setAdvancedSettingsOpen(!advancedSettingsOpen)}
                  className="inline-flex items-center space-x-1.5 text-2xs font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                >
                  <span>Advanced settings</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-indigo-500 transition-transform duration-200 ${advancedSettingsOpen ? 'rotate-180' : ''}`} />
                </button>

                {advancedSettingsOpen && (
                  <div className="mt-2.5 p-2.5 bg-gray-50 rounded-lg border border-gray-150 space-y-2.5 text-2xs text-gray-600 animate-fadeIn">
                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={excludeLeads}
                        onChange={(e) => setExcludeLeads(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="font-semibold text-gray-600">Exclude selected lists</span>
                    </label>
                    <div className="border-t border-gray-200 my-2" />
                    <div className="space-y-1.5">
                      <span className="font-bold text-gray-400 uppercase tracking-wider block text-3xs">Match Criteria</span>
                      <label className="flex items-center space-x-2 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="matchType"
                          checked={matchType === 'any'}
                          onChange={() => setMatchType('any')}
                          className="w-3 h-3 text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="font-medium">Match any selected list (OR)</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="matchType"
                          checked={matchType === 'all'}
                          onChange={() => setMatchType('all')}
                          className="w-3 h-3 text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="font-medium">Match all selected lists (AND)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Saved Leads Filter Toggle */}
        <div className="p-2">
          <label className="flex items-center space-x-3 py-2.5 px-4 rounded-full bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-amber-50/80 hover:from-amber-100/90 hover:to-amber-100/80 border border-amber-200/90 shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer transition-all duration-200 group">
            <input
              type="checkbox"
              checked={filters.savedOnly}
              onChange={(e) => setFilters(prev => ({ ...prev, savedOnly: e.target.checked }))}
              className="w-4 h-4 rounded-md text-amber-600 border-amber-300 focus:ring-amber-500 transition-colors cursor-pointer"
            />
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                <Bookmark className={`w-3.5 h-3.5 transition-colors ${filters.savedOnly ? 'text-amber-600 fill-amber-500 animate-bounce' : 'text-amber-600'}`} />
              </div>
              <span className={`text-xs font-black tracking-tight ${filters.savedOnly ? 'text-amber-900 font-black' : 'text-slate-900 font-extrabold'}`}>Saved Contacts Only</span>
            </div>
          </label>
        </div>

        {/* Redesigned Sidebar Accordions (Exact Visual Match to Screenshot) */}
        <div className="space-y-0.5 mt-2 select-none border-t border-gray-150">
          
          {/* 1. Persona Accordion */}
          <div className="border-b border-gray-100">
            {renderSectionHeader(
              'persona', 
              'Role Category', 
              User, 
              selectedPersona !== null, 
              selectedPersona !== null ? 1 : 0, 
              () => handleTogglePersona(selectedPersona || '')
            )}
            
            {isSectionOpen('persona') && (
              <div className="p-3 bg-gray-50/40 space-y-2 animate-fadeIn">
                <p className="text-[10px] text-gray-400 font-medium">Select a dynamic lead persona:</p>
                
                {/* Inline Search */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-gray-400">
                    <Search className="w-3 h-3" />
                  </span>
                  <input
                    type="text"
                    value={personaSearch}
                    onChange={(e) => setPersonaSearch(e.target.value)}
                    placeholder="Filter personas..."
                    className="w-full pl-6.5 pr-6 py-1 text-xs border border-gray-200 rounded-md focus:outline-hidden focus:border-indigo-400 bg-white"
                  />
                  {personaSearch && (
                    <button
                      type="button"
                      onClick={() => setPersonaSearch('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-650"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {filteredPersonas.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1 italic">No personas match</p>
                  ) : (
                    filteredPersonas.map((persona) => {
                      const isChecked = selectedPersona === persona;
                      return (
                        <label
                          key={persona}
                          className="flex items-center space-x-2.5 py-1 px-1.5 rounded-md hover:bg-gray-100 cursor-pointer text-xs text-gray-650 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePersona(persona)}
                            className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 transition-colors cursor-pointer"
                          />
                          <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{persona}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Email Status Accordion */}
          <div className="border-b border-gray-100">
            {renderSectionHeader(
              'emailStatus', 
              'Mail Status', 
              Mail, 
              selectedEmailStatuses.length > 0, 
              selectedEmailStatuses.length, 
              () => {
                setSelectedEmailStatuses([]);
                setFilters(prev => ({ ...prev, statuses: [] }));
              }
            )}
            
            {isSectionOpen('emailStatus') && (
              <div className="p-3 bg-gray-50/40 space-y-2 animate-fadeIn">
                <p className="text-[10px] text-gray-400 font-medium">Filter by deliverability status:</p>
                
                {/* Inline Search */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-gray-400">
                    <Search className="w-3 h-3" />
                  </span>
                  <input
                    type="text"
                    value={emailStatusSearch}
                    onChange={(e) => setEmailStatusSearch(e.target.value)}
                    placeholder="Filter email statuses..."
                    className="w-full pl-6.5 pr-6 py-1 text-xs border border-gray-200 rounded-md focus:outline-hidden focus:border-indigo-400 bg-white"
                  />
                  {emailStatusSearch && (
                    <button
                      type="button"
                      onClick={() => setEmailStatusSearch('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-650"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {filteredEmailStatuses.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1 italic">No statuses match</p>
                  ) : (
                    filteredEmailStatuses.map((item) => {
                      const isChecked = selectedEmailStatuses.includes(item.label);
                      return (
                        <label
                          key={item.label}
                          className="flex items-center space-x-2.5 py-1 px-1.5 rounded-md hover:bg-gray-100 cursor-pointer text-xs text-gray-650 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleEmailStatus(item.label)}
                            className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 transition-colors cursor-pointer"
                          />
                          <div className="flex items-center space-x-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                            <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{item.label}</span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. Job Titles Accordion */}
          <div className="border-b border-gray-100">
            {renderSectionHeader(
              'jobTitles', 
              'Designations', 
              Briefcase, 
              filters.jobTitles.length > 0, 
              filters.jobTitles.length, 
              () => setFilters(prev => ({ ...prev, jobTitles: [] }))
            )}

            {/* In-Header tags row like the screenshot */}
            {filters.jobTitles.length > 0 && (
              <div className="px-3 pt-1 pb-2.5 flex flex-wrap gap-1 border-b border-gray-50 bg-gray-50/10 animate-fadeIn">
                <span className="text-[10px] font-medium text-gray-400 self-center mr-1">Titles:</span>
                {filters.jobTitles.slice(0, 3).map(title => (
                  <span key={title} className="inline-flex items-center bg-gray-100 border border-gray-200 text-[10px] font-medium text-gray-600 px-2 py-0.5 rounded-full">
                    <span className="truncate max-w-[90px]">{title}</span>
                    <button 
                      onClick={() => handleCheckboxChange('jobTitles', title)}
                      className="text-gray-400 hover:text-gray-650 font-bold ml-1"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {filters.jobTitles.length > 3 && (
                  <span className="text-[10px] font-semibold text-indigo-600 self-center px-1">+{filters.jobTitles.length - 3}</span>
                )}
              </div>
            )}
            
            {isSectionOpen('jobTitles') && (
              <div className="p-3 bg-gray-50/20 space-y-2 animate-fadeIn">
                {/* Inline Search */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-gray-400">
                    <Search className="w-3 h-3" />
                  </span>
                  <input
                    type="text"
                    value={titleSearch}
                    onChange={(e) => setTitleSearch(e.target.value)}
                    placeholder="Filter titles..."
                    className="w-full pl-6.5 pr-6 py-1 text-xs border border-gray-200 rounded-md focus:outline-hidden focus:border-indigo-400 bg-white"
                  />
                  {titleSearch && (
                    <button
                      type="button"
                      onClick={() => setTitleSearch('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-650"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
                
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {filteredJobTitles.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1.5 italic">No titles match</p>
                  ) : (
                    filteredJobTitles.map((title) => (
                      <label
                        key={title}
                        className="flex items-center space-x-2.5 py-1 px-1.5 rounded-md hover:bg-gray-150/40 cursor-pointer text-xs text-gray-650 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={filters.jobTitles.includes(title)}
                          onChange={() => handleCheckboxChange('jobTitles', title)}
                          className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 transition-colors cursor-pointer"
                        />
                        <span className="truncate">{title}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 4. People Lookalikes Accordion */}
          <div className="border-b border-gray-100">
            {renderSectionHeader(
              'peopleLookalikes', 
              'Similar Profiles', 
              Users, 
              selectedPeopleLookalike !== null, 
              selectedPeopleLookalike !== null ? 1 : 0, 
              () => handleTogglePeopleLookalike(selectedPeopleLookalike || '')
            )}
            
            {isSectionOpen('peopleLookalikes') && (
              <div className="p-3 bg-gray-50/40 space-y-2 animate-fadeIn">
                <p className="text-[10px] text-gray-400 font-medium">Select similar talent profiles:</p>
                
                {/* Inline Search */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-gray-400">
                    <Search className="w-3 h-3" />
                  </span>
                  <input
                    type="text"
                    value={peopleLookalikeSearch}
                    onChange={(e) => setPeopleLookalikeSearch(e.target.value)}
                    placeholder="Filter profiles..."
                    className="w-full pl-6.5 pr-6 py-1 text-xs border border-gray-200 rounded-md focus:outline-hidden focus:border-indigo-400 bg-white"
                  />
                  {peopleLookalikeSearch && (
                    <button
                      type="button"
                      onClick={() => setPeopleLookalikeSearch('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-650"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {filteredPeopleLookalikes.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1 italic">No profiles match</p>
                  ) : (
                    filteredPeopleLookalikes.map((person) => {
                      const isChecked = selectedPeopleLookalike === person;
                      return (
                        <label
                          key={person}
                          className="flex items-center space-x-2.5 py-1 px-1.5 rounded-md hover:bg-gray-100 cursor-pointer text-xs text-gray-650 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePeopleLookalike(person)}
                            className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 transition-colors cursor-pointer"
                          />
                          <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{person}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 5. Company Accordion (Exact match to screenshot with X 1 pill) */}
          <div className="border-b border-gray-100">
            {renderSectionHeader(
              'companies', 
              'Organizations', 
              Building, 
              filters.companies.length > 0, 
              filters.companies.length, 
              () => setFilters(prev => ({ ...prev, companies: [] }))
            )}

            {/* Indented selected companies tags right under the header (Exact Screenshot replication) */}
            {filters.companies.length > 0 && (
              <div className="px-3 pt-1 pb-2.5 flex flex-wrap gap-1 border-b border-gray-50 bg-gray-50/10 animate-fadeIn">
                <span className="text-[10px] font-medium text-gray-400 self-center mr-1">Companies:</span>
                {filters.companies.slice(0, 2).map(comp => (
                  <span key={comp} className="inline-flex items-center bg-gray-100 border border-gray-200 text-[10px] font-medium text-gray-600 px-2 py-0.5 rounded-full">
                    <span className="truncate max-w-[110px]">{comp}</span>
                    <button 
                      onClick={() => handleCheckboxChange('companies', comp)}
                      className="text-gray-400 hover:text-gray-650 font-bold ml-1"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {filters.companies.length > 2 && (
                  <span className="text-[10px] font-semibold text-indigo-600 self-center px-1">+{filters.companies.length - 2}</span>
                )}
              </div>
            )}
            
            {isSectionOpen('companies') && (
              <div className="p-3 bg-gray-50/20 space-y-2 animate-fadeIn">
                {/* Inline Search */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-gray-400">
                    <Search className="w-3 h-3" />
                  </span>
                  <input
                    type="text"
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    placeholder="Filter organizations..."
                    className="w-full pl-6.5 pr-6 py-1 text-xs border border-gray-200 rounded-md focus:outline-hidden focus:border-indigo-400 bg-white"
                  />
                  {companySearch && (
                    <button
                      type="button"
                      onClick={() => setCompanySearch('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-650"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {filteredCompanies.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1.5 italic">No organizations match</p>
                  ) : (
                    filteredCompanies.map((company) => (
                      <label
                        key={company}
                        className="flex items-center space-x-2.5 py-1 px-1.5 rounded-md hover:bg-gray-150/40 cursor-pointer text-xs text-gray-650 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={filters.companies.includes(company)}
                          onChange={() => handleCheckboxChange('companies', company)}
                          className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 transition-colors cursor-pointer"
                        />
                        <span className="truncate">{company}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 6. Company Lookalikes Accordion */}
          <div className="border-b border-gray-100">
            {renderSectionHeader(
              'companyLookalikes', 
              'Similar Organizations', 
              Building, 
              selectedCompanyLookalike !== null, 
              selectedCompanyLookalike !== null ? 1 : 0, 
              () => handleToggleCompanyLookalike(selectedCompanyLookalike || '')
            )}
            
            {isSectionOpen('companyLookalikes') && (
              <div className="p-3 bg-gray-50/40 space-y-2 animate-fadeIn">
                <p className="text-[10px] text-gray-400 font-medium">Select similar organizations:</p>
                
                {/* Inline Search */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-gray-400">
                    <Search className="w-3 h-3" />
                  </span>
                  <input
                    type="text"
                    value={companyLookalikeSearch}
                    onChange={(e) => setCompanyLookalikeSearch(e.target.value)}
                    placeholder="Filter organizations..."
                    className="w-full pl-6.5 pr-6 py-1 text-xs border border-gray-200 rounded-md focus:outline-hidden focus:border-indigo-400 bg-white"
                  />
                  {companyLookalikeSearch && (
                    <button
                      type="button"
                      onClick={() => setCompanyLookalikeSearch('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-650"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {filteredCompanyLookalikes.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1 italic">No organizations match</p>
                  ) : (
                    filteredCompanyLookalikes.map((company) => {
                      const isChecked = selectedCompanyLookalike === company;
                      return (
                        <label
                          key={company}
                          className="flex items-center space-x-2.5 py-1 px-1.5 rounded-md hover:bg-gray-100 cursor-pointer text-xs text-gray-650 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleCompanyLookalike(company)}
                            className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 transition-colors cursor-pointer"
                          />
                          <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{company}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 7. Education Accordion */}
          <div className="border-b border-gray-100">
            {renderSectionHeader(
              'education', 
              'Academic Background', 
              GraduationCap, 
              selectedEducations.length > 0, 
              selectedEducations.length, 
              () => {
                setSelectedEducations([]);
                setFilters(prev => ({ ...prev, cities: [] }));
              }
            )}
            
            {isSectionOpen('education') && (
              <div className="p-3 bg-gray-50/40 space-y-2 animate-fadeIn">
                <p className="text-[10px] text-gray-400 font-medium">Filter by institution origin:</p>
                
                {/* Inline Search */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-gray-400">
                    <Search className="w-3 h-3" />
                  </span>
                  <input
                    type="text"
                    value={educationSearch}
                    onChange={(e) => setEducationSearch(e.target.value)}
                    placeholder="Filter academic background..."
                    className="w-full pl-6.5 pr-6 py-1 text-xs border border-gray-200 rounded-md focus:outline-hidden focus:border-indigo-400 bg-white"
                  />
                  {educationSearch && (
                    <button
                      type="button"
                      onClick={() => setEducationSearch('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-650"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {filteredEducationsList.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1 italic">No academic records match</p>
                  ) : (
                    filteredEducationsList.map((univ) => {
                      const isChecked = selectedEducations.includes(univ);
                      return (
                        <label
                          key={univ}
                          className="flex items-center space-x-2.5 py-1 px-1.5 rounded-md hover:bg-gray-100 cursor-pointer text-xs text-gray-650 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleEducation(univ)}
                            className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 transition-colors cursor-pointer"
                          />
                          <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{univ}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 8. Location Accordion */}
          <div className="border-b border-gray-100">
            {renderSectionHeader(
              'cities', 
              'Geography', 
              MapPin, 
              filters.cities.length > 0, 
              filters.cities.length, 
              () => setFilters(prev => ({ ...prev, cities: [] }))
            )}

            {filters.cities.length > 0 && (
              <div className="px-3 pt-1 pb-2.5 flex flex-wrap gap-1 border-b border-gray-50 bg-gray-50/10 animate-fadeIn">
                <span className="text-[10px] font-medium text-gray-400 self-center mr-1">Geographies:</span>
                {filters.cities.slice(0, 3).map(city => (
                  <span key={city} className="inline-flex items-center bg-gray-100 border border-gray-200 text-[10px] font-medium text-gray-600 px-2 py-0.5 rounded-full">
                    <span className="truncate max-w-[90px]">{city}</span>
                    <button 
                      onClick={() => handleCheckboxChange('cities', city)}
                      className="text-gray-400 hover:text-gray-650 font-bold ml-1"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {filters.cities.length > 3 && (
                  <span className="text-[10px] font-semibold text-indigo-600 self-center px-1">+{filters.cities.length - 3}</span>
                )}
              </div>
            )}
            
            {isSectionOpen('cities') && (
              <div className="p-3 bg-gray-50/20 space-y-2 animate-fadeIn">
                {/* Inline Search */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-gray-400">
                    <Search className="w-3 h-3" />
                  </span>
                  <input
                    type="text"
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    placeholder="Filter geographies..."
                    className="w-full pl-6.5 pr-6 py-1 text-xs border border-gray-200 rounded-md focus:outline-hidden focus:border-indigo-400 bg-white"
                  />
                  {citySearch && (
                    <button
                      type="button"
                      onClick={() => setCitySearch('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-650"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {filteredCities.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1.5 italic">No geographies match</p>
                  ) : (
                    filteredCities.map((city) => (
                      <label
                        key={city}
                        className="flex items-center space-x-2.5 py-1 px-1.5 rounded-md hover:bg-gray-150/40 cursor-pointer text-xs text-gray-650 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={filters.cities.includes(city)}
                          onChange={() => handleCheckboxChange('cities', city)}
                          className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 transition-colors cursor-pointer"
                        />
                        <span className="truncate">{city}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 9. Enrichment Type Accordion */}
          <div className="border-b border-gray-100">
            {renderSectionHeader(
              'enrichmentType', 
              'Enhancement Category', 
              Sparkles, 
              selectedEnrichmentTypes.length > 0, 
              selectedEnrichmentTypes.length, 
              () => {
                setSelectedEnrichmentTypes([]);
                setFilters(prev => ({ ...prev, sources: [] }));
              }
            )}
            
            {isSectionOpen('enrichmentType') && (
              <div className="p-3 bg-gray-50/40 space-y-2 animate-fadeIn">
                <p className="text-[10px] text-gray-400 font-medium">Select data attributes:</p>
                
                {/* Inline Search */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-gray-400">
                    <Search className="w-3 h-3" />
                  </span>
                  <input
                    type="text"
                    value={enrichmentTypeSearch}
                    onChange={(e) => setEnrichmentTypeSearch(e.target.value)}
                    placeholder="Filter categories..."
                    className="w-full pl-6.5 pr-6 py-1 text-xs border border-gray-200 rounded-md focus:outline-hidden focus:border-indigo-400 bg-white"
                  />
                  {enrichmentTypeSearch && (
                    <button
                      type="button"
                      onClick={() => setEnrichmentTypeSearch('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-650"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {filteredEnrichmentTypesList.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1 italic">No categories match</p>
                  ) : (
                    filteredEnrichmentTypesList.map((type) => {
                      const isChecked = selectedEnrichmentTypes.includes(type);
                      return (
                        <label
                          key={type}
                          className="flex items-center space-x-2.5 py-1 px-1.5 rounded-md hover:bg-gray-100 cursor-pointer text-xs text-gray-650 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleEnrichmentType(type)}
                            className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 transition-colors cursor-pointer"
                          />
                          <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{type}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 10. Lead Source Accordion */}
          <div className="border-b border-gray-100">
            {renderSectionHeader(
              'sources', 
              'Contact Origin', 
              Tag, 
              filters.sources.length > 0, 
              filters.sources.length, 
              () => setFilters(prev => ({ ...prev, sources: [] }))
            )}
            
            {isSectionOpen('sources') && (
              <div className="p-3 bg-gray-50/20 space-y-2 animate-fadeIn">
                {/* Inline Search */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-gray-400">
                    <Search className="w-3 h-3" />
                  </span>
                  <input
                    type="text"
                    value={sourceSearch}
                    onChange={(e) => setSourceSearch(e.target.value)}
                    placeholder="Filter origins..."
                    className="w-full pl-6.5 pr-6 py-1 text-xs border border-gray-200 rounded-md focus:outline-hidden focus:border-indigo-400 bg-white"
                  />
                  {sourceSearch && (
                    <button
                      type="button"
                      onClick={() => setSourceSearch('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-650"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {filteredSources.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1.5 italic">No origins match</p>
                  ) : (
                    filteredSources.map((source) => (
                      <label
                        key={source}
                        className="flex items-center space-x-2.5 py-1 px-1.5 rounded-md hover:bg-gray-150/40 cursor-pointer text-xs text-gray-650 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={filters.sources.includes(source)}
                          onChange={() => handleCheckboxChange('sources', source)}
                          className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 transition-colors cursor-pointer"
                        />
                        <span className="truncate">{source}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 11. Approval Status Accordion */}
          <div className="border-b border-gray-100">
            {renderSectionHeader(
              'statuses', 
              'Verification Status', 
              ShieldCheck, 
              filters.statuses.length > 0, 
              filters.statuses.length, 
              () => setFilters(prev => ({ ...prev, statuses: [] }))
            )}
            
            {isSectionOpen('statuses') && (
              <div className="p-3 bg-gray-50/20 space-y-2 animate-fadeIn">
                {/* Inline Search */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-gray-400">
                    <Search className="w-3 h-3" />
                  </span>
                  <input
                    type="text"
                    value={statusSearch}
                    onChange={(e) => setStatusSearch(e.target.value)}
                    placeholder="Filter statuses..."
                    className="w-full pl-6.5 pr-6 py-1 text-xs border border-gray-200 rounded-md focus:outline-hidden focus:border-indigo-400 bg-white"
                  />
                  {statusSearch && (
                    <button
                      type="button"
                      onClick={() => setStatusSearch('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-650"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin pr-1">
                  {filteredStatuses.length === 0 ? (
                    <p className="text-xs text-gray-400 py-1.5 italic">No statuses match</p>
                  ) : (
                    filteredStatuses.map((status) => (
                      <label
                        key={status}
                        className="flex items-center space-x-2.5 py-1.5 px-2 rounded-md hover:bg-gray-150/40 cursor-pointer text-xs text-gray-650 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={filters.statuses.includes(status)}
                          onChange={() => handleCheckboxChange('statuses', status)}
                          className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 transition-colors cursor-pointer"
                        />
                        <span className="truncate capitalize">{status}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dynamic CSV Custom Filters Accordions */}

          {filterOptions.customFilters && Object.entries(filterOptions.customFilters).map(([columnName, options]) => {
            const selectedCustomValues = (filters.customFilters && filters.customFilters[columnName]) || [];
            const isOpen = !!openCustomSections[columnName];
            return (
              <div key={columnName} className="border-b border-gray-100">
                <div 
                  onClick={() => setOpenCustomSections(prev => ({ ...prev, [columnName]: !prev[columnName] }))}
                  className="w-full flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50/60 transition-colors"
                >
                  <div className="flex items-center space-x-2.5">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-bold text-gray-800 capitalize">{columnName}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {selectedCustomValues.length > 0 && (
                      <span className="px-1.5 py-0.5 text-2xs font-bold bg-indigo-100 text-indigo-700 rounded-full">
                        {selectedCustomValues.length}
                      </span>
                    )}
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                  </div>
                </div>

                {isOpen && (
                  <div className="p-3 bg-gray-50/20 space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
                    {options.map(val => {
                      const isChecked = selectedCustomValues.includes(val);
                      return (
                        <label key={val} className="flex items-center space-x-2.5 py-1 px-1.5 rounded-md hover:bg-gray-100 cursor-pointer text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setFilters(prev => {
                                const currentCustom = prev.customFilters || {};
                                const currentColVals = currentCustom[columnName] || [];
                                const newColVals = isChecked 
                                  ? currentColVals.filter(v => v !== val)
                                  : [...currentColVals, val];
                                return {
                                  ...prev,
                                  customFilters: {
                                    ...currentCustom,
                                    [columnName]: newColVals
                                  }
                                };
                              });
                            }}
                            className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className={isChecked ? 'font-semibold text-indigo-600' : ''}>{val}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}


        </div>

      </div>

      {/* Loading Overlay or Refresh status */}
      {isLoading && (
        <div className="px-4 py-2 bg-indigo-50/50 border-t border-gray-100 flex items-center justify-center space-x-2 text-2xs font-medium text-indigo-600 animate-pulse shrink-0">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Syncing filters...</span>
        </div>
      )}
    </aside>
  );
}
