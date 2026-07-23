import React, { useState, useEffect, useRef } from 'react';
import { onIdTokenChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import { Lead, Filters, FilterOptions, AuthState } from './types.ts';
import { 
  getStoredLeads, 
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
  bulkImportLeads 
} from './data/leadStorage.ts';
import FiltersSidebar from './components/FiltersSidebar.tsx';
import LeadsTable from './components/LeadsTable.tsx';
import AddLeadModal from './components/AddLeadModal.tsx';
import EditLeadModal from './components/EditLeadModal.tsx';
import CsvImporter from './components/CsvImporter.tsx';
import ApolloNavigationDrawer from './components/ApolloNavigationDrawer.tsx';
import ConfirmDeleteModal from './components/ConfirmDeleteModal.tsx';
import SupabaseModal from './components/SupabaseModal.tsx';
import { AICopilotDrawer } from './components/AICopilotDrawer.tsx';
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
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Trash2,
  Unlock,
  Building,
  X,
  ChevronDown,
  Table,
  Filter,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';

export default function App() {
  // Authentication State
  const [authS, setAuthS] = useState<AuthState>({
    user: null,
    loading: true,
    token: null,
  });

  // Leads & Metadata State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [creditBalance, setCreditBalance] = useState(100); // Simulate Apollo Credit System
  const [showFiltersSidebar, setShowFiltersSidebar] = useState(true);
  const [stats, setStats] = useState({ total: 0, netNew: 0, saved: 0 });

  // AI Copilot States
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

  // General States
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
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

  // Single Contact Unlocking Actions (Apollo Credit simulation)
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
      addLead(leadData);
      fetchLeads();
      fetchFilterOptions();
      showStatus('Lead created successfully!', 'success');
      return true;
    } catch (err) {
      console.error('Create lead failed:', err);
    }
    return false;
  };

  // Update Lead Action Handler
  const handleUpdateLead = async (id: number, leadData: any) => {
    try {
      updateLead(id, leadData);
      fetchLeads();
      fetchFilterOptions();
      showStatus('Lead updated successfully!', 'success');
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
      deleteLead(lead.id);
      fetchLeads();
      fetchFilterOptions();
      setSelectedIds(prev => prev.filter(id => id !== lead.id));
      showStatus('Lead deleted successfully.', 'success');
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
      bulkDeleteLeads(selectedIds);
      fetchLeads();
      fetchFilterOptions();
      setSelectedIds([]);
      setBulkMenuOpen(false);
      showStatus('Bulk deletion complete!', 'success');
    } catch (err) {
      console.error('Bulk delete failed:', err);
      showStatus('An error occurred during bulk deletion.', 'error');
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
      const count = bulkImportLeads(items);
      fetchLeads();
      fetchFilterOptions();
      showStatus(`Imported ${count} attendee leads successfully!`, 'success');
      return true;
    } catch (err) {
      console.error('Import action failed:', err);
    }
    return false;
  };

  // CSV Bulk Export
  const handleExportCsv = () => {
    const leadsToExport = selectedIds.length > 0 
      ? leads.filter(l => selectedIds.includes(l.id))
      : leads;

    if (leadsToExport.length === 0) {
      showStatus('No leads found to export.', 'error');
      return;
    }

    const headers = [
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Organization/Company',
      'Job Title',
      'Location/City',
      'Source',
      'Approval Status',
      'Registration Time',
      'Speaker Questions'
    ];

    const rows = leadsToExport.map(l => [
      l.firstName,
      l.lastName || '',
      l.email,
      l.phone || '',
      l.organization || '',
      l.jobTitle || '',
      l.city || '',
      l.sourceName || '',
      l.approvalStatus,
      l.registrationTime || '',
      l.questions || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `apollo_leads_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showStatus(`Exported ${leadsToExport.length} leads to CSV successfully.`, 'success');
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
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 select-none">
      
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

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Apollo Left-most Collapsible Navigation Drawer */}
        <ApolloNavigationDrawer 
          onShowMessage={showStatus} 
          onAddLeadClick={() => setIsAddOpen(true)}
          onOpenSupabase={() => setIsSupabaseOpen(true)}
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
        <main className="flex-1 flex flex-col overflow-hidden bg-white">
          
          {/* Find People Heading Section (Screenshot 1) */}
          <div className="px-6 pt-5 pb-3 bg-white flex flex-col space-y-2 shrink-0 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-black tracking-tight text-neutral-950 font-display">Find Contacts</h1>
            </div>
            
            {/* Apollo Sub-toolbar row with high fidelity to Apollo's controls (Screenshot 1) */}
            <div className="flex items-center space-x-3 text-xs font-semibold text-gray-650 pt-1 select-none">
              
              {/* Default view dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setViewDropdownOpen(!viewDropdownOpen)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 bg-white shadow-3xs cursor-pointer text-gray-700 font-medium transition-colors"
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
                    <div className="absolute left-0 mt-1.5 w-56 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-45 animate-fadeIn">
                      <div className="px-3 py-1 text-4xs font-bold uppercase tracking-wider text-gray-450 border-b border-gray-100 mb-1">
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
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 border rounded-lg hover:bg-gray-50 bg-white shadow-3xs cursor-pointer text-gray-750 font-medium transition-all ${
                  !showFiltersSidebar ? 'border-indigo-200 text-indigo-700 bg-indigo-50/40' : 'border-gray-200'
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
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 bg-white shadow-3xs cursor-pointer text-gray-700 font-medium transition-colors"
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
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 border-indigo-500 text-white shadow-md shadow-indigo-150' 
                    : 'bg-white hover:bg-indigo-50/30 border-indigo-200 text-indigo-700'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${showAICopilot ? 'text-white' : 'text-indigo-600 animate-pulse'}`} />
                <span>AI Assistant</span>
                <span className="px-1.5 py-0.1 text-[9px] font-extrabold bg-indigo-100 text-indigo-750 rounded-full border border-indigo-200 scale-90">
                  New
                </span>
              </button>
              
            </div>
          </div>

          {/* Search, metrics and actions control panel */}
          <div className="p-4 border-b border-gray-200 flex flex-col space-y-3 shrink-0 bg-gray-50/20">
            
            {/* Top row controls */}
            <div className="flex items-center justify-between">
              
              {/* Search Bar */}
              <form onSubmit={handleSearchSubmit} className="flex items-center max-w-md w-full relative">
                <div className="relative w-full">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchInput(val);
                      setFilters(prev => ({ ...prev, search: val }));
                      setPage(1);
                    }}
                    placeholder="Search contacts,"
                    className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow bg-white font-medium text-gray-900 placeholder-gray-500"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="ml-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Search
                </button>
              </form>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                
                {/* Export CSV */}
                <button
                  onClick={handleExportCsv}
                  title="Export contacts to CSV"
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-all shadow-3xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-gray-500" />
                  <span>Download CSV</span>
                </button>

                {/* Import CSV */}
                <button
                  onClick={() => setIsImportOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-all shadow-3xs cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-gray-500" />
                  <span>Upload CSV</span>
                </button>

                {/* Add Contact button */}
                <button
                  onClick={() => setIsAddOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Contact</span>
                </button>

              </div>
            </div>

            {/* Bottom Row Metric Cards & Bulk Actions */}
            <div className="flex items-center justify-between pt-2">
              
              {/* Metric Cards */}
              <div className="flex items-center space-x-4">
                
                {/* TOTAL Card */}
                <button
                  onClick={() => {
                    setFilters(prev => ({ ...prev, savedOnly: false, netNewOnly: false }));
                    setPage(1);
                  }}
                  className={`w-52 h-20 rounded-2xl p-3.5 border transition-all text-left flex flex-col justify-between relative overflow-hidden cursor-pointer ${
                    !filters.savedOnly && !filters.netNewOnly
                      ? 'bg-blue-50/80 border-blue-200 shadow-3xs'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xs font-semibold text-blue-900">All Contacts</span>
                  <span className="text-xl font-bold text-gray-900 leading-none">{stats.total}</span>
                  <Users className="w-12 h-12 text-blue-200/50 absolute right-2 bottom-1 pointer-events-none" />
                </button>

                {/* NET NEW Card */}
                <button
                  onClick={() => {
                    setFilters(prev => ({ ...prev, savedOnly: false, netNewOnly: true }));
                    setPage(1);
                  }}
                  className={`w-52 h-20 rounded-2xl p-3.5 border transition-all text-left flex flex-col justify-between relative overflow-hidden cursor-pointer ${
                    filters.netNewOnly
                      ? 'bg-blue-50/80 border-blue-200 shadow-3xs'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xs font-semibold text-gray-600">New Contacts</span>
                  <span className="text-xl font-bold text-gray-900 leading-none">{stats.netNew}</span>
                  <User className="w-12 h-12 text-gray-200/50 absolute right-2 bottom-1 pointer-events-none" />
                </button>

                {/* SAVED Card */}
                <button
                  onClick={() => {
                    setFilters(prev => ({ ...prev, savedOnly: true, netNewOnly: false }));
                    setPage(1);
                  }}
                  className={`w-52 h-20 rounded-2xl p-3.5 border transition-all text-left flex flex-col justify-between relative overflow-hidden cursor-pointer ${
                    filters.savedOnly
                      ? 'bg-blue-50/80 border-blue-200 shadow-3xs'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xs font-semibold text-gray-600">Bookmarked</span>
                  <span className="text-xl font-bold text-gray-900 leading-none">{stats.saved}</span>
                  <Bookmark className="w-12 h-12 text-gray-200/50 absolute right-2 bottom-1 pointer-events-none" />
                </button>

              </div>

              {/* Bulk actions area */}
              {selectedIds.length > 0 && (
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
                      <div className="absolute right-0 bottom-full mb-1.5 w-48 bg-white border border-gray-150 rounded-xl shadow-xl py-1.5 z-40">
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
                          <span>Delete Selected</span>
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
              )}

            </div>
          </div>

          {/* Core Table View */}
          <div className="flex-1 overflow-hidden flex flex-col relative">
            
            {isLoadingLeads && (
              <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-3xs flex items-center justify-center">
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold text-gray-500 tracking-wide">Syncing Apollo lead directory...</span>
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
            />

          </div>

          {/* Footer Pagination bar */}
          <div className="h-12 border-t border-gray-200 px-6 flex items-center justify-between bg-white shrink-0 select-none">
            
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
              <div className="flex items-center space-x-1 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1 bg-white hover:bg-gray-50 cursor-pointer transition-colors">
                <span>25 per page</span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </div>

            </div>

          </div>

        </main>

        {/* AI Copilot Drawer */}
        <AICopilotDrawer
          isOpen={showAICopilot}
          onClose={() => setShowAICopilot(false)}
          selectedLeads={leads.filter(l => selectedIds.includes(l.id))}
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

      <SupabaseModal
        isOpen={isSupabaseOpen}
        onClose={() => setIsSupabaseOpen(false)}
        leads={leads}
        onLeadsUpdated={(newLeads) => {
          setLeads(newLeads);
          fetchStats();
          fetchFilterOptions();
          showStatus('Successfully updated contacts from Supabase!', 'success');
        }}
      />

    </div>
  );
}
