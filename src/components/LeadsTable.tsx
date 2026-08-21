import React, { useState } from 'react';
import { Lead } from '../types.ts';
import { getActiveHeaders } from '../data/leadStorage.ts';
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
  selectedIds: number[];
  setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>;
  onSaveToggle: (lead: Lead) => void;
  onUnlockEmail: (lead: Lead) => void;
  onUnlockPhone: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  isAuthenticated: boolean;
}

// Generate premium company icon background colors based on name
const getCompanyColor = (name: string | null) => {
  if (!name) return 'bg-gray-100 text-gray-400';
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
  selectedIds,
  setSelectedIds,
  onSaveToggle,
  onUnlockEmail,
  onUnlockPhone,
  onEdit,
  onDelete,
  isAuthenticated,
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
      setSelectedIds(leads.map((l) => l.id));
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
    if (lead[header] !== undefined && lead[header] !== null && String(lead[header]).trim() !== '') {
      return String(lead[header]).trim();
    }
    const lower = header.toLowerCase().trim();
    const cleanLower = lower.replace(/[^a-z0-9]/g, '');

    const foundKey = Object.keys(lead).find(k => k.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === cleanLower);
    if (foundKey && lead[foundKey] !== undefined && lead[foundKey] !== null && String(lead[foundKey]).trim() !== '') {
      return String(lead[foundKey]).trim();
    }

    if (cleanLower.includes('source')) return lead.sourceName || '';
    if (cleanLower.includes('firstname') || cleanLower === 'fname' || cleanLower === 'first') return lead.firstName || '';
    if (cleanLower.includes('lastname') || cleanLower === 'lname' || cleanLower === 'last' || cleanLower === 'surname') return lead.lastName || '';
    if (cleanLower === 'name' || cleanLower === 'fullname' || cleanLower === 'contactname' || cleanLower === 'contacts' || cleanLower === 'contact' || cleanLower === 'attendee' || cleanLower.includes('attendeename')) {
      return `${lead.firstName || ''} ${lead.lastName && lead.lastName !== '-' ? lead.lastName : ''}`.trim();
    }
    if (cleanLower.includes('email') || cleanLower.includes('mail') || cleanLower.includes('gmail')) return lead.email || '';
    if (cleanLower.includes('company') || cleanLower.includes('organization') || cleanLower.includes('organisation') || cleanLower.includes('oranisation') || cleanLower.includes('org') || cleanLower.includes('firm')) return lead.organization || '';
    if (cleanLower.includes('title') || cleanLower.includes('role') || cleanLower.includes('designation') || cleanLower.includes('job')) return lead.jobTitle || '';
    if (cleanLower.includes('city') || cleanLower.includes('location') || cleanLower.includes('town')) return lead.city || '';
    if (cleanLower.includes('phone') || cleanLower.includes('mobile') || cleanLower.includes('tel')) return lead.phone || '';
    if (cleanLower.includes('status')) return lead.approvalStatus || '';

    return '';
  };

  const isAllSelected = leads.length > 0 && selectedIds.length === leads.length;

  const renderEmailCell = (lead: Lead) => {
    if (!lead.email || lead.email === '-') {
      return <span className="text-gray-400 font-medium">-</span>;
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
            className="text-gray-800 hover:text-indigo-600 font-semibold truncate max-w-[130px] transition-colors"
            title={lead.email}
          >
            {lead.email}
          </a>
          <button
            onClick={(e) => copyToClipboard(e, lead.email, lead.id, 'email')}
            title="Copy email address"
            className="p-1 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 active:scale-90 active:ring-2 active:ring-indigo-300 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer shrink-0"
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
      return <span className="text-gray-400 font-medium">-</span>;
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
            className="text-gray-800 hover:text-emerald-600 font-semibold truncate max-w-[130px] transition-colors"
            title={lead.phone}
          >
            {lead.phone}
          </a>
          <button
            onClick={(e) => copyToClipboard(e, lead.phone, lead.id, 'phone')}
            title="Copy phone number"
            className="p-1 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 active:scale-90 active:ring-2 active:ring-emerald-300 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer shrink-0"
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
    const cleanH = header.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (cleanH.includes('email') || cleanH.includes('mail') || cleanH.includes('gmail')) {
      return renderEmailCell(lead);
    }
    if (cleanH.includes('phone') || cleanH.includes('mobile') || cleanH.includes('tel') || cleanH.includes('contactnumber')) {
      return renderPhoneCell(lead);
    }
    const val = getCellValueByHeader(lead, header);
    return val || '-';
  };

  return (
    <div id="leads-table-container" className="flex-1 overflow-x-auto bg-white select-none">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        {/* Table Header */}
        <thead className="bg-gray-55/70 border-b border-gray-200 sticky top-0 z-10">
          <tr className="text-2xs font-bold text-gray-500 uppercase tracking-wider">
            {/* Checkbox */}
            <th className="py-3 px-4 w-12 text-center">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded-md text-indigo-600 border-gray-300 focus:ring-indigo-500 transition-colors cursor-pointer"
              />
            </th>

            {csvHeaders ? (
              // Dynamic headers directly from uploaded CSV
              csvHeaders.map((header) => (
                <th key={header} className="py-3.5 px-4 min-w-[160px] text-indigo-950 bg-indigo-50/90 hover:bg-indigo-100/90 border-b border-indigo-200 font-extrabold uppercase tracking-wider transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <span>{header}</span>
                    <ChevronDown className="w-3 h-3 text-indigo-400 group-hover:text-indigo-700 transition-colors" />
                  </div>
                </th>
              ))
            ) : (
              // Standard Layout headers
              <>
                <th className="py-3.5 px-4 min-w-[200px] hover:bg-slate-100/80 active:bg-slate-200 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <span>Contact Name</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                </th>
                <th className="py-3.5 px-4 min-w-[200px] hover:bg-slate-100/80 active:bg-slate-200 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <span>Designation</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                </th>
                <th className="py-3.5 px-4 min-w-[180px] hover:bg-slate-100/80 active:bg-slate-200 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <span>Organization</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                </th>
                <th className="py-3.5 px-4 min-w-[185px] hover:bg-slate-100/80 active:bg-slate-200 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <span>Email Address</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                </th>
                <th className="py-3.5 px-4 min-w-[160px] hover:bg-slate-100/80 active:bg-slate-200 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <span>Phone Number</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                </th>
                <th className="py-3.5 px-4 min-w-[140px] hover:bg-slate-100/80 active:bg-slate-200 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <span>Location</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                </th>
                <th className="py-3.5 px-4 w-28 hover:bg-slate-100/80 active:bg-slate-200 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <span>Status</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                </th>
                <th className="py-3.5 px-4 min-w-[120px] hover:bg-slate-100/80 active:bg-slate-200 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <span>Lead Source</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                </th>
                {extraKeys.map((customHeader) => (
                  <th key={customHeader} className="py-3.5 px-4 min-w-[140px] text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/70 transition-colors cursor-pointer group">
                    <div className="flex items-center justify-between">
                      <span>{customHeader.replace(/_/g, ' ')}</span>
                      <ChevronDown className="w-3 h-3 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                    </div>
                  </th>
                ))}
              </>
            )}

            {/* Actions */}
            <th className="py-3 px-4 w-32 text-right">Actions</th>
          </tr>
        </thead>


        {/* Table Body */}
        <tbody className="divide-y divide-gray-150">
          {leads.length === 0 ? (
            <tr>
              <td colSpan={10 + extraKeys.length} className="py-20 text-center">

                <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-2xl bg-blue-100/70 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-3xs">
                    <HelpCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    No contacts match your search filters.
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    Try adjusting your filters on the left panel or importing new data to populate this list.
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            leads.map((lead) => {
              const isSelected = selectedIds.includes(lead.id);
              const isExpanded = expandedRowIds.includes(lead.id);
              const initials = `${lead.firstName[0] || ''}${lead.lastName ? lead.lastName[0] : ''}`.toUpperCase();
              const companyColor = getCompanyColor(lead.organization);

              return (
                <React.Fragment key={lead.id}>
                  {/* Lead Main Row */}
                  <tr
                    className={`text-xs text-gray-700 hover:bg-indigo-50/20 transition-colors ${
                      isSelected ? 'bg-indigo-50/10' : ''
                    } ${isExpanded ? 'border-b-0 bg-gray-50/20' : ''}`}
                  >
                    {/* Checkbox column */}
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectOne(lead.id, e.target.checked)}
                        className="w-4 h-4 rounded-md text-indigo-600 border-gray-300 focus:ring-indigo-500 transition-colors cursor-pointer"
                      />
                    </td>

                    {csvHeaders ? (
                      // Render dynamic cells directly matching uploaded CSV headers
                      csvHeaders.map((header) => (
                        <td key={header} className="py-3.5 px-4 text-gray-800 font-semibold truncate max-w-[240px]">
                          {renderDynamicCell(lead, header)}
                        </td>
                      ))
                    ) : (
                      // Standard Layout cells
                      <>
                        {/* Name column */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                              {initials || <Building className="w-3.5 h-3.5" />}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 leading-snug flex items-center space-x-1.5">
                                <span className="hover:text-indigo-600 cursor-pointer transition-colors">
                                  {`${lead.firstName || ''} ${lead.lastName || ''}`.trim() || '-'}
                                </span>
                                {lead.questions && (
                                  <button
                                    onClick={() => toggleRowExpanded(lead.id)}
                                    title="Has questions to speaker"
                                    className="p-0.5 rounded-sm hover:bg-gray-100 text-amber-500 hover:text-amber-600 transition-colors"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              {lead.registrationTime && (
                                <span className="text-3xs text-gray-400 font-medium block mt-0.5">
                                  Reg: {lead.registrationTime}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Job Title column */}
                        <td className="py-3.5 px-4">
                          {lead.jobTitle ? (
                            <div className="flex items-center space-x-1.5 max-w-[190px]">
                              <Briefcase className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate text-gray-700 font-medium" title={lead.jobTitle}>
                                {lead.jobTitle}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 font-medium">-</span>
                          )}
                        </td>

                        {/* Company column */}
                        <td className="py-3.5 px-4">
                          {lead.organization ? (
                            <div className="flex items-center space-x-2">
                              <div className={`w-6 h-6 rounded-md border flex items-center justify-center text-3xs font-bold shrink-0 shadow-3xs ${companyColor}`}>
                                {lead.organization[0].toUpperCase()}
                              </div>
                              <span className="font-semibold text-gray-800 truncate max-w-[140px]" title={lead.organization}>
                                {lead.organization}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 font-medium">-</span>
                          )}
                        </td>

                        {/* Email column */}
                        <td className="py-3.5 px-4">
                          {renderEmailCell(lead)}
                        </td>

                        {/* Phone column */}
                        <td className="py-3.5 px-4">
                          {renderPhoneCell(lead)}
                        </td>

                        {/* Location column */}
                        <td className="py-3.5 px-4">
                          {lead.city ? (
                            <div className="flex items-center space-x-1 text-gray-650 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate max-w-[110px]" title={lead.city}>
                                {lead.city}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 font-medium">-</span>
                          )}
                        </td>

                        {/* Status column */}
                        <td className="py-3.5 px-4">
                          {getStatusBadge(lead.approvalStatus)}
                        </td>

                        {/* Source / CSV Tag column */}
                        <td className="py-3.5 px-4">
                          {lead.sourceName && lead.sourceName !== '-' ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/90 truncate max-w-[130px] shadow-2xs hover:scale-105 transition-transform cursor-pointer" title={`CSV Import Tag: ${lead.sourceName}`}>
                              <Tag className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                              <span>{lead.sourceName}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 font-medium">-</span>
                          )}
                        </td>

                        {/* Dynamic Custom Columns Cell Values */}
                        {extraKeys.map((customHeader) => (
                          <td key={customHeader} className="py-3.5 px-4 text-gray-700 font-medium">
                            {(lead as any)[customHeader] !== undefined && (lead as any)[customHeader] !== null
                              ? String((lead as any)[customHeader])
                              : <span className="text-gray-400 italic text-2xs">-</span>}
                          </td>
                        ))}
                      </>
                    )}

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
                                : 'text-gray-400 bg-white border-gray-200/90 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300 hover:scale-110 active:scale-90 active:ring-2 active:ring-amber-300'
                            }`}
                          >
                            {lead.isSaved ? <BookmarkCheck className="w-4 h-4 text-amber-500" /> : <Bookmark className="w-4 h-4" />}
                          </button>
                        )}
                        {/* Edit lead */}
                        <button
                          onClick={() => onEdit(lead)}
                          title="Edit Lead"
                          className="p-1.5 rounded-xl border text-gray-400 bg-white border-gray-200/90 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 hover:scale-110 active:scale-90 active:ring-2 active:ring-indigo-300 transition-all duration-200 cursor-pointer shadow-3xs"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {/* Delete lead */}
                        <button
                          onClick={() => onDelete(lead)}
                          title="Delete Lead"
                          className="p-1.5 rounded-xl border text-gray-400 bg-white border-gray-200/90 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 hover:scale-110 active:scale-90 active:ring-2 active:ring-rose-300 transition-all duration-200 cursor-pointer shadow-3xs"
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
                              : 'text-gray-400 bg-white border-gray-200/90 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 hover:scale-110 active:scale-90'
                          }`}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4 transition-transform duration-300" /> : <ChevronDown className="w-4 h-4 transition-transform duration-300" />}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Row for Speaker Questions / Details */}
                  {isExpanded && (
                    <tr className="bg-indigo-50/5/50 border-b border-gray-200">
                      <td colSpan={10} className="p-0">
                        <div className="px-16 py-4 space-y-3 text-xs text-gray-700 bg-gray-50/50">
                          {lead.questions ? (
                            <div className="bg-amber-50/40 border border-amber-100/50 p-4 rounded-xl flex items-start space-x-3 max-w-3xl shadow-3xs">
                              <MessageSquare className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold text-amber-800 block mb-1">Question to Speaker:</span>
                                <p className="text-gray-700 italic leading-relaxed font-medium">"{lead.questions}"</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-gray-400 italic">No questions requested for this registrant.</p>
                          )}
                          <div className="flex flex-wrap gap-x-8 gap-y-2 text-gray-500 mt-2 text-2xs pt-2 border-t border-gray-100">
                            <div>
                              <span className="font-semibold text-gray-400 uppercase tracking-wider block mb-0.5">Registration Time</span>
                              <span className="font-medium text-gray-750">{lead.registrationTime || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-400 uppercase tracking-wider block mb-0.5">Attendee Email</span>
                              <span className="font-medium text-gray-750">{lead.email}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-400 uppercase tracking-wider block mb-0.5">Contact Phone</span>
                              <span className="font-medium text-gray-750">{lead.phone || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-gray-400 uppercase tracking-wider block mb-0.5">Assigned ID</span>
                              <span className="font-mono text-gray-750">#LEAD-{lead.id}</span>
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
