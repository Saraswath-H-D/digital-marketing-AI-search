import React, { useState } from 'react';
import { Lead } from '../types.ts';
import { 
  X, 
  Bookmark, 
  Edit3, 
  Sparkles, 
  Send, 
  Mail, 
  Phone, 
  Building, 
  MapPin, 
  Briefcase, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Flame, 
  Clock, 
  ExternalLink, 
  Tag, 
  TrendingUp, 
  Layers, 
  Cpu, 
  DollarSign, 
  Copy, 
  Check, 
  UserCheck,
  Zap,
  Plus
} from 'lucide-react';

interface ContactProfileDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  onToggleSave: (id: number) => void;
  onEdit: (lead: Lead) => void;
  onUnlockEmail: (lead: Lead) => void;
  onUnlockPhone: (lead: Lead) => void;
  onAddToCampaign: (lead: Lead) => void;
}

export default function ContactProfileDrawer({
  lead,
  onClose,
  onToggleSave,
  onEdit,
  onUnlockEmail,
  onUnlockPhone,
  onAddToCampaign
}: ContactProfileDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'emails' | 'notes' | 'company' | 'ai'>('overview');
  const [notesText, setNotesText] = useState(lead?.notes || '');
  const [isSavedNotes, setIsSavedNotes] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [aiDraftSubject, setAiDraftSubject] = useState(`Intro: Partnership with ${lead?.organization || 'your team'}`);
  const [aiDraftBody, setAiDraftBody] = useState(
    `Hi ${lead?.firstName || 'there'},\n\nI noticed your leadership at ${lead?.organization || 'your organization'} in ${lead?.city || 'your region'}. Our AI Lead Intelligence Platform helps teams scale outreach with 99.8% verified accuracy.\n\nWould you be open to a 10-minute preview this week?\n\nBest regards,\nSales Team`
  );

  if (!lead) return null;

  const initials = `${(lead.firstName || '')[0] || 'C'}${ (lead.lastName || '')[0] || ''}`.toUpperCase();

  const handleCopy = (text: string, label: string) => {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveNotes = () => {
    setIsSavedNotes(true);
    setTimeout(() => setIsSavedNotes(false), 2000);
  };

  const getEmailStatusBadge = () => {
    const status = lead.emailStatus || (lead.email && !lead.email.includes('@imported.com') ? 'Verified' : 'Risky');
    if (status === 'Verified') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-2xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <span>Verified Email</span>
        </span>
      );
    }
    if (status === 'Risky') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-2xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3 h-3 text-amber-500" />
          <span>Risky Email</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-2xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
        <XCircle className="w-3 h-3 text-rose-500" />
        <span>Invalid Email</span>
      </span>
    );
  };

  const getIntentBadge = () => {
    const intent = lead.intent || 'High Intent';
    if (intent === 'High Intent') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-2xs font-extrabold bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-2xs">
          <Flame className="w-3 h-3 animate-pulse text-yellow-300" />
          <span>🔥 High Intent (92/100)</span>
        </span>
      );
    }
    if (intent === 'Medium Intent') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-2xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
          <TrendingUp className="w-3 h-3 text-amber-600" />
          <span>Medium Intent</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-2xs font-extrabold bg-[var(--surface-card-header)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
        <span>Low Intent</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end animate-fadeIn">
      <div 
        className="relative w-full max-w-2xl bg-[var(--surface-card)] shadow-2xl h-full flex flex-col transform transition-transform duration-300 ease-in-out border-l border-[var(--border-subtle)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header Top Bar */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50 shadow-md">
          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-1 text-3xs font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
              Enterprise Lead Profile
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">ID: #{lead.id}</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Card Header Info */}
        <div className="p-6 bg-gradient-to-b from-indigo-50/40 via-[var(--surface-card)] to-[var(--surface-card)] dark:from-indigo-500/10 border-b border-[var(--border-subtle)]">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-lg shadow-indigo-200 ring-4 ring-[var(--surface-card)]">
                  {initials}
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[var(--surface-card)] flex items-center justify-center">
                  <Check className="w-3 h-3 text-white stroke-[3]" />
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-2.5">
                  <h2 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
                    {lead.firstName !== '-' ? lead.firstName : 'Contact Record'} {lead.lastName !== '-' ? lead.lastName : ''}
                  </h2>
                  <button 
                    onClick={() => onToggleSave(lead.id)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      lead.isSaved ? 'text-amber-500 bg-amber-50' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                    }`}
                    title={lead.isSaved ? "Saved in bookmarks" : "Bookmark contact"}
                  >
                    <Bookmark className={`w-5 h-5 ${lead.isSaved ? 'fill-amber-500' : ''}`} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs font-semibold text-[var(--text-secondary)] mt-1">
                  {lead.jobTitle && (
                    <div className="flex items-center space-x-1">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{lead.jobTitle}</span>
                    </div>
                  )}
                  {lead.organization && (
                    <div className="flex items-center space-x-1">
                      <Building className="w-3.5 h-3.5 text-violet-500" />
                      <span className="text-violet-700 font-bold">{lead.organization}</span>
                    </div>
                  )}
                  {lead.city && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>{lead.city}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 mt-3">
                  {getEmailStatusBadge()}
                  {getIntentBadge()}
                </div>
              </div>
            </div>

            <button
              onClick={() => onEdit(lead)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl hover:bg-[var(--surface-hover)] transition-colors shadow-2xs cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span>Edit</span>
            </button>
          </div>

          {/* Quick Action CTA Buttons Bar */}
          <div className="grid grid-cols-4 gap-2 mt-5">
            <button
              onClick={() => onUnlockEmail(lead)}
              className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 text-2xs font-extrabold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{lead.emailUnlocked ? 'Copy Email' : 'Unlock Email'}</span>
            </button>

            <button
              onClick={() => onUnlockPhone(lead)}
              className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 text-2xs font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{lead.phoneUnlocked ? 'Copy Phone' : 'Unlock Phone'}</span>
            </button>

            <button
              onClick={() => onAddToCampaign(lead)}
              className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 text-2xs font-extrabold text-indigo-900 bg-indigo-100 hover:bg-indigo-200 border border-indigo-200 rounded-xl transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Campaign</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 text-2xs font-extrabold text-violet-900 bg-violet-100 hover:bg-violet-200 border border-violet-200 rounded-xl transition-all cursor-pointer active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-600" />
              <span>AI Insights</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-6 bg-[var(--surface-card-header)] border-b border-[var(--border-subtle)] space-x-1 shrink-0 overflow-x-auto scrollbar-none">
          {[
            { id: 'overview', label: 'Overview', icon: UserCheck },
            { id: 'activity', label: 'Activity', icon: Clock },
            { id: 'emails', label: 'Outreach & Draft', icon: Mail },
            { id: 'notes', label: 'Notes', icon: Edit3 },
            { id: 'company', label: 'Company Info', icon: Building },
            { id: 'ai', label: 'AI Score (92)', icon: Sparkles, badge: 'HOT' }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-1.5 py-3 px-3.5 text-xs font-bold border-b-2 transition-colors cursor-pointer shrink-0 ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 bg-[var(--surface-card-elevated)] shadow-2xs rounded-t-lg'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-[var(--text-muted)]'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="px-1.5 py-0.5 text-3xs font-extrabold bg-violet-600 text-white rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Contents Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin space-y-6">

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Contact Information Grid */}
              <div className="bg-[var(--surface-card-header)] border border-[var(--border-subtle)]/80 rounded-2xl p-4.5 space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-secondary)] flex items-center justify-between">
                  <span>Contact Information</span>
                  <span className="text-3xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">Verified Direct Details</span>
                </h3>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-3xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">Email Address</span>
                    <div className="flex items-center justify-between bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl px-3 py-2">
                      <span className="font-semibold text-[var(--text-secondary)] truncate">{lead.email || '-'}</span>
                      {lead.email && lead.email !== '-' && (
                        <button 
                          onClick={() => handleCopy(lead.email, 'Email')} 
                          className="text-[var(--text-muted)] hover:text-indigo-600 transition-colors p-1"
                        >
                          {copiedField === 'Email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-3xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">Direct Phone</span>
                    <div className="flex items-center justify-between bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl px-3 py-2">
                      <span className="font-semibold text-[var(--text-secondary)]">{lead.phone || '-'}</span>
                      {lead.phone && lead.phone !== '-' && (
                        <button 
                          onClick={() => handleCopy(lead.phone || '', 'Phone')} 
                          className="text-[var(--text-muted)] hover:text-emerald-600 transition-colors p-1"
                        >
                          {copiedField === 'Phone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-3xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">Seniority Level</span>
                    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 font-semibold text-[var(--text-secondary)]">
                      {lead.seniority || (lead.jobTitle?.toLowerCase().includes('ceo') || lead.jobTitle?.toLowerCase().includes('director') ? 'C-Level / Executive' : 'Manager')}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-3xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">Industry</span>
                    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 font-semibold text-[var(--text-secondary)]">
                      {lead.industry || 'Technology & SaaS'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Metadata */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 bg-violet-50/50 border border-violet-100 rounded-xl text-center">
                  <span className="text-3xs font-bold text-violet-600 uppercase tracking-wider block mb-0.5">Contact Origin</span>
                  <span className="text-xs font-extrabold text-violet-950 truncate block">#{lead.sourceName || 'CSV-Import'}</span>
                </div>

                <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl text-center">
                  <span className="text-3xs font-bold text-blue-600 uppercase tracking-wider block mb-0.5">Approval Status</span>
                  <span className="text-xs font-extrabold text-blue-950 capitalize block">{lead.approvalStatus || 'Approved'}</span>
                </div>

                <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl text-center">
                  <span className="text-3xs font-bold text-emerald-600 uppercase tracking-wider block mb-0.5">Added Date</span>
                  <span className="text-xs font-extrabold text-emerald-950 block">{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : 'Today'}</span>
                </div>
              </div>

              {/* Questions or Remarks */}
              {lead.questions && (
                <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-1.5">
                  <span className="text-3xs font-extrabold text-amber-700 uppercase tracking-wider block">Contact Notes / Inquiry</span>
                  <p className="text-xs text-amber-950 font-medium leading-relaxed">{lead.questions}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ACTIVITY */}
          {activeTab === 'activity' && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-xs font-extrabold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Audit & Interaction Timeline</h3>

              <div className="space-y-3 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border-default)]">
                <div className="relative flex items-start space-x-3 bg-[var(--surface-card)] p-3.5 border border-[var(--border-subtle)] rounded-xl shadow-2xs">
                  <div className="absolute -left-6 top-4 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[var(--surface-card)] ring-2 ring-emerald-100" />
                  <div>
                    <span className="text-xs font-bold text-[var(--text-secondary)] block">Lead Synced to PostgreSQL Database</span>
                    <span className="text-3xs text-[var(--text-muted)] block mt-0.5">{lead.createdAt || 'Just now'} • Verified Table Sync</span>
                  </div>
                </div>

                <div className="relative flex items-start space-x-3 bg-[var(--surface-card)] p-3.5 border border-[var(--border-subtle)] rounded-xl shadow-2xs">
                  <div className="absolute -left-6 top-4 w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-[var(--surface-card)] ring-2 ring-indigo-100" />
                  <div>
                    <span className="text-xs font-bold text-[var(--text-secondary)] block">AI Intent & Match Score Computed (92/100)</span>
                    <span className="text-3xs text-[var(--text-muted)] block mt-0.5">High Intent buying signals detected from SaaS company growth</span>
                  </div>
                </div>

                <div className="relative flex items-start space-x-3 bg-[var(--surface-card)] p-3.5 border border-[var(--border-subtle)] rounded-xl shadow-2xs">
                  <div className="absolute -left-6 top-4 w-3.5 h-3.5 rounded-full bg-violet-500 border-2 border-[var(--surface-card)] ring-2 ring-violet-100" />
                  <div>
                    <span className="text-xs font-bold text-[var(--text-secondary)] block">Contact Created via #{lead.sourceName || 'CSV Upload'}</span>
                    <span className="text-3xs text-[var(--text-muted)] block mt-0.5">{lead.registrationTime || 'Today'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OUTREACH & EMAILS */}
          {activeTab === 'emails' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-[var(--text-secondary)] uppercase tracking-wider">AI Sales Pitch Generator</h3>
                <span className="text-3xs font-extrabold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Tailored to {lead.organization || 'Lead'}</span>
              </div>

              <div className="space-y-3 bg-[var(--surface-card-header)] border border-[var(--border-subtle)] p-4 rounded-2xl">
                <div>
                  <label className="text-3xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Subject Line</label>
                  <input
                    type="text"
                    value={aiDraftSubject}
                    onChange={(e) => setAiDraftSubject(e.target.value)}
                    className="w-full text-xs font-bold px-3 py-2 border border-[var(--border-subtle)] rounded-xl bg-[var(--surface-card)] focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-3xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-1">Email Body</label>
                  <textarea
                    rows={6}
                    value={aiDraftBody}
                    onChange={(e) => setAiDraftBody(e.target.value)}
                    className="w-full text-xs font-medium px-3 py-2 border border-[var(--border-subtle)] rounded-xl bg-[var(--surface-card)] focus:outline-none focus:border-indigo-500 leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    onClick={() => handleCopy(`${aiDraftSubject}\n\n${aiDraftBody}`, 'Pitch')}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl hover:bg-[var(--surface-hover)] cursor-pointer"
                  >
                    {copiedField === 'Pitch' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedField === 'Pitch' ? 'Copied Pitch!' : 'Copy Pitch'}</span>
                  </button>
                  <a
                    href={`mailto:${lead.email}?subject=${encodeURIComponent(aiDraftSubject)}&body=${encodeURIComponent(aiDraftBody)}`}
                    className="inline-flex items-center space-x-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send via Mail App</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NOTES */}
          {activeTab === 'notes' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-[var(--text-secondary)] uppercase tracking-wider">Internal Team Notes</h3>
                {isSavedNotes && <span className="text-3xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">✓ Notes Saved</span>}
              </div>

              <textarea
                rows={8}
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="Add sales call notes, deal stage comments, or follow-up tasks..."
                className="w-full text-xs font-medium p-4 border border-[var(--border-subtle)] rounded-2xl bg-[var(--surface-card-header)] focus:bg-[var(--surface-card)] focus:outline-none focus:border-indigo-500"
              />

              <button
                onClick={handleSaveNotes}
                className="w-full py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-md cursor-pointer"
              >
                Save Notes
              </button>
            </div>
          )}

          {/* TAB 5: COMPANY INFO */}
          {activeTab === 'company' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 bg-gradient-to-r from-slate-900 to-violet-950 text-white rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-base font-extrabold">{lead.organization || 'Organization Account'}</h4>
                  <span className="text-2xs text-violet-200 block mt-0.5">Enterprise SaaS & Tech Business</span>
                </div>
                <span className="px-2.5 py-1 text-3xs font-extrabold bg-violet-500/30 text-violet-200 rounded-full border border-violet-400/30">501-1000 Employees</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[var(--surface-card-header)] border border-[var(--border-subtle)] rounded-xl">
                  <span className="text-3xs font-bold text-[var(--text-muted)] uppercase block mb-0.5">Estimated Revenue</span>
                  <span className="font-extrabold text-[var(--text-secondary)]">$25M – $50M</span>
                </div>
                <div className="p-3 bg-[var(--surface-card-header)] border border-[var(--border-subtle)] rounded-xl">
                  <span className="text-3xs font-bold text-[var(--text-muted)] uppercase block mb-0.5">Funding Round</span>
                  <span className="font-extrabold text-[var(--text-secondary)]">Series C ($45M Raised)</span>
                </div>
              </div>

              <div>
                <span className="text-3xs font-bold text-[var(--text-muted)] uppercase tracking-wider block mb-2">Detected Tech Stack</span>
                <div className="flex flex-wrap gap-1.5">
                  {['React', 'TypeScript', 'PostgreSQL', 'AWS', 'Salesforce', 'HubSpot', 'Snowflake', 'Stripe'].map(tech => (
                    <span key={tech} className="px-2.5 py-1 text-2xs font-extrabold bg-[var(--surface-card-header)] text-[var(--text-secondary)] rounded-lg border border-[var(--border-subtle)]">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: AI INSIGHTS */}
          {activeTab === 'ai' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 bg-gradient-to-br from-violet-900 via-indigo-900 to-slate-900 text-white rounded-2xl shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <span className="text-3xs font-extrabold uppercase tracking-wider text-violet-300 block">AI Lead Value Score</span>
                    <span className="text-3xl font-black text-white block mt-1">92 / 100</span>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-violet-500/30 border border-violet-400/40 flex items-center justify-center text-yellow-300">
                    <Zap className="w-8 h-8 fill-yellow-300" />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-violet-50/60 border border-violet-200/80 rounded-2xl space-y-3">
                <h4 className="text-xs font-extrabold text-violet-950 uppercase tracking-wider">Why This Lead is Valuable:</h4>
                <div className="space-y-2 text-xs text-violet-900">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Senior Decision Maker:</strong> Holds active purchasing authority at {lead.organization || 'company'}.</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>High Company Growth:</strong> +34% YoY headcount expansion in key departments.</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Strong Technology Match:</strong> Uses modern tech stack compatible with your platform.</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Verified Contact Info:</strong> Direct email and verified location details available.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
