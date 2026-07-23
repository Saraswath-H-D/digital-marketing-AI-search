import React, { useState } from 'react';
import { Lead } from '../types.ts';
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
  ChevronUp
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
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
          <CheckCircle2 className="w-3 h-3" />
          <span className="capitalize">Approved</span>
        </span>
      );
    } else if (s === 'denied') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
          <XCircle className="w-3 h-3" />
          <span className="capitalize">Denied</span>
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-amber-50 text-amber-700 border border-amber-100 animate-pulse">
          <Clock className="w-3 h-3" />
          <span className="capitalize">Pending</span>
        </span>
      );
    }
  };

  const isAllSelected = leads.length > 0 && selectedIds.length === leads.length;

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
            {/* Name & Avatar */}
            <th className="py-3 px-4 min-w-[200px]">Contact Name</th>
            {/* Job Title */}
            <th className="py-3 px-4 min-w-[200px]">Designation</th>
            {/* Company */}
            <th className="py-3 px-4 min-w-[180px]">Organization</th>
            {/* Email Contact info */}
            <th className="py-3 px-4 min-w-[185px]">Email Address</th>
            {/* Phone Contact info */}
            <th className="py-3 px-4 min-w-[160px]">Phone Number</th>
            {/* Location */}
            <th className="py-3 px-4 min-w-[140px]">Location</th>
            {/* Status */}
            <th className="py-3 px-4 w-28">Status</th>
            {/* Source */}
            <th className="py-3 px-4 min-w-[120px]">Lead Source</th>
            {/* Actions */}
            <th className="py-3 px-4 w-32 text-right">Actions</th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-gray-150">
          {leads.length === 0 ? (
            <tr>
              <td colSpan={10} className="py-20 text-center">
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

                    {/* Name column */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                          {initials || <Building className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 leading-snug flex items-center space-x-1.5">
                            <span className="hover:text-indigo-600 cursor-pointer transition-colors">
                              {lead.firstName} {lead.lastName}
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
                      <div className="flex items-center space-x-1.5 max-w-[190px]">
                        <Briefcase className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate text-gray-700 font-medium" title={lead.jobTitle || 'N/A'}>
                          {lead.jobTitle || <span className="text-gray-450 italic text-2xs">Not specified</span>}
                        </span>
                      </div>
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
                        <span className="text-gray-400 italic text-2xs">N/A</span>
                      )}
                    </td>

                    {/* Email column */}
                    <td className="py-3.5 px-4">
                      {lead.emailUnlocked || !isAuthenticated ? (
                        <div className="flex items-center space-x-1.5">
                          <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <a href={`mailto:${lead.email}`} className="text-indigo-600 hover:underline font-medium truncate max-w-[150px]">
                            {lead.email}
                          </a>
                        </div>
                      ) : (
                        <button
                          onClick={() => onUnlockEmail(lead)}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-2xs font-semibold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-100 rounded-lg transition-all"
                        >
                          <Lock className="w-3 h-3" />
                          <span>Access email</span>
                        </button>
                      )}
                    </td>

                    {/* Phone column */}
                    <td className="py-3.5 px-4">
                      {lead.phone ? (
                        lead.phoneUnlocked || !isAuthenticated ? (
                          <div className="flex items-center space-x-1.5">
                            <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="text-gray-700 font-semibold truncate">{lead.phone}</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => onUnlockPhone(lead)}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-2xs font-semibold text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-100 rounded-lg transition-all"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Access Mobile</span>
                          </button>
                        )
                      ) : (
                        <span className="text-gray-400 italic text-2xs">No phone</span>
                      )}
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
                        <span className="text-gray-400 italic text-2xs">N/A</span>
                      )}
                    </td>

                    {/* Status column */}
                    <td className="py-3.5 px-4">
                      {getStatusBadge(lead.approvalStatus)}
                    </td>

                    {/* Source column */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded-md text-2xs font-medium bg-gray-100 text-gray-600 border border-gray-150 truncate max-w-[110px]" title={lead.sourceName || 'Direct'}>
                        {lead.sourceName || 'Direct'}
                      </span>
                    </td>

                    {/* Actions column */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {/* Bookmark/Save Lead */}
                        {isAuthenticated && (
                          <button
                            onClick={() => onSaveToggle(lead)}
                            title={lead.isSaved ? 'Remove from saved leads' : 'Save lead'}
                            className={`p-1.5 rounded-lg border transition-all ${
                              lead.isSaved
                                ? 'text-amber-500 bg-amber-50 border-amber-200 hover:bg-amber-100'
                                : 'text-gray-400 bg-white border-gray-200 hover:bg-gray-50 hover:text-gray-600'
                            }`}
                          >
                            {lead.isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                          </button>
                        )}
                        {/* Edit lead */}
                        <button
                          onClick={() => onEdit(lead)}
                          title="Edit Lead"
                          className="p-1.5 rounded-lg border text-gray-400 bg-white border-gray-200 hover:bg-gray-50 hover:text-indigo-600 transition-all"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {/* Delete lead */}
                        <button
                          onClick={() => onDelete(lead)}
                          title="Delete Lead"
                          className="p-1.5 rounded-lg border text-gray-400 bg-white border-gray-200 hover:bg-gray-50 hover:text-red-600 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {/* Expand details */}
                        <button
                          onClick={() => toggleRowExpanded(lead.id)}
                          title="Show questions"
                          className={`p-1.5 rounded-lg border transition-all ${
                            isExpanded
                              ? 'text-indigo-600 bg-indigo-50 border-indigo-200'
                              : 'text-gray-400 bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
