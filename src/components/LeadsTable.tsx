import React, { useState } from 'react';
import { Lead } from '../types.ts';
import { getActiveHeaders, formatHeaderName } from '../data/leadStorage.ts';
import { 
  Check, 
  Mail, 
  Phone, 
  MapPin, 
  Building, 
  Briefcase, 
  Bookmark, 
  BookmarkCheck, 
  Eye, 
  Edit3, 
  Trash2, 
  Lock, 
  Unlock, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  HelpCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  Tag
} from 'lucide-react';

interface LeadsTableProps {
  leads: Lead[];
  allFilteredIds?: number[];
  selectedIds: number[];
  setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>;
  onSaveToggle: (lead: Lead) => void;
  onUnlockEmail: (lead: Lead) => void;
  onUnlockPhone: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  isAuthenticated: boolean;
  onSelectLeadForDrawer?: (lead: Lead) => void;
}

// Generate premium company icon background colors based on name
const getCompanyColor = (name: string | null) => {
  if (!name) return 'bg-[var(--surface-card-header)] text-[var(--text-muted)]';
  const charCode = name.charCodeAt(0) || 0;
  const colors = [
    'bg-blue-50 text-blue-600 border-blue-100',
    'bg-indigo-50 text-indigo-600 border-indigo-100',
    'bg-violet-50 text-violet-600 border-violet-100',
    'bg-purple-50 text-purple-600 border-purple-100',
    'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100',
    'bg-emerald-50 text-emerald-600 border-emerald-100',
    'bg-teal-50 text-teal-600 border-teal-100',
    'bg-amber-50 text-amber-600 border-amber-100',
    'bg-rose-50 text-rose-600 border-rose-100',
  ];
  return colors[charCode % colors.length];
};

export default function LeadsTable({
  leads,
  allFilteredIds,
  selectedIds,
  setSelectedIds,
  onSaveToggle,
  onUnlockEmail,
  onUnlockPhone,
  onEdit,
  onDelete,
  isAuthenticated,
  onSelectLeadForDrawer,
}: LeadsTableProps) {
  // Expanded rows state for questions/details
  const [expandedRowIds, setExpandedRowIds] = useState<number[]>([]);
  const [revealedEmailIds, setRevealedEmailIds] = useState<number[]>([]);
  const [revealedPhoneIds, setRevealedPhoneIds] = useState<number[]>([]);
  const [copiedStatus, setCopiedStatus] = useState<{ id: number; field: 'email' | 'phone' } | null>(null);

  const copyToClipboard = (e: React.MouseEvent, text: string, id: number, field: 'email' | 'phone') => {
    e.stopPropagation();
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text);
    setCopiedStatus({ id, field });
    setTimeout(() => setCopiedStatus(null), 2000);
  };

  const handleAccessEmail = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setRevealedEmailIds(prev => [...prev, lead.id]);
    onUnlockEmail(lead);
    if (lead.email && lead.email !== '-') {
      window.location.href = `mailto:${lead.email}`;
    }
  };

  const handleAccessPhone = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setRevealedPhoneIds(prev => [...prev, lead.id]);
    onUnlockPhone(lead);
    if (lead.phone && lead.phone !== '-') {
      window.location.href = `tel:${lead.phone}`;
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      if (allFilteredIds && allFilteredIds.length > 0) {
        setSelectedIds(allFilteredIds);
      } else {
        setSelectedIds(leads.map((l) => l.id));
      }
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    );
  };

  const toggleRowExpanded = (id: number) => {
    setExpandedRowIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const getStatusBadge = (status: string | null) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'approved') {
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-2xs font-extrabold bg-emerald-50/90 text-emerald-800 border border-emerald-200/90 shadow-3xs">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="capitalize">Approved</span>
        </span>
      );
    } else if (s === 'denied' || s === 'rejected') {
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-2xs font-extrabold bg-rose-50/90 text-rose-800 border border-rose-200/90 shadow-3xs">
          <XCircle className="w-3 h-3 text-rose-500 shrink-0" />
          <span className="capitalize">Denied</span>
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-2xs font-extrabold bg-amber-50/90 text-amber-800 border border-amber-200/90 shadow-3xs">
          <Clock className="w-3 h-3 text-amber-500 shrink-0 animate-spin" />
          <span className="capitalize">Pending</span>
        </span>
      );
    }
  };

  // Extract exact CSV headers if available
  const csvHeaders = React.useMemo(() => {
    const saved = getActiveHeaders();
    if (saved && Array.isArray(saved) && saved.length > 0) {
      return saved;
    }
    if (leads && leads.length > 0) {
      const sample = leads.find(l => (l as any)._csvHeaders && Array.isArray((l as any)._csvHeaders) && (l as any)._csvHeaders.length > 0);
      if (sample) {
        return (sample as any)._csvHeaders as string[];
      }
    }
    return null;
  }, [leads]);


  const extraKeys = React.useMemo(() => {
    const standardKeys = new Set([
      'id', 'firstName', 'lastName', 'email', 'phone', 'organization',
      'jobTitle', 'city', 'approvalStatus', 'sourceName', 'registrationTime',
      'questions', 'createdAt', 'isSaved', 'emailUnlocked', 'phoneUnlocked',
      '_csvHeaders', 'first_name', 'last_name', 'registration_time', 'approval_status',
      'job_title', 'source_name', 'created_at'
    ]);
    
    const keysSet = new Set<string>();
    leads.forEach(l => {
      Object.keys(l).forEach(k => {
        if (!standardKeys.has(k) && !k.startsWith('_')) {
          keysSet.add(k);
        }
      });
    });
    return Array.from(keysSet);
  }, [leads]);

  const getCellValueByHeader = (lead: any, header: string) => {
    // 1. Direct match on exact header string key
    if (lead[header] !== undefined && lead[header] !== null) {
      const val = String(lead[header]).trim();
      if (val !== '' && val !== 'undefined' && val !== 'null' && val !== '-') {
        return val;
      }
    }

    // 2. Case-insensitive / trimmed match on exact keys of this lead row object
    const lower = header.toLowerCase().trim();
    const cleanLower = lower.replace(/[^a-z0-9]/g, '');

    const foundKey = Object.keys(lead).find(k => k.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === cleanLower);
    if (foundKey && lead[foundKey] !== undefined && lead[foundKey] !== null) {
      const val = String(lead[foundKey]).trim();
      if (val !== '' && val !== 'undefined' && val !== 'null' && val !== '-') {
        return val;
      }
    }

    // STRICT: Never substitute data from other columns if this cell is missing in Excel!
    return '';
  };

  const isAllSelected = leads.length > 0 && selectedIds.length === leads.length;

  const renderEmailCell = (lead: Lead) => {
    if (!lead.email || lead.email === '-') {
      return <span className="text-[var(--text-muted)] font-medium">-</span>;
    }
    const isRevealed = revealedEmailIds.includes(lead.id) || lead.emailUnlocked;
    if (isRevealed) {
      return (
        <div className="flex items-center space-x-1.5 group animate-fadeIn">
          <div className="w-5 h-5 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
            <Mail className="w-3 h-3" />
          </div>
          <a
            href={`mailto:${lead.email}`}
            className="text-[var(--text-secondary)] hover:text-indigo-600 font-semibold truncate max-w-[130px] transition-colors"
            title={lead.email}
          >
            {lead.email}
          </a>
          <button
            onClick={(e) => copyToClipboard(e, lead.email, lead.id, 'email')}
            title="Copy email address"
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-indigo-600 hover:bg-indigo-50 active:scale-90 active:ring-2 active:ring-indigo-300 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer shrink-0"
          >
            {copiedStatus?.id === lead.id && copiedStatus?.field === 'email' ? (
              <Check className="w-3 h-3 text-indigo-600 animate-bounce" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={(e) => handleAccessEmail(e, lead)}
        className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-2xs font-extrabold text-indigo-700 bg-indigo-50/90 hover:bg-indigo-600 hover:text-white border border-indigo-200/80 rounded-xl shadow-2xs transition-all duration-200 hover:scale-105 active:scale-95 active:ring-2 active:ring-indigo-400 cursor-pointer group hover:shadow-glow-indigo"
        title="Click to access and send email"
      >
        <Lock className="w-3 h-3 text-indigo-500 group-hover:text-white group-hover:rotate-12 transition-transform" />
        <span>Access Email</span>
      </button>
    );
  };

  const renderPhoneCell = (lead: Lead) => {
    if (!lead.phone || lead.phone === '-') {
      return <span className="text-[var(--text-muted)] font-medium">-</span>;
    }
    const isRevealed = revealedPhoneIds.includes(lead.id) || lead.phoneUnlocked;
    if (isRevealed) {
      return (
        <div className="flex items-center space-x-1.5 group animate-fadeIn">
          <div className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
            <Phone className="w-3 h-3" />
          </div>
          <a
            href={`tel:${lead.phone}`}
            className="text-[var(--text-secondary)] hover:text-emerald-600 font-semibold truncate max-w-[130px] transition-colors"
            title={lead.phone}
          >
            {lead.phone}
          </a>
          <button
            onClick={(e) => copyToClipboard(e, lead.phone, lead.id, 'phone')}
            title="Copy phone number"
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-emerald-600 hover:bg-emerald-50 active:scale-90 active:ring-2 active:ring-emerald-300 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer shrink-0"
          >
            {copiedStatus?.id === lead.id && copiedStatus?.field === 'phone' ? (
              <Check className="w-3 h-3 text-emerald-600 animate-bounce" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={(e) => handleAccessPhone(e, lead)}
        className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-2xs font-extrabold text-emerald-700 bg-emerald-50/90 hover:bg-emerald-600 hover:text-white border border-emerald-200/80 rounded-xl shadow-2xs transition-all duration-200 hover:scale-105 active:scale-95 active:ring-2 active:ring-emerald-400 cursor-pointer group hover:shadow-glow-emerald"
        title="Click to access and call number"
      >
        <Lock className="w-3 h-3 text-emerald-500 group-hover:text-white group-hover:rotate-12 transition-transform" />
        <span>Access Mobile</span>
      </button>
    );
  };

  const renderDynamicCell = (lead: Lead, header: string) => {
    const val = getCellValueByHeader(lead, header);
    const isBlank = !val || val === '' || val === '-' || val === 'undefined' || val === 'null' || val === 'Contact';
    
    if (isBlank) {
      return <span className="text-[var(--text-muted)] font-bold text-xs select-none">-</span>;
    }
    
    return <span className="text-[var(--text-secondary)] font-medium text-xs truncate max-w-[280px] inline-block">{val}</span>;
  };

  return (
    <div id="leads-table-container" className="flex-1 overflow-x-auto glass-card-static select-none m-2">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        {/* Table Header */}
        <thead className="bg-[var(--surface-card-elevated)] border-b border-[var(--border-subtle)] sticky top-0 z-10">
          <tr className="micro-label py-3 text-[var(--text-primary)] font-black uppercase tracking-widest text-[11px]">
            {/* Checkbox */}
            <th className="py-3.5 px-4 w-12 text-center border-r border-[var(--border-subtle)]">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded text-indigo-600 border-[var(--border-input)] focus:ring-indigo-500 transition-colors cursor-pointer accent-indigo-600"
              />
            </th>
            <th className="py-3.5 px-4 min-w-[140px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">First Name</th>
            <th className="py-3.5 px-4 min-w-[140px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">Last Name</th>
            <th className="py-3.5 px-4 min-w-[185px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">Email</th>
            <th className="py-3.5 px-4 min-w-[160px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">Phone Number</th>
            <th className="py-3.5 px-4 min-w-[160px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">Job Title</th>
            <th className="py-3.5 px-4 min-w-[160px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">Company Name</th>
            <th className="py-3.5 px-4 min-w-[130px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">City</th>
            <th className="py-3.5 px-4 min-w-[120px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">State</th>
            <th className="py-3.5 px-4 min-w-[120px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">Country</th>
            <th className="py-3.5 px-4 min-w-[130px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">Source</th>
            <th className="py-3.5 px-4 min-w-[130px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">Email Status</th>
            <th className="py-3.5 px-4 min-w-[130px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">Seniority</th>
            <th className="py-3.5 px-4 min-w-[130px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">Department</th>
            <th className="py-3.5 px-4 min-w-[140px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">Industry</th>
            <th className="py-3.5 px-4 min-w-[140px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">Employee Size</th>
            <th className="py-3.5 px-4 min-w-[160px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">Person Linkedin Url</th>
            <th className="py-3.5 px-4 min-w-[140px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">Website</th>
            <th className="py-3.5 px-4 min-w-[170px] border-r border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer">Company Linkedin Url</th>
            <th className="py-3.5 px-4 w-32 text-right bg-[var(--surface-card-elevated)] text-[var(--text-primary)] font-black">Actions</th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {leads.length === 0 ? (
            <tr>
              <td colSpan={19} className="py-20 text-center">
                <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-blue-100/70 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-3xs">
                    <HelpCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                    No contacts match your search filters.
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                    Try adjusting your filters on the left panel or importing new data to populate this list.
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            leads.map((lead) => {
              const isSelected = selectedIds.includes(lead.id);
              const isExpanded = expandedRowIds.includes(lead.id);
              const companyColor = getCompanyColor(lead.organization);

              return (
                <React.Fragment key={lead.id}>
                  {/* Lead Main Row */}
                  <tr
                    className={`text-xs text-[var(--text-secondary)] hover:bg-indigo-50/20 transition-colors ${
                      isSelected ? 'bg-indigo-50/10' : ''
                    } ${isExpanded ? 'border-b-0 bg-[var(--surface-hover)]' : ''}`}
                  >
                    {/* Checkbox column */}
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectOne(lead.id, e.target.checked)}
                        className="w-4 h-4 rounded-md text-indigo-600 border-[var(--border-input)] focus:ring-indigo-500 transition-colors cursor-pointer"
                      />
                    </td>

                    {/* 1. First Name */}
                    <td className="py-3.5 px-4 font-semibold text-[var(--text-primary)]">
                      {lead.firstName && lead.firstName !== '-' ? lead.firstName : '-'}
                    </td>

                    {/* 2. Last Name */}
                    <td className="py-3.5 px-4 font-semibold text-[var(--text-primary)]">
                      {lead.lastName && lead.lastName !== '-' ? lead.lastName : '-'}
                    </td>

                    {/* 3. Email */}
                    <td className="py-3.5 px-4">
                      {renderEmailCell(lead)}
                    </td>

                    {/* 4. Phone Number */}
                    <td className="py-3.5 px-4">
                      {renderPhoneCell(lead)}
                    </td>

                    {/* 5. Job Title */}
                    <td className="py-3.5 px-4 font-medium text-[var(--text-secondary)]">
                      {lead.jobTitle && lead.jobTitle !== '-' ? (
                        <div className="flex items-center space-x-1.5 max-w-[190px]">
                          <Briefcase className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                          <span className="truncate" title={lead.jobTitle}>
                            {lead.jobTitle}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)] font-medium">-</span>
                      )}
                    </td>

                    {/* 6. Company Name */}
                    <td className="py-3.5 px-4 font-semibold">
                      {lead.organization && lead.organization !== '-' ? (
                        <div className="flex items-center space-x-2">
                          <div className={`w-6 h-6 rounded-md border flex items-center justify-center text-3xs font-bold shrink-0 shadow-3xs ${companyColor}`}>
                            {lead.organization[0].toUpperCase()}
                          </div>
                          <span className="font-semibold text-[var(--text-secondary)] truncate max-w-[140px]" title={lead.organization}>
                            {lead.organization}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)] font-medium">-</span>
                      )}
                    </td>

                    {/* 7. City */}
                    <td className="py-3.5 px-4 font-medium text-[var(--text-secondary)]">
                      {lead.city && lead.city !== '-' ? (
                        <div className="flex items-center space-x-1 text-[var(--text-secondary)]">
                          <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                          <span className="truncate max-w-[130px]" title={lead.city}>
                            {lead.city}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)] font-medium">-</span>
                      )}
                    </td>

                    {/* 8. State */}
                    <td className="py-3.5 px-4 font-medium text-[var(--text-secondary)]">
                      {lead.state && lead.state !== '-' ? (
                        <span className="truncate max-w-[110px] inline-block">{lead.state}</span>
                      ) : (
                        <span className="text-[var(--text-muted)] font-medium">-</span>
                      )}
                    </td>

                    {/* 9. Country */}
                    <td className="py-3.5 px-4 font-medium text-[var(--text-secondary)]">
                      {lead.country && lead.country !== '-' ? (
                        <span className="truncate max-w-[110px] inline-block">{lead.country}</span>
                      ) : (
                        <span className="text-[var(--text-muted)] font-medium">-</span>
                      )}
                    </td>

                    {/* 10. Source */}
                    <td className="py-3.5 px-4 font-medium text-[var(--text-secondary)]">
                      {lead.sourceName && lead.sourceName !== '-' ? (
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-bold">
                          {lead.sourceName}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] font-medium">-</span>
                      )}
                    </td>

                    {/* 11. Email Status */}
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                        {lead.emailStatus || 'Verified'}
                      </span>
                    </td>

                    {/* 12. Seniority */}
                    <td className="py-3.5 px-4 font-medium text-[var(--text-secondary)]">
                      {lead.seniority && lead.seniority !== '-' ? (
                        <span className="px-2 py-0.5 rounded-md bg-[var(--surface-card-header)] text-[var(--text-secondary)] border border-[var(--border-subtle)] text-[11px] font-semibold">
                          {lead.seniority}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] font-medium">-</span>
                      )}
                    </td>

                    {/* 13. Department */}
                    <td className="py-3.5 px-4 font-medium text-[var(--text-secondary)]">
                      {lead.department && lead.department !== '-' ? (
                        <span className="truncate max-w-[120px] inline-block">{lead.department}</span>
                      ) : (
                        <span className="text-[var(--text-muted)] font-medium">-</span>
                      )}
                    </td>

                    {/* 14. Industry */}
                    <td className="py-3.5 px-4 font-medium text-[var(--text-secondary)]">
                      {lead.industry && lead.industry !== '-' ? (
                        <span className="truncate max-w-[130px] inline-block">{lead.industry}</span>
                      ) : (
                        <span className="text-[var(--text-muted)] font-medium">-</span>
                      )}
                    </td>

                    {/* 15. Employee Size */}
                    <td className="py-3.5 px-4 font-medium text-[var(--text-secondary)]">
                      {lead.companySize && lead.companySize !== '-' ? (
                        <span className="truncate max-w-[130px] inline-block">{lead.companySize}</span>
                      ) : (
                        <span className="text-[var(--text-muted)] font-medium">-</span>
                      )}
                    </td>

                    {/* 16. Person Linkedin Url */}
                    <td className="py-3.5 px-4 font-medium">
                      {lead.linkedinUrl && lead.linkedinUrl !== '-' ? (
                        <a
                          href={lead.linkedinUrl.startsWith('http') ? lead.linkedinUrl : `https://${lead.linkedinUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200 font-bold hover:bg-blue-100 transition-colors text-[10px]"
                        >
                          LinkedIn
                        </a>
                      ) : (
                        <span className="text-[var(--text-muted)] font-medium">-</span>
                      )}
                    </td>

                    {/* 17. Website */}
                    <td className="py-3.5 px-4 font-medium">
                      {lead.website && lead.website !== '-' ? (
                        <a
                          href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 rounded-md bg-[var(--surface-card-header)] text-[var(--text-secondary)] border border-[var(--border-subtle)] font-bold hover:bg-[var(--surface-hover)] transition-colors text-[10px]"
                        >
                          Website
                        </a>
                      ) : (
                        <span className="text-[var(--text-muted)] font-medium">-</span>
                      )}
                    </td>

                    {/* 18. Company Linkedin Url */}
                    <td className="py-3.5 px-4 font-medium">
                      {lead.companyLinkedinUrl && lead.companyLinkedinUrl !== '-' ? (
                        <a
                          href={lead.companyLinkedinUrl.startsWith('http') ? lead.companyLinkedinUrl : `https://${lead.companyLinkedinUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-200 font-bold hover:bg-indigo-100 transition-colors text-[10px]"
                        >
                          Company LinkedIn
                        </a>
                      ) : (
                        <span className="text-[var(--text-muted)] font-medium">-</span>
                      )}
                    </td>

                    {/* Actions column */}
                    <td className="py-3.5 px-4 text-right">


                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Bookmark/Save Lead */}
                        {isAuthenticated && (
                          <button
                            onClick={() => onSaveToggle(lead)}
                            title={lead.isSaved ? 'Remove from saved leads' : 'Save lead'}
                            className={`p-1.5 rounded-xl border transition-all duration-200 cursor-pointer shadow-3xs ${
                              lead.isSaved
                                ? 'text-amber-600 bg-amber-50 border-amber-300 shadow-2xs hover:scale-110 active:scale-95 ring-2 ring-amber-400/40 animate-pulseSlow'
                                : 'text-[var(--text-muted)] bg-[var(--surface-card)] border-[var(--border-subtle)] hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300 hover:scale-110 active:scale-90 active:ring-2 active:ring-amber-300'
                            }`}
                          >
                            {lead.isSaved ? <BookmarkCheck className="w-4 h-4 text-amber-500" /> : <Bookmark className="w-4 h-4" />}
                          </button>
                        )}
                        {/* View Lead Profile Drawer */}
                        {onSelectLeadForDrawer && (
                          <button
                            onClick={() => onSelectLeadForDrawer(lead)}
                            title="View Full Profile Drawer"
                            className="p-1.5 rounded-xl border text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-600 hover:text-white hover:scale-110 active:scale-90 transition-all duration-200 cursor-pointer shadow-3xs"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {/* Edit lead */}
                        <button
                          onClick={() => onEdit(lead)}
                          title="Edit Lead"
                          className="p-1.5 rounded-xl border text-[var(--text-muted)] bg-[var(--surface-card)] border-[var(--border-subtle)] hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 hover:scale-110 active:scale-90 active:ring-2 active:ring-indigo-300 transition-all duration-200 cursor-pointer shadow-3xs"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {/* Delete lead */}
                        <button
                          onClick={() => onDelete(lead)}
                          title="Delete Lead"
                          className="p-1.5 rounded-xl border text-[var(--text-muted)] bg-[var(--surface-card)] border-[var(--border-subtle)] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 hover:scale-110 active:scale-90 active:ring-2 active:ring-rose-300 transition-all duration-200 cursor-pointer shadow-3xs"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {/* Expand details */}
                        <button
                          onClick={() => toggleRowExpanded(lead.id)}
                          title="Show questions & details"
                          className={`p-1.5 rounded-xl border transition-all duration-200 cursor-pointer shadow-3xs ${
                            isExpanded
                              ? 'text-indigo-600 bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200 scale-105'
                              : 'text-[var(--text-muted)] bg-[var(--surface-card)] border-[var(--border-subtle)] hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 hover:scale-110 active:scale-90'
                          }`}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4 transition-transform duration-300" /> : <ChevronDown className="w-4 h-4 transition-transform duration-300" />}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Row for Speaker Questions / Details */}
                  {isExpanded && (
                    <tr className="bg-[var(--surface-card-header)] border-b border-[var(--border-subtle)]">
                      <td colSpan={16} className="p-0">
                        <div className="px-16 py-4 space-y-3 text-xs text-[var(--text-secondary)] bg-[var(--surface-card-header)]">
                          {lead.questions ? (
                            <div className="bg-amber-50/40 border border-amber-100/50 p-4 rounded-xl flex items-start space-x-3 max-w-3xl shadow-3xs">
                              <MessageSquare className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold text-amber-800 block mb-1">Question to Speaker:</span>
                                <p className="text-[var(--text-secondary)] italic leading-relaxed font-medium">"{lead.questions}"</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[var(--text-muted)] italic">No questions requested for this registrant.</p>
                          )}
                          <div className="flex flex-wrap gap-x-8 gap-y-2 text-[var(--text-muted)] mt-2 text-2xs pt-2 border-t border-[var(--border-subtle)]">
                            <div>
                              <span className="font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-0.5">Registration Time</span>
                              <span className="font-medium text-[var(--text-secondary)]">{lead.registrationTime || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-0.5">Attendee Email</span>
                              <span className="font-medium text-[var(--text-secondary)]">{lead.email}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-0.5">Contact Phone</span>
                              <span className="font-medium text-[var(--text-secondary)]">{lead.phone || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-0.5">Assigned ID</span>
                              <span className="font-mono text-[var(--text-secondary)]">#LEAD-{lead.id}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
