import React, { useState, useEffect, useRef } from 'react';
import { onIdTokenChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import { Lead, Filters, FilterOptions, AuthState } from './types.ts';
import { 
  getStoredLeads, 
  saveStoredLeads,
  getFilterOptions as getClientFilterOptions, 
  filterLeads as filterClientLeads, 
  getLeadStats as getClientLeadStats, 
  toggleSaveLead, 
  unlockLeadEmail, 
  unlockLeadPhone, 
  bulkUnlockEmails, 
  addLead, 
  updateLead, 
  deleteLead, 
  bulkDeleteLeads, 
  deleteLeadsByTag,
  getStoredCsvTags,
  addCsvTag,
  removeCsvTag,
  bulkImportLeads,
  addTagToExistingLead,
  getActiveHeaders,
  getFixedHeaderValue,
  getTrashLeads,
  deleteAllLeads
} from './data/leadStorage.ts';
import { pullLeadsFromSupabase, pushLeadsToSupabase } from './lib/supabase.ts';
import { BulkImportResult } from './data/leadStorage.ts';
import DuplicateLeadsModal from './components/DuplicateLeadsModal.tsx';
import FiltersSidebar from './components/FiltersSidebar.tsx';
import LeadsTable from './components/LeadsTable.tsx';
import AddLeadModal from './components/AddLeadModal.tsx';
import EditLeadModal from './components/EditLeadModal.tsx';
import CsvImporter from './components/CsvImporter.tsx';
import SupabaseModal from './components/SupabaseModal.tsx';
import OperonNavigationDrawer from './components/OperonNavigationDrawer.tsx';
import ConfirmDeleteModal from './components/ConfirmDeleteModal.tsx';
import { AICopilotDrawer } from './components/AICopilotDrawer.tsx';
import ContactProfileDrawer from './components/ContactProfileDrawer.tsx';
import TeammatesModal from './components/TeammatesModal.tsx';
import AnalyticsView from './components/AnalyticsView.tsx';
import OutreachView from './components/OutreachView.tsx';
import SavedSearchesModal from './components/SavedSearchesModal.tsx';
import SectionInfoModal, { SectionModalKind } from './components/SectionInfoModal.tsx';
import DataEnhancementModal from './components/DataEnhancementModal.tsx';

import { 
  Search, 
  Plus, 
  Upload, 
  Download, 
  User, 
  LogIn, 
  LogOut, 
  Database, 
  TrendingUp, 
  Sparkles, 
  Check, 
  AlertCircle,
  Menu,
  Grid,
  Lock,
  Bookmark,
  Users,
  Tag,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Trash2,
  Unlock,
  Building,
  MapPin,
  Briefcase,
  X,
  ChevronDown,
  Table,
  Filter,
  RefreshCw,
  SlidersHorizontal,
  ShieldCheck,
  Sun,
  Moon
} from 'lucide-react';

export default function App() {
  // Theme State (Design.md specification)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('operon-theme') || localStorage.getItem('apollo-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('operon-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Authentication State
  const [authS, setAuthS] = useState<AuthState>({
    user: null,
    loading: true,
    token: null,
  });

  // Leads & Metadata State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allFilteredIds, setAllFilteredIds] = useState<number[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [creditBalance, setCreditBalance] = useState(100); // Simulate Operon Credit System
  const [showFiltersSidebar, setShowFiltersSidebar] = useState(true);
  const [stats, setStats] = useState({ total: 0, netNew: 0, saved: 0 });

  // AI Copilot & Navigation States
  const [activeView, setActiveView] = useState('Contacts');
  const [selectedLeadForDrawer, setSelectedLeadForDrawer] = useState<Lead | null>(null);
  const [showTeammatesModal, setShowTeammatesModal] = useState(false);
  const [showSavedSearchesModal, setShowSavedSearchesModal] = useState(false);
  const [showAICopilot, setShowAICopilot] = useState(false);
  const [aiFilteredLeadIds, setAiFilteredLeadIds] = useState<number[] | null>(null);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<Filters>({
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
    peopleLookalike: null,
    companyLookalike: null,
    educations: [],
    enrichmentTypes: [],
  });

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    jobTitles: [],
    companies: [],
    cities: [],
    sources: [],
    statuses: [],
  });

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSupabaseOpen, setIsSupabaseOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [deleteConfirmData, setDeleteConfirmData] = useState<{ type: 'single'; lead: Lead } | { type: 'bulk' } | null>(null);
  const [sectionModal, setSectionModal] = useState<SectionModalKind | null>(null);
  const [isDataEnhancementOpen, setIsDataEnhancementOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [lastImportResult, setLastImportResult] = useState<BulkImportResult | null>(null);
  const [lastImportedTag, setLastImportedTag] = useState<string | null>(null);
  const [lastImportedFileName, setLastImportedFileName] = useState<string | null>(null);

  // General States
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [tagSearchInput, setTagSearchInput] = useState('');
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [mainSearchDropdownOpen, setMainSearchDropdownOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sync Auth State
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          
          // Sync with Postgres User Table
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            },
          });

          setAuthS(prev => {
            if (!prev.user) {
              showStatus('Successfully signed in with Google!', 'success');
            }
            return {
              user: firebaseUser,
              loading: false,
              token: idToken,
            };
          });
        } catch (error) {
          console.error('User sync failed:', error);
          setAuthS({
            user: firebaseUser,
            loading: false,
            token: null,
          });
        }
      } else {
        setAuthS({
          user: null,
          loading: false,
          token: null,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch unique filter values for the sidebar
  const fetchFilterOptions = () => {
    try {
      const data = getClientFilterOptions();
      setFilterOptions(data);
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  };

  // Fetch lead statistics
  const fetchStats = () => {
    try {
      const data = getClientLeadStats(filters);
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Fetch Leads on filter/page change
  const fetchLeads = () => {
    setIsLoadingLeads(true);
    try {
      const allLeads = getStoredLeads();
      const filtered = filterClientLeads(allLeads, filters);
      setTotalLeads(filtered.length);
      setAllFilteredIds(filtered.map(l => l.id));

      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);
      setLeads(paginated);

      // Also sync statistics
      fetchStats();
    } catch (err) {
      console.error('Error fetching leads:', err);
      showStatus('Failed to load lead list.', 'error');
    } finally {
      setIsLoadingLeads(false);
    }
  };

  // Load initial filters and leads
  useEffect(() => {
    fetchFilterOptions();
  }, [leads.length]); // Refresh filter options when list count changes

  useEffect(() => {
    fetchLeads();
  }, [filters, page, limit]);

  // Single Master Source of Truth Live Database Sync
  useEffect(() => {
    const syncLiveDatabase = async () => {
      try {
        const res = await pullLeadsFromSupabase();
        const localLeads = getStoredLeads();
        const trashLeads = getTrashLeads();
        const deletedEmailSet = new Set(trashLeads.map(l => (l.email || '').toLowerCase().trim()).filter(e => e && e !== '-'));

        if (res.success && res.leads.length > 0) {
          // Filter out deleted trash leads
          const activeRemoteLeads = res.leads.filter(l => {
            const cleanEmail = (l.email || '').toLowerCase().trim();
            return !cleanEmail || cleanEmail === '-' || !deletedEmailSet.has(cleanEmail);
          });
          
          saveStoredLeads(activeRemoteLeads);
        } else if (localLeads.length > 0) {
          const activeLocalLeads = localLeads.filter(l => {
            const clean = (l.email || '').toLowerCase().trim();
            return !clean || clean === '-' || !deletedEmailSet.has(clean);
          });
          saveStoredLeads(activeLocalLeads);
          await pushLeadsToSupabase(activeLocalLeads);
        }
        fetchLeads();
        fetchFilterOptions();
      } catch (err) {
        console.error('Initial Supabase auto-sync failed:', err);
      }
    };
    syncLiveDatabase();
  }, []);



  // Sync main search input with the active filter's search value
  useEffect(() => {
    setSearchInput(filters.search || '');
  }, [filters.search]);

  // Auth Actions
  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      showStatus('Sign-In failed. Make sure popups are enabled.', 'error');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setFilters(prev => ({ ...prev, savedOnly: false }));
      setSelectedIds([]);
      showStatus('Signed out successfully.', 'success');
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  };

  // Helper for status banners
  const showStatus = (text: string, type: 'success' | 'error') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  // Single Lead Save/Bookmark Action
  const handleSaveToggle = async (lead: Lead) => {
    try {
      toggleSaveLead(lead.id);
      fetchLeads();
      showStatus(lead.isSaved ? 'Lead removed from bookmarks.' : 'Lead saved successfully!', 'success');
    } catch (err) {
      console.error('Save action failed:', err);
    }
  };

  // Applied from a sidebar section popup (Organizations / Directories / Bookmarks) —
  // jump to the Contact Directory pre-filtered on that value.
  const handleApplyFilterFromSection = (kind: 'organization' | 'city' | 'source' | 'saved', value?: string) => {
    setActiveView('Contacts');
    setSearchInput('');
    if (kind === 'saved') {
      setFilters(prev => ({ ...prev, search: '', companies: [], cities: [], sources: [], savedOnly: true }));
    } else if (kind === 'organization') {
      setFilters(prev => ({ ...prev, search: '', companies: value ? [value] : [], savedOnly: false }));
    } else if (kind === 'city') {
      setFilters(prev => ({ ...prev, search: '', cities: value ? [value] : [], savedOnly: false }));
    } else if (kind === 'source') {
      setFilters(prev => ({ ...prev, search: '', sources: value ? [value] : [], savedOnly: false }));
    }
    setPage(1);
  };

  // Data Enhancement: apply honest, derived-from-existing-data field fills (never
  // fabricated contact details) as one batch — update locally, then a single
  // Supabase push for the whole batch rather than one round-trip per contact.
  const handleApplyEnrichment = async (
    updates: Array<{ id: number; field: 'seniority' | 'department' | 'industry'; value: string }>
  ) => {
    if (updates.length === 0) return;
    try {
      const allLeads = getStoredLeads();
      const updateMap = new Map(updates.map(u => [u.id, u]));
      const changedLeads: Lead[] = [];

      const updatedLeads = allLeads.map(l => {
        const u = updateMap.get(l.id);
        if (!u) return l;
        const changed = { ...l, [u.field]: u.value };
        changedLeads.push(changed);
        return changed;
      });

      saveStoredLeads(updatedLeads);
      if (changedLeads.length > 0) {
        await pushLeadsToSupabase(changedLeads);
      }
      setCreditBalance(prev => Math.max(0, prev - updates.length));
      fetchLeads();
      fetchFilterOptions();
    } catch (err) {
      console.error('Data enhancement batch update failed:', err);
      showStatus('An error occurred while applying data enhancement.', 'error');
    }
  };

  // Single Contact Unlocking Actions (Operon Credit simulation)
  const handleUnlockEmail = async (lead: Lead) => {
    if (creditBalance < 1) {
      showStatus('Out of credits! Refill credits to unlock contacts.', 'error');
      return;
    }

    try {
      unlockLeadEmail(lead.id);
      setCreditBalance(prev => Math.max(0, prev - 1));
      fetchLeads();
      showStatus('Contact email unlocked! Used 1 credit.', 'success');
    } catch (err) {
      console.error('Email unlock failed:', err);
    }
  };

  const handleUnlockPhone = async (lead: Lead) => {
    if (creditBalance < 1) {
      showStatus('Out of credits! Refill credits to unlock contacts.', 'error');
      return;
    }

    try {
      unlockLeadPhone(lead.id);
      setCreditBalance(prev => Math.max(0, prev - 1));
      fetchLeads();
      showStatus('Contact mobile number unlocked! Used 1 credit.', 'success');
    } catch (err) {
      console.error('Phone unlock failed:', err);
    }
  };

  // Add Lead Action Handler
  const handleAddLead = async (leadData: any) => {
    try {
      await addLead(leadData);
      fetchLeads();
      fetchFilterOptions();
      showStatus('Lead created & synced to Supabase!', 'success');
      return true;
    } catch (err) {
      console.error('Create lead failed:', err);
    }
    return false;
  };

  // Update Lead Action Handler
  const handleUpdateLead = async (id: number, leadData: any) => {
    try {
      await updateLead(id, leadData);
      fetchLeads();
      fetchFilterOptions();
      showStatus('Lead updated & synced to Supabase!', 'success');
      return true;
    } catch (err) {
      console.error('Update lead failed:', err);
    }
    return false;
  };

  // Delete Lead Action Handler
  const handleDeleteLead = async (lead: Lead) => {
    setDeleteConfirmData({ type: 'single', lead });
    setIsConfirmDeleteOpen(true);
  };

  const executeDeleteLead = async (lead: Lead) => {
    try {
      const { error } = await deleteLead(lead.id);
      fetchLeads();
      fetchFilterOptions();
      setSelectedIds(prev => prev.filter(id => id !== lead.id));
      if (error) {
        showStatus(`Could not confirm this contact was deleted from Supabase (${error}) — left in place, try again shortly.`, 'error');
      } else {
        showStatus('Lead deleted & synced to Supabase.', 'success');
      }
    } catch (err) {
      console.error('Delete lead failed:', err);
      showStatus('An error occurred while deleting the lead.', 'error');
    }
  };

  // Bulk Actions
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setDeleteConfirmData({ type: 'bulk' });
    setIsConfirmDeleteOpen(true);
  };

  const executeBulkDelete = async () => {
    try {
      const { count, error } = await bulkDeleteLeads(selectedIds);
      fetchLeads();
      fetchFilterOptions();
      setSelectedIds([]);
      setBulkMenuOpen(false);
      if (error) {
        showStatus(`Deleted ${count} contact(s) confirmed in Supabase; the rest couldn't be verified as removed (${error}) and were left in place — try again shortly.`, 'error');
      } else {
        showStatus('Bulk deletion complete & synced to Supabase!', 'success');
      }
    } catch (err) {
      console.error('Bulk delete failed:', err);
      showStatus('An error occurred during bulk deletion.', 'error');
    }
  };

  const executeDeleteAll = async () => {
    try {
      showStatus('Purging all contact data from system & Supabase...', 'success');
      await deleteAllLeads();
      fetchLeads();
      fetchFilterOptions();
      setSelectedIds([]);
      setBulkMenuOpen(false);
      showStatus('All contacts successfully deleted from system & Supabase!', 'success');
    } catch (err) {
      console.error('Delete all failed:', err);
      showStatus('An error occurred while purging all contacts.', 'error');
    }
  };

  const handleBulkUnlockEmails = async () => {
    if (selectedIds.length === 0) return;
    if (creditBalance < selectedIds.length) {
      showStatus('Insufficient credits for bulk unlock!', 'error');
      return;
    }

    try {
      bulkUnlockEmails(selectedIds);
      setCreditBalance(prev => Math.max(0, prev - selectedIds.length));
      fetchLeads();
      setSelectedIds([]);
      setBulkMenuOpen(false);
      showStatus(`Successfully unlocked ${selectedIds.length} contact emails!`, 'success');
    } catch (err) {
      console.error('Bulk email unlock failed:', err);
    }
  };

  const handleBulkSave = async () => {
    if (selectedIds.length === 0) return;

    try {
      for (const id of selectedIds) {
        toggleSaveLead(id);
      }
      fetchLeads();
      setSelectedIds([]);
      setBulkMenuOpen(false);
      showStatus('Selected leads saved successfully!', 'success');
    } catch (err) {
      console.error('Bulk save failed:', err);
    }
  };

  // CSV Import Action Handler
  const handleImportLeads = async (items: any[]) => {
    try {
      const result = await bulkImportLeads(items);
      setPage(1); // Jump to Page 1 so newly uploaded leads display immediately at top of app table
      fetchLeads();
      fetchFilterOptions();

      setLastImportResult(result);
      setLastImportedTag(items[0]?.csvTag || null);
      setLastImportedFileName(items[0]?._csvFileName || null);

      if (result.duplicatesSkipped > 0) {
        setIsDuplicateModalOpen(true);
        showStatus(`Imported ${result.count} new contact(s). ${result.duplicatesSkipped} exact duplicate cop${result.duplicatesSkipped === 1 ? 'y' : 'ies'} skipped.`, 'success');
      } else {
        showStatus(`Imported ${result.count} new contacts & synced live to Supabase!`, 'success');
      }
      return true;
    } catch (err) {
      console.error('Import action failed:', err);
      showStatus('An error occurred during CSV import.', 'error');
    }
    return false;
  };

  // CSV Bulk Export
  const handleExportCsv = () => {
    const allStoredLeads = getStoredLeads();
    const allFilteredLeads = filterClientLeads(allStoredLeads, filters);

    const leadsToExport = selectedIds.length > 0 
      ? allStoredLeads.filter(l => selectedIds.includes(l.id))
      : allFilteredLeads;

    if (leadsToExport.length === 0) {
      showStatus('No contacts found to export.', 'error');
      return;
    }

    // Headers are permanently fixed (see FIXED_HEADERS in leadStorage.ts) so exports
    // always have the exact same columns, correctly mapped, no matter what was imported.
    const headers: string[] = getActiveHeaders();
    const rows: string[][] = leadsToExport.map(l => headers.map(h => getFixedHeaderValue(l, h)));

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `operon_contacts_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showStatus(`Exported ${leadsToExport.length} contacts to CSV successfully.`, 'success');
  };

  // Search Submit Handler
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, search: searchInput }));
    setPage(1);
  };

  // Clear search and reset input
  const handleClearSearch = () => {
    setSearchInput('');
    setFilters(prev => ({ ...prev, search: '' }));
    setPage(1);
  };

  // Sidebar Filters Clear
  const handleClearAllFilters = () => {
    setSearchInput('');
    setFilters({
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
      peopleLookalike: null,
      companyLookalike: null,
      educations: [],
      enrichmentTypes: [],
    });
    setPage(1);
  };

  // Dynamic Metrics counts
  const totalLeadsCount = totalLeads;
  const pageStartCount = (page - 1) * limit + 1;
  const pageEndCount = Math.min(page * limit, totalLeads);

  const activeFiltersCount = 
    filters.jobTitles.length + 
    filters.companies.length + 
    filters.cities.length + 
    filters.sources.length + 
    filters.statuses.length + 
    (filters.savedOnly ? 1 : 0) +
    (filters.netNewOnly ? 1 : 0);

  const getCurrentViewName = () => {
    const hasOtherFilters = 
      filters.jobTitles.length > 0 || 
      filters.companies.length > 0 || 
      filters.cities.length > 0 || 
      filters.sources.length > 0 || 
      filters.search !== '';

    if (filters.savedOnly && !hasOtherFilters && filters.statuses.length === 0) {
      return 'Saved Contacts';
    }
    if (filters.statuses.length === 1 && !filters.savedOnly && !hasOtherFilters) {
      if (filters.statuses[0] === 'pending') return 'Pending Verification';
      if (filters.statuses[0] === 'approved') return 'Approved Contacts';
      if (filters.statuses[0] === 'rejected') return 'Rejected Contacts';
    }
    if (hasOtherFilters || filters.statuses.length > 0 || filters.savedOnly) {
      return 'Custom View';
    }
    return 'Standard Layout';
  };

  const displayedLeads = aiFilteredLeadIds !== null 
    ? leads.filter(l => aiFilteredLeadIds.includes(l.id))
    : leads;

  return (
    <div className="app-outer select-none">
      <div className="atmosphere" />
      
      {/* Floating Status Notification Toast */}
      {statusMessage && (
        <div className={`fixed top-4 right-6 z-50 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg flex items-center space-x-2 border animate-fadeIn ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {statusMessage.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Glass Shell Container */}
      <div className="app-shell glass-panel">
        
        {/* Operon Left-most Collapsible Navigation Drawer */}
        <OperonNavigationDrawer
          activeView={activeView}
          setActiveView={setActiveView}
          onShowMessage={showStatus}
          onAddTeammateClick={() => setShowTeammatesModal(true)}
          onOpenSupabase={() => setIsSupabaseOpen(true)}
          onOpenSectionModal={(section) => setSectionModal(section as SectionModalKind)}
          onOpenAIAssistant={() => setShowAICopilot(true)}
          onOpenDataEnhancement={() => setIsDataEnhancementOpen(true)}
          contactsCount={leads.length}
        />

        {/* Left Side Filters Bar */}
        {showFiltersSidebar && (
          <FiltersSidebar
            filters={filters}
            setFilters={setFilters}
            filterOptions={filterOptions}
            onClear={handleClearAllFilters}
            isLoading={isLoadingLeads}
          />
        )}

        {/* Right Side Content Pane */}
        <main className="app-content">
          
          {/* Executive Topbar Command Header */}
          <div className="topbar">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-pink-500 p-0.5 flex items-center justify-center shadow-lg">
                <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[14px] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-base font-black tracking-tight font-display text-[var(--text-primary)]">OPERON ENTERPRISE AI</h1>
                  <span className="role-badge-text super-admin text-xs tracking-tight uppercase">
                    Super Admin
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)] font-medium">Real-time Lead Intelligence & Supabase Database Sync</p>
              </div>
            </div>

            {/* Topbar Right Controls & Indicators */}
            <div className="flex items-center space-x-3 text-xs font-semibold">
              
              {/* Dark / Light Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="w-11 h-11 rounded-full pill-control justify-center cursor-pointer hover:scale-105 transition-transform"
                title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              >
                {theme === 'light' ? (
                  <Moon className="w-5 h-5 text-indigo-600" />
                ) : (
                  <Sun className="w-5 h-5 text-amber-400" />
                )}
              </button>

              {/* Supabase Live Status Pill */}
              <button
                onClick={() => setIsSupabaseOpen(true)}
                className="pill-control cursor-pointer space-x-2 text-[var(--text-primary)]"
                title="Supabase PostgreSQL Database Connected"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-mono text-emerald-700 dark:text-emerald-400 text-xs font-bold">Supabase Connected</span>
              </button>

              {/* Operon Credit Balance */}
              <div className="pill-control space-x-2 text-[var(--text-primary)]">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                <span>Credits: <strong className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{creditBalance}</strong></span>
              </div>
            </div>
          </div>

          {/* Scrollable content area — also the hook for index.css's dark-mode text
              safety net ([data-theme="dark"] .app-main ...), which forces readable
              text color on plain elements here while padding is neutralized below so
              every section keeps its own existing spacing unchanged. */}
          <div className="app-main" style={{ padding: 0 }}>

          {/* Executive KPI Overview Cards Bar */}
          <div className="px-6 py-4 border-b border-[var(--border-subtle)] shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Card 1: Total Contacts */}
              <div className="p-4 glass-card relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600" />
                <div className="flex items-center justify-between mb-2">
                  <span className="micro-label">Total Contacts</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold font-serif-kpi text-[var(--text-primary)] tracking-tight">{totalLeads}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 font-medium">Verified leads in system</p>
              </div>

              {/* Card 2: Supabase Storage */}
              <div className="p-4 glass-card relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                <div className="flex items-center justify-between mb-2">
                  <span className="micro-label">PostgreSQL Cloud DB</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Database className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold font-serif-kpi text-[var(--text-primary)] tracking-tight">Active</span>
                  <span className="badge badge-completed">
                    Auto-Sync
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 font-medium">Table: <code className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">registration_contacts</code></p>
              </div>

              {/* Card 3: Operon AI Copilot */}
              <div className="p-4 glass-card relative overflow-hidden group">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-600" />
                <div className="flex items-center justify-between mb-2">
                  <span className="micro-label">AI Outreach Copilot</span>
                  <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-extrabold font-serif-kpi text-[var(--text-primary)] tracking-tight">AI Assistant</span>
                  <button
                    onClick={() => setShowAICopilot(true)}
                    className="btn-brand-gradient text-xs py-1 px-3"
                  >
                    Open AI Chat
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 font-medium">Generate emails & smart filters</p>
              </div>

            </div>
          </div>

          {/* Sub-toolbar Controls Row */}
          <div className="px-6 pt-3.5 pb-3 flex flex-col space-y-2 shrink-0 border-b border-[var(--border-subtle)]">

            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-black tracking-tight text-[var(--text-primary)] font-display">Contact Directory</h2>
              
              {/* TOP TABLE PAGINATION CONTROLS & "25 per page" DROPDOWN */}
              <div className="flex items-center space-x-3">
                <span className="text-xs text-slate-600 font-extrabold hidden sm:inline">
                  Showing <strong className="text-violet-950 font-black">{pageStartCount}-{pageEndCount}</strong> of <strong className="text-violet-950 font-black">{totalLeads}</strong>
                </span>

                {/* Prev / Next Buttons */}
                <div className="flex items-center space-x-1">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-40 super-3d-white-btn cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="px-2.5 py-1 text-xs font-black text-violet-950 bg-violet-100 border border-violet-200 rounded-xl shadow-2xs">
                    {page}
                  </span>

                  <button
                    disabled={totalLeadsCount === 0 || pageEndCount >= totalLeadsCount}
                    onClick={() => setPage(p => p + 1)}
                    className="p-1.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-40 super-3d-white-btn cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 25 per page dropdown */}
                <div className="relative flex items-center text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 super-3d-white-btn">
                  <label htmlFor="top-rows-per-page-select" className="sr-only">Rows per page</label>
                  <select
                    id="top-rows-per-page-select"
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-transparent pr-2 focus:outline-none cursor-pointer text-xs font-black text-[var(--text-primary)]"
                  >
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Operon Sub-toolbar row with high fidelity to Operon's controls (Screenshot 1) */}
            <div className="flex items-center space-x-3 text-xs font-semibold text-[var(--text-secondary)] pt-1 select-none">
              
              {/* Default view dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setViewDropdownOpen(!viewDropdownOpen)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-[var(--border-subtle)] rounded-lg hover:bg-[var(--surface-hover)] bg-[var(--surface-card)] shadow-3xs cursor-pointer text-[var(--text-secondary)] font-medium transition-colors"
                >
                  <Table className="w-3.5 h-3.5 text-gray-500" />
                  <span>{getCurrentViewName()}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>

                {viewDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setViewDropdownOpen(false)}
                    />
                    <div className="absolute left-0 mt-1.5 w-56 bg-[var(--surface-card-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-xl py-1.5 z-45 animate-fadeIn">
                      <div className="px-3 py-1 text-4xs font-bold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)] mb-1">
                        System Views
                      </div>
                      
                      {/* Default view */}
                      <button
                        onClick={() => {
                          handleClearAllFilters();
                          setViewDropdownOpen(false);
                          showStatus('Standard Layout selected (all filters cleared).', 'success');
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between font-semibold hover:bg-gray-50 cursor-pointer ${
                          getCurrentViewName() === 'Standard Layout' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <Table className="w-3.5 h-3.5 text-gray-500" />
                          <span>Standard Layout</span>
                        </div>
                        {getCurrentViewName() === 'Standard Layout' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </button>

                      {/* Saved Leads */}
                      <button
                        onClick={() => {
                          setFilters({
                            search: '',
                            jobTitles: [],
                            companies: [],
                            cities: [],
                            sources: [],
                            statuses: [],
                            savedOnly: true,
                            netNewOnly: false,
                          });
                          setSearchInput('');
                          setPage(1);
                          setViewDropdownOpen(false);
                          showStatus('Saved Contacts view selected.', 'success');
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between font-semibold hover:bg-gray-50 cursor-pointer ${
                          getCurrentViewName() === 'Saved Contacts' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <Bookmark className="w-3.5 h-3.5 text-gray-500" />
                          <span>Saved Contacts</span>
                        </div>
                        {getCurrentViewName() === 'Saved Contacts' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </button>

                      {/* Pending Verification */}
                      <button
                        onClick={() => {
                          setFilters({
                            search: '',
                            jobTitles: [],
                            companies: [],
                            cities: [],
                            sources: [],
                            statuses: ['pending'],
                            savedOnly: false,
                            netNewOnly: false,
                          });
                          setSearchInput('');
                          setPage(1);
                          setViewDropdownOpen(false);
                          showStatus('Pending Verification view selected.', 'success');
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between font-semibold hover:bg-gray-50 cursor-pointer ${
                          getCurrentViewName() === 'Pending Verification' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                          <span>Pending Verification</span>
                        </div>
                        {getCurrentViewName() === 'Pending Verification' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </button>

                      {/* Approved Leads */}
                      <button
                        onClick={() => {
                          setFilters({
                            search: '',
                            jobTitles: [],
                            companies: [],
                            cities: [],
                            sources: [],
                            statuses: ['approved'],
                            savedOnly: false,
                            netNewOnly: false,
                          });
                          setSearchInput('');
                          setPage(1);
                          setViewDropdownOpen(false);
                          showStatus('Approved Contacts view selected.', 'success');
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between font-semibold hover:bg-gray-50 cursor-pointer ${
                          getCurrentViewName() === 'Approved Contacts' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Approved Contacts</span>
                        </div>
                        {getCurrentViewName() === 'Approved Contacts' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </button>

                      {/* Rejected Leads */}
                      <button
                        onClick={() => {
                          setFilters({
                            search: '',
                            jobTitles: [],
                            companies: [],
                            cities: [],
                            sources: [],
                            statuses: ['rejected'],
                            savedOnly: false,
                            netNewOnly: false,
                          });
                          setSearchInput('');
                          setPage(1);
                          setViewDropdownOpen(false);
                          showStatus('Rejected Contacts view selected.', 'success');
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between font-semibold hover:bg-gray-50 cursor-pointer ${
                          getCurrentViewName() === 'Rejected Contacts' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                          <span>Rejected Contacts</span>
                        </div>
                        {getCurrentViewName() === 'Rejected Contacts' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Hide / Show Filters button (Screenshot 1) */}
              <button 
                onClick={() => setShowFiltersSidebar(!showFiltersSidebar)}
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 border rounded-lg hover:bg-[var(--surface-hover)] bg-[var(--surface-card)] shadow-3xs cursor-pointer text-[var(--text-secondary)] font-medium transition-all ${
                  !showFiltersSidebar ? 'border-indigo-200 text-indigo-700 bg-indigo-50/40' : 'border-[var(--border-subtle)]'
                }`}
              >
                <Filter className="w-3.5 h-3.5 text-gray-500" />
                <span>{showFiltersSidebar ? 'Hide Filters' : 'Show Filters'}</span>
                {activeFiltersCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 text-3xs font-extrabold bg-indigo-100 text-indigo-700 rounded-full">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Enrichment action button (Screenshot 1) */}
              <button 
                onClick={async () => {
                  showStatus('Syncing database records and refreshing scores...', 'success');
                  await fetchLeads();
                  showStatus('Contact data synchronized successfully!', 'success');
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-[var(--border-subtle)] rounded-lg hover:bg-[var(--surface-hover)] bg-[var(--surface-card)] shadow-3xs cursor-pointer text-[var(--text-secondary)] font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                <span>Data Sync</span>
                <span className="px-1.5 py-0.2 text-3xs font-extrabold bg-amber-50 text-amber-700 rounded-full border border-amber-200 scale-90">
                  Ready
                </span>
              </button>

              {/* AI Copilot Toggle Button */}
              <button 
                onClick={() => setShowAICopilot(!showAICopilot)}
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 border rounded-lg transition-all shadow-3xs cursor-pointer font-extrabold text-xs ${
                  showAICopilot 
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 border-indigo-500 text-white shadow-md shadow-indigo-200'
                    : 'bg-[var(--surface-card)] hover:bg-indigo-50/30 border-indigo-200 text-indigo-700'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${showAICopilot ? 'text-white' : 'text-indigo-600 animate-pulse'}`} />
                <span>AI Assistant</span>
                <span className="px-1.5 py-0.1 text-[9px] font-extrabold bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200 scale-90">
                  New
                </span>
              </button>
              
            </div>
          </div>

          {/* Search, metrics and actions control panel */}
          <div className="p-4 border-b border-[var(--border-subtle)] flex flex-col space-y-3 shrink-0 bg-[var(--surface-card-header)]">
            
            {/* Top row controls */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              
              {/* Dual Search Bar Container: Main Contact Search + CSV Tag Search */}
              <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2.5 flex-1">
                {/* 1. Main Search Bar with Autocomplete Suggestions */}
                <form 
                  onSubmit={(e) => {
                    handleSearchSubmit(e);
                    setMainSearchDropdownOpen(false);
                  }} 
                  className="flex items-center flex-1 w-full relative"
                >
                  <div className="relative w-full">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-[var(--text-muted)]">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={searchInput}
                      onFocus={() => setMainSearchDropdownOpen(true)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSearchInput(val);
                        setFilters(prev => ({ ...prev, search: val }));
                        setPage(1);
                        setMainSearchDropdownOpen(true);
                      }}
                      placeholder="Search contacts by name, company, title, location..."
                      className="search-pill pr-8 text-xs font-medium placeholder-gray-500"
                    />
                    {searchInput && (
                      <button
                        type="button"
                        onClick={() => {
                          handleClearSearch();
                          setMainSearchDropdownOpen(false);
                        }}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Main Search Autocomplete Suggestions Dropdown */}
                    {mainSearchDropdownOpen && (() => {
                      const term = searchInput.trim().toLowerCase();
                      const storedLeads = getStoredLeads();
                      
                      const matchingNames: { label: string; sub: string }[] = [];
                      const matchingCompanies = new Set<string>();
                      const matchingTitles = new Set<string>();
                      const matchingCities = new Set<string>();

                      storedLeads.forEach(l => {
                        const name = `${l.firstName || ''} ${l.lastName || ''}`.trim();
                        if (name && name !== 'Unknown' && name !== '-') {
                          if (!term || name.toLowerCase().includes(term)) {
                            if (!matchingNames.some(n => n.label.toLowerCase() === name.toLowerCase())) {
                              matchingNames.push({ label: name, sub: l.organization && l.organization !== '-' ? l.organization : l.jobTitle || '' });
                            }
                          }
                        }
                        if (l.organization && l.organization !== '-' && (!term || l.organization.toLowerCase().includes(term))) {
                          matchingCompanies.add(l.organization);
                        }
                        if (l.jobTitle && l.jobTitle !== '-' && (!term || l.jobTitle.toLowerCase().includes(term))) {
                          matchingTitles.add(l.jobTitle);
                        }
                        if (l.city && l.city !== '-' && (!term || l.city.toLowerCase().includes(term))) {
                          matchingCities.add(l.city);
                        }
                      });

                      const nameList = matchingNames.slice(0, 4);
                      const companyList = Array.from(matchingCompanies).slice(0, 3);
                      const titleList = Array.from(matchingTitles).slice(0, 3);
                      const cityList = Array.from(matchingCities).slice(0, 3);

                      const totalResults = nameList.length + companyList.length + titleList.length + cityList.length;

                      if (totalResults === 0) return null;

                      const handleSelect = (val: string) => {
                        setSearchInput(val);
                        setFilters(prev => ({ ...prev, search: val }));
                        setPage(1);
                        setMainSearchDropdownOpen(false);
                      };

                      return (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setMainSearchDropdownOpen(false)}
                          />
                          <div className="absolute left-0 right-0 mt-1 bg-[var(--surface-card-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-xl py-2 z-45 max-h-72 overflow-y-auto animate-fadeIn">
                            {/* Contact Names */}
                            {nameList.length > 0 && (
                              <div className="mb-2">
                                <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50/60 border-y border-blue-100 flex items-center justify-between">
                                  <span>Contacts</span>
                                  <User className="w-3 h-3 text-blue-500" />
                                </div>
                                {nameList.map(item => (
                                  <button
                                    key={item.label}
                                    type="button"
                                    onClick={() => handleSelect(item.label)}
                                    className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between font-semibold hover:bg-blue-50 text-slate-800 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center space-x-2 truncate">
                                      <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                      <span className="font-bold text-slate-900 truncate">{item.label}</span>
                                    </div>
                                    {item.sub && <span className="text-[10px] text-gray-400 truncate max-w-[120px] ml-2 font-normal">{item.sub}</span>}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Companies */}
                            {companyList.length > 0 && (
                              <div className="mb-2">
                                <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50/60 border-y border-emerald-100 flex items-center justify-between">
                                  <span>Companies</span>
                                  <Building className="w-3 h-3 text-emerald-500" />
                                </div>
                                {companyList.map(comp => (
                                  <button
                                    key={comp}
                                    type="button"
                                    onClick={() => handleSelect(comp)}
                                    className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between font-semibold hover:bg-emerald-50 text-slate-800 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center space-x-2 truncate">
                                      <Building className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                      <span className="font-bold text-slate-900 truncate">{comp}</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Job Titles */}
                            {titleList.length > 0 && (
                              <div className="mb-2">
                                <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-violet-600 bg-violet-50/60 border-y border-violet-100 flex items-center justify-between">
                                  <span>Job Titles</span>
                                  <Briefcase className="w-3 h-3 text-violet-500" />
                                </div>
                                {titleList.map(title => (
                                  <button
                                    key={title}
                                    type="button"
                                    onClick={() => handleSelect(title)}
                                    className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between font-semibold hover:bg-violet-50 text-slate-800 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center space-x-2 truncate">
                                      <Briefcase className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                                      <span className="font-bold text-slate-900 truncate">{title}</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Locations */}
                            {cityList.length > 0 && (
                              <div>
                                <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-600 bg-amber-50/60 border-y border-amber-100 flex items-center justify-between">
                                  <span>Locations</span>
                                  <MapPin className="w-3 h-3 text-amber-500" />
                                </div>
                                {cityList.map(city => (
                                  <button
                                    key={city}
                                    type="button"
                                    onClick={() => handleSelect(city)}
                                    className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between font-semibold hover:bg-amber-50 text-slate-800 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center space-x-2 truncate">
                                      <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                      <span className="font-bold text-slate-900 truncate">{city}</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <button
                    type="submit"
                    className="btn-primary !text-xs !py-2 ml-2 shrink-0"
                  >
                    Search
                  </button>
                </form>

                {/* 2. CSV Tag Search Bar & Delete Tag Button (Stacked Vertically at Bottom) */}
                <div className="flex flex-col space-y-1.5 w-full sm:w-64 shrink-0">
                  <div className="relative w-full">
                    <div className="relative w-full">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-violet-600">
                        <Tag className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        value={tagSearchInput}
                        onFocus={() => setTagDropdownOpen(true)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTagSearchInput(val);
                          setFilters(prev => ({
                            ...prev,
                            sources: val.trim() ? [val.trim()] : []
                          }));
                          setPage(1);
                        }}
                        placeholder="Search CSV Tag (e.g. Q3-Marketing)..."
                        className="search-pill pr-8 text-xs font-bold placeholder-violet-400 !bg-violet-50/30 dark:!bg-violet-500/10 !border-violet-200"
                      />
                      {tagSearchInput && (
                        <button
                          type="button"
                          onClick={() => {
                            setTagSearchInput('');
                            setFilters(prev => ({ ...prev, sources: [] }));
                            setPage(1);
                          }}
                          className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-violet-400 hover:text-violet-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* CSV Tag Autocomplete Suggestions Dropdown */}
                    {tagDropdownOpen && (() => {
                      // ONLY show custom tags explicitly created by the user during CSV uploads!
                      // Derive suggestions straight from the actual current lead data (not the
                      // separate, per-browser-only getStoredCsvTags() registry) — that registry
                      // only gets written when a CSV is imported in *this* browser, so a fresh
                      // session or a different device pulling the same data from Supabase would
                      // otherwise see zero suggestions, even for genuine tags.
                      const normalizeTag = (s: string) => s.trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
                      const mockSourcesToIgnore = new Set([
                        'facebook ads',
                        'old registrants email campaign',
                        'whatsapp invitation',
                        'registration report',
                        'manual entry',
                        'contacts',
                        'leads',
                        'export',
                        'data',
                        'file',
                        'sheet',
                        'supabase',
                        'null',
                        'undefined'
                      ]);

                      // A genuine CSV upload tag is assigned to a whole batch of contacts at
                      // once, never just one — so also require more than a single contact to
                      // actually carry it. This catches junk the ignore-list can't name up
                      // front, like a data-quality bug where a contact's own name ended up in
                      // their own sourceName field (one contact each, never a real "tag").
                      const tagUsageCount = new Map<string, number>();
                      // csvTag is always a deliberate, explicit batch identifier (typed by the
                      // user or defaulted to the filename at upload time) — never a data-quality
                      // leak the way a stray sourceName can be — so any csvTag value qualifies
                      // regardless of how many rows carry it.
                      const explicitCsvTags = new Set<string>();
                      getStoredLeads().forEach(l => {
                        const src = (l.sourceName || '').trim();
                        if (src && src !== '-') {
                          tagUsageCount.set(src, (tagUsageCount.get(src) || 0) + 1);
                        }
                        const tag = (l.csvTag || '').trim();
                        if (tag && tag !== '-') explicitCsvTags.add(tag);
                      });

                      const combinedTags = new Set([...getStoredCsvTags(), ...Array.from(tagUsageCount.keys()), ...explicitCsvTags]);

                      const csvImportTags = Array.from(combinedTags).filter(t => {
                        if (!t || t === '-' || t.trim() === '') return false;
                        if (mockSourcesToIgnore.has(normalizeTag(t))) return false;
                        return explicitCsvTags.has(t) || (tagUsageCount.get(t) || 0) > 1;
                      });

                      if (csvImportTags.length === 0) return null;

                      return (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setTagDropdownOpen(false)}
                          />
                          <div className="absolute left-0 right-0 mt-1 bg-[var(--surface-card-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-xl py-1.5 z-45 max-h-56 overflow-y-auto animate-fadeIn">
                            <div className="px-3 py-1 text-4xs font-extrabold uppercase tracking-wider text-violet-600 border-b border-violet-100 mb-1 flex items-center justify-between">
                              <span>Your Uploaded CSV Tags</span>
                              <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.2 rounded-full font-bold">{csvImportTags.length} active</span>
                            </div>
                            {csvImportTags
                              .filter(s => s.toLowerCase().includes(tagSearchInput.toLowerCase()))
                              .map((tag) => {
                                const isSelected = filters.sources.includes(tag);
                                return (
                                  <button
                                    key={tag}
                                    onClick={() => {
                                      setTagSearchInput(tag);
                                      setFilters(prev => ({ ...prev, sources: [tag] }));
                                      setPage(1);
                                      setTagDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between font-semibold hover:bg-violet-50 transition-colors cursor-pointer ${
                                      isSelected ? 'text-violet-700 bg-violet-50 font-extrabold' : 'text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2 truncate">
                                      <Tag className="w-3 h-3 text-violet-500 shrink-0" />
                                      <span className="truncate font-bold">#{tag}</span>
                                    </div>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-violet-600 shrink-0" />}
                                  </button>
                                );
                              })}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Red Delete Tagged CSV Button (Placed Directly at Bottom of Tag Search Bar) */}
                  <button
                    type="button"
                    disabled={!tagSearchInput.trim()}
                    onClick={async () => {
                      const tagToDelete = tagSearchInput.trim();
                      if (!tagToDelete) return;

                      const confirmDelete = window.confirm(
                        `⚠️ Are you sure you want to PERMANENTLY DELETE all contact data tagged with "${tagToDelete}" from your local directory and Supabase database?`
                      );

                      if (confirmDelete) {
                        showStatus(`Deleting contacts tagged with "${tagToDelete}"...`, 'success');
                        const { count: deletedCount, error: deleteError } = await deleteLeadsByTag(tagToDelete);

                        setTagSearchInput('');
                        setFilters(prev => ({ ...prev, sources: [] }));
                        setPage(1);
                        await fetchLeads();
                        await fetchFilterOptions();

                        if (deleteError) {
                          showStatus(
                            `Deleted ${deletedCount} contact(s) confirmed in Supabase, but some records tagged "${tagToDelete}" could not be verified as removed (${deleteError}). They were left in place rather than risk hiding data that's still really there — try again in a moment.`,
                            'error'
                          );
                        } else {
                          showStatus(
                            `Successfully deleted ${deletedCount} contact(s) tagged with "${tagToDelete}" from system & Supabase database.`,
                            'success'
                          );
                        }
                      }
                    }}
                    title={
                      tagSearchInput.trim() 
                        ? `Delete all contacts tagged with "${tagSearchInput.trim()}"` 
                        : "Type or select a CSV tag above to enable deletion"
                    }
                    className={`w-full inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 text-2xs font-extrabold rounded-xl transition-all shadow-2xs cursor-pointer ${
                      tagSearchInput.trim()
                        ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 active:scale-95'
                        : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed opacity-70'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete Tagged CSV Data</span>
                  </button>
                </div>
              </div>

              {/* Super 3D Action Buttons */}
              <div className="flex items-center space-x-2.5">
                
                {/* Export CSV */}
                <button
                  onClick={handleExportCsv}
                  title="Export contacts to CSV"
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-black text-[var(--text-primary)] bg-[var(--surface-card)] rounded-xl cursor-pointer super-3d-white-btn"
                >
                  <Download className="w-3.5 h-3.5 text-violet-600" />
                  <span>Download CSV</span>
                </button>

                {/* Import CSV */}
                <button
                  onClick={() => setIsImportOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-black text-[var(--text-primary)] bg-[var(--surface-card)] rounded-xl cursor-pointer super-3d-white-btn"
                >
                  <Upload className="w-3.5 h-3.5 text-violet-600" />
                  <span>Upload CSV</span>
                </button>

                {/* Add Contact button — Design.md §8: routine primary action = .btn-primary */}
                <button
                  onClick={() => setIsAddOpen(true)}
                  className="btn-primary !text-xs !py-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Contact</span>
                </button>

              </div>
            </div>

            {/* Bulk actions area when contacts are selected */}
            {selectedIds.length > 0 && (
              <div className="flex items-center justify-end pt-2">
                <div className="flex items-center space-x-2 animate-fadeIn">
                  <span className="text-2xs text-gray-500 font-bold uppercase tracking-wider">
                    {selectedIds.length} selected
                  </span>
                  
                  <div className="relative">
                    <button
                      onClick={() => setBulkMenuOpen(!bulkMenuOpen)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 border border-indigo-100 text-2xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all cursor-pointer"
                    >
                      <span>Bulk Actions</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    
                    {bulkMenuOpen && (
                      <div className="absolute right-0 bottom-full mb-1.5 w-48 bg-[var(--surface-card-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-xl py-1.5 z-40">
                        {/* Bulk save */}
                        <button
                          onClick={handleBulkSave}
                          className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2 font-medium"
                        >
                          <Bookmark className="w-3.5 h-3.5 text-gray-400" />
                          <span>Save Selected</span>
                        </button>
                        {/* Bulk unlock email */}
                        <button
                          onClick={handleBulkUnlockEmails}
                          className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2 font-medium"
                        >
                          <Unlock className="w-3.5 h-3.5 text-gray-400" />
                          <span>Access Emails ({selectedIds.length})</span>
                        </button>
                        {/* Bulk Delete */}
                        <button
                          onClick={handleBulkDelete}
                          className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center space-x-2 font-semibold border-t border-gray-100 mt-1"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          <span>Delete Selected ({selectedIds.length})</span>
                        </button>
                        {/* Delete ALL Contacts */}
                        <button
                          onClick={() => {
                            if (window.confirm(`⚠️ Are you sure you want to PERMANENTLY DELETE ALL ${totalLeads} contacts from the directory and Supabase?`)) {
                              executeDeleteAll();
                            }
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-red-700 bg-red-50/50 hover:bg-red-100/70 flex items-center space-x-2 font-bold"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                          <span>Delete ALL {totalLeads} Contacts</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedIds([])}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* View Content Routing */}
          <div className="flex-1 overflow-hidden flex flex-col relative">
            
            {activeView === 'Deliverability' || activeView === 'Settings' ? (
              <div key="analytics-view" className="flex-1 overflow-y-auto page-enter">
                <AnalyticsView leads={leads} />
              </div>
            ) : activeView === 'Sequences' || activeView === 'Messages' || activeView === 'Phone Calls' || activeView === 'Tasks' ? (
              <div key="outreach-view" className="flex-1 overflow-y-auto page-enter">
                <OutreachView leads={leads} onShowMessage={showStatus} />
              </div>
            ) : (
              <div key="contacts-view" className="page-enter flex-1 flex flex-col min-h-0">
                {isLoadingLeads && (
                  <div className="absolute inset-0 z-20 bg-[var(--surface-base)]/70 backdrop-blur-3xs flex items-center justify-center">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-semibold text-[var(--text-muted)] tracking-wide">Syncing Operon lead directory...</span>
                    </div>
                  </div>
                )}

                {aiFilteredLeadIds !== null && (
                  <div className="bg-gradient-to-r from-indigo-50/70 to-violet-50/70 border-b border-indigo-100 px-6 py-2.5 flex items-center justify-between text-xs animate-fadeIn select-none shrink-0">
                    <div className="flex items-center space-x-2 text-indigo-900 font-semibold">
                      <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                      <span>AI Recommendation Filter Active</span>
                      <span className="bg-indigo-100 text-indigo-800 text-4xs font-extrabold uppercase px-2 py-0.5 rounded-full border border-indigo-200">
                        Showing {displayedLeads.length} Matches
                      </span>
                    </div>
                    <button
                      onClick={() => setAiFilteredLeadIds(null)}
                      className="text-indigo-600 hover:text-indigo-800 font-extrabold hover:underline text-3xs uppercase tracking-wider"
                    >
                      Clear AI Filter
                    </button>
                  </div>
                )}

                <LeadsTable
                  leads={displayedLeads}
                  allFilteredIds={allFilteredIds}
                  selectedIds={selectedIds}
                  setSelectedIds={setSelectedIds}
                  onSaveToggle={handleSaveToggle}
                  onUnlockEmail={handleUnlockEmail}
                  onUnlockPhone={handleUnlockPhone}
                  onEdit={(lead) => {
                    setEditingLead(lead);
                    setIsEditOpen(true);
                  }}
                  onDelete={handleDeleteLead}
                  isAuthenticated={!!authS.user}
                  onSelectLeadForDrawer={setSelectedLeadForDrawer}
                />
              </div>
            )}

          </div>

          {/* Footer Pagination bar */}
          <div className="h-12 border-t border-[var(--border-subtle)] px-6 flex items-center justify-between bg-[var(--surface-card)] shrink-0 select-none">
            
            {/* Counts info */}
            <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest font-mono">
              {totalLeadsCount > 0 ? (
                <>
                  SHOWING <span className="text-gray-800 font-bold">{pageStartCount}-{pageEndCount}</span> OF <span className="text-gray-800 font-bold">{totalLeadsCount}</span> RESULTS
                </>
              ) : (
                'NO RESULTS TO DISPLAY'
              )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center space-x-3">
              
              <div className="flex items-center space-x-1.5">
                {/* Prev */}
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Page badges */}
                <span className="text-xs font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1">
                  {page}
                </span>

                {/* Next */}
                <button
                  disabled={totalLeadsCount === 0 || pageEndCount >= totalLeadsCount}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Per page selector */}
              <div className="relative flex items-center text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1 bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] transition-colors shadow-3xs">
                <label htmlFor="rows-per-page-select" className="sr-only">Rows per page</label>
                <select
                  id="rows-per-page-select"
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-transparent font-semibold text-[var(--text-secondary)] cursor-pointer focus:outline-none appearance-none pr-5 text-xs py-0.5"
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                  <option value={250}>250 per page</option>
                  <option value={500}>500 per page</option>
                  <option value={1000}>1000 per page</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 pointer-events-none absolute right-2" />
              </div>

            </div>

          </div>

          </div>

        </main>

        {/* AI Copilot Drawer */}
        <AICopilotDrawer
          isOpen={showAICopilot}
          onClose={() => setShowAICopilot(false)}
          selectedLeads={leads.filter(l => selectedIds.includes(l.id))}
          allLeads={getStoredLeads()}
          filterOptions={filterOptions}
          filters={filters}
          onApplyFilters={(f) => { setFilters(f); setPage(1); }}
          onApplyLeadFilter={(leadIds) => setAiFilteredLeadIds(leadIds)}
          onSelectLeadInTable={(leadId) => {
            if (!selectedIds.includes(leadId)) {
              setSelectedIds([leadId]);
            }
            showStatus(`Selected lead #${leadId} to write a personalized outreach email.`, 'success');
          }}
          onShowMessage={showStatus}
          creditBalance={creditBalance}
          setCreditBalance={setCreditBalance}
          onAddLead={handleAddLead}
          onUpdateLead={handleUpdateLead}
          onDeleteLead={executeDeleteLead}
          onSetSearchInput={(q) => {
            setSearchInput(q);
            setFilters(prev => ({ ...prev, search: q }));
            setPage(1);
          }}
          onRefreshLeads={() => {
            fetchLeads();
            fetchFilterOptions();
          }}
        />
      </div>

      {/* Modals */}
      <AddLeadModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdd={handleAddLead}
        filterOptions={filterOptions}
      />

      <EditLeadModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingLead(null);
        }}
        lead={editingLead}
        onUpdate={handleUpdateLead}
      />

      <CsvImporter
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImportLeads}
      />

      <SupabaseModal
        isOpen={isSupabaseOpen}
        onClose={() => setIsSupabaseOpen(false)}
        leads={getStoredLeads()}
        onLeadsUpdated={(updatedLeads) => {
          saveStoredLeads(updatedLeads);
          setPage(1);
          fetchLeads();
          fetchFilterOptions();
        }}
      />

      <ConfirmDeleteModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => {
          setIsConfirmDeleteOpen(false);
          setDeleteConfirmData(null);
        }}
        onConfirm={() => {
          if (deleteConfirmData) {
            if (deleteConfirmData.type === 'single') {
              executeDeleteLead(deleteConfirmData.lead);
            } else {
              executeBulkDelete();
            }
          }
        }}
        title={deleteConfirmData?.type === 'single' ? 'Delete Lead' : 'Delete Selected Leads'}
        message={
          deleteConfirmData?.type === 'single'
            ? `Are you sure you want to permanently delete the lead "${deleteConfirmData.lead.firstName} ${deleteConfirmData.lead.lastName || ''}"? This action cannot be undone.`
            : `Are you sure you want to permanently delete all ${selectedIds.length} selected leads? This action cannot be undone.`
        }
      />
      <ContactProfileDrawer
        lead={selectedLeadForDrawer}
        onClose={() => setSelectedLeadForDrawer(null)}
        onToggleSave={(id) => {
          const target = leads.find(l => l.id === id);
          if (target) handleSaveToggle(target);
        }}
        onEdit={(lead) => {
          setEditingLead(lead);
          setIsEditOpen(true);
        }}
        onUnlockEmail={handleUnlockEmail}
        onUnlockPhone={handleUnlockPhone}
        onAddToCampaign={(lead) => showStatus(`Enrolled ${lead.firstName} into active sequence!`, 'success')}
      />

      <TeammatesModal
        isOpen={showTeammatesModal}
        onClose={() => setShowTeammatesModal(false)}
        onShowMessage={showStatus}
      />

      <SavedSearchesModal
        isOpen={showSavedSearchesModal}
        onClose={() => setShowSavedSearchesModal(false)}
        onApplySearch={(f) => {
          setFilters(f);
          setPage(1);
        }}
        onShowMessage={showStatus}
      />

      <SectionInfoModal
        section={sectionModal}
        leads={getStoredLeads()}
        onClose={() => setSectionModal(null)}
        onApplyFilter={handleApplyFilterFromSection}
        onUnsave={handleSaveToggle}
      />

      <DataEnhancementModal
        isOpen={isDataEnhancementOpen}
        onClose={() => setIsDataEnhancementOpen(false)}
        leads={getStoredLeads()}
        creditBalance={creditBalance}
        onApplyEnrichment={handleApplyEnrichment}
      />

      <DuplicateLeadsModal
        isOpen={isDuplicateModalOpen}
        onClose={() => { setIsDuplicateModalOpen(false); fetchLeads(); }}
        result={lastImportResult}
        csvName={lastImportedFileName || undefined}
        onAddTag={async (email, tag) => {
          const res = await addTagToExistingLead(email, tag);
          if (!res.success) showStatus(`Couldn't add tag "${tag}": ${res.error || 'unknown error'}`, 'error');
          return res.success;
        }}
      />

    </div>
  );
}


