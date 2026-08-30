import React, { useState } from 'react';
import {
  Send,
  Mail,
  Plus,
  Play,
  Pause,
  Star,
  Search,
  SlidersHorizontal,
  ArrowDownUp,
  LayoutGrid,
  X,
  Eye,
  MoreHorizontal,
  Folder,
  Tag,
  ChevronDown,
  Trash2
} from 'lucide-react';
import { OutreachCampaign, Lead } from '../types.ts';

interface OutreachViewProps {
  leads: Lead[];
  onShowMessage: (text: string, type: 'success' | 'error') => void;
}

interface EmailTemplate {
  id: string;
  name: string;
  folder: string;
  tags: string[];
  owner: string;
  subject: string;
  body: string;
  openRate: number | null;
  replyRate: number | null;
  starred: boolean;
  createdAt: string;
}

const SEED_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Best Email Template',
    folder: 'General',
    tags: ['Cold Outreach'],
    owner: 'You',
    subject: 'Improve Your Outbound Sales',
    body: "Hey {{first_name}} - would love to be connected to stay up to date on your endeavors. Thank you.",
    openRate: null,
    replyRate: null,
    starred: false,
    createdAt: '2026-08-01',
  },
  {
    id: 'tpl-2',
    name: 'Interest Email Template 1',
    folder: 'General',
    tags: ['Warm Lead'],
    owner: 'You',
    subject: "{{company}}'s Interest in Sumware",
    body: "Hi {{first_name}}, I noticed that you requested info on our website. Do you have 15 minutes to connect {{now_weekday}}?",
    openRate: null,
    replyRate: null,
    starred: false,
    createdAt: '2026-08-05',
  },
  {
    id: 'tpl-3',
    name: 'Touchbase Template 1',
    folder: 'Follow-up',
    tags: ['Follow-up'],
    owner: 'You',
    subject: 'I would like to connect',
    body: "Hey {{first_name}} - would love to be connected to stay up to date on your endeavors! Thank you.",
    openRate: null,
    replyRate: null,
    starred: true,
    createdAt: '2026-08-10',
  },
  {
    id: 'tpl-4',
    name: 'Example for Intent Topic',
    folder: 'Intent',
    tags: ['Intent Signal'],
    owner: 'You',
    subject: 'Intent Topic Sample',
    body: "... I noticed XYZ about your company, which makes me think you might be in need of [INSERT INTENT TOPIC HERE] - wou...",
    openRate: null,
    replyRate: null,
    starred: false,
    createdAt: '2026-08-12',
  },
];

const emptyTemplate = (): EmailTemplate => ({
  id: `tpl-${Date.now()}`,
  name: '',
  folder: '',
  tags: [],
  owner: 'You',
  subject: '',
  body: '',
  openRate: null,
  replyRate: null,
  starred: false,
  createdAt: new Date().toISOString().split('T')[0],
});

export default function OutreachView({ leads, onShowMessage }: OutreachViewProps) {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'templates'>('campaigns');

  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([
    {
      id: 'camp-1',
      name: 'Q3 Enterprise CFO Outreach',
      status: 'Active',
      contactsCount: 420,
      emailsSent: 1280,
      openRate: 64.2,
      replyRate: 18.5,
      bounceRate: 0.8,
      createdAt: '2026-08-01'
    },
    {
      id: 'camp-2',
      name: 'SaaS Founders & CTOs - India',
      status: 'Active',
      contactsCount: 850,
      emailsSent: 2450,
      openRate: 71.8,
      replyRate: 22.1,
      bounceRate: 0.4,
      createdAt: '2026-08-10'
    },
    {
      id: 'camp-3',
      name: 'Local Tech Businesses Follow-up',
      status: 'Paused',
      contactsCount: 210,
      emailsSent: 420,
      openRate: 48.0,
      replyRate: 9.4,
      bounceRate: 1.2,
      createdAt: '2026-07-15'
    }
  ]);

  const [newCampName, setNewCampName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampName.trim()) return;

    const newCamp: OutreachCampaign = {
      id: `camp-${Date.now()}`,
      name: newCampName.trim(),
      status: 'Active',
      contactsCount: 0,
      emailsSent: 0,
      openRate: 0,
      replyRate: 0,
      bounceRate: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setCampaigns([newCamp, ...campaigns]);
    setNewCampName('');
    setIsCreating(false);
    onShowMessage(`Campaign "${newCamp.name}" created!`, 'success');
  };

  const toggleStatus = (id: string) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id === id) {
        const nextStatus = c.status === 'Active' ? 'Paused' : 'Active';
        onShowMessage(`Campaign status updated to ${nextStatus}`, 'success');
        return { ...c, status: nextStatus };
      }
      return c;
    }));
  };

  // --- Templates (Apollo "Engage -> Templates" pattern) ---
  const [templates, setTemplates] = useState<EmailTemplate[]>(SEED_TEMPLATES);
  const [templateSearch, setTemplateSearch] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const toggleStar = (id: string) => {
    setTemplates(prev => prev.map(t => (t.id === id ? { ...t, starred: !t.starred } : t)));
  };

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    setOpenMenuId(null);
    onShowMessage('Template deleted.', 'success');
  };

  const saveTemplate = (tpl: EmailTemplate) => {
    if (!tpl.name.trim() || !tpl.subject.trim()) {
      onShowMessage('Template name and subject are required.', 'error');
      return;
    }
    setTemplates(prev => {
      const exists = prev.some(t => t.id === tpl.id);
      return exists ? prev.map(t => (t.id === tpl.id ? tpl : t)) : [tpl, ...prev];
    });
    setEditingTemplate(null);
    onShowMessage(`Template "${tpl.name}" saved!`, 'success');
  };

  const filteredTemplates = templates.filter(t =>
    !templateSearch.trim() ||
    t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.subject.toLowerCase().includes(templateSearch.toLowerCase())
  );

  // Full-page template creator/editor — matches the reference's two-pane layout
  // (left: form fields, right: live send preview) with its own Cancel/Save top bar.
  if (editingTemplate) {
    return (
      <TemplateEditor
        template={editingTemplate}
        onChange={setEditingTemplate}
        onCancel={() => setEditingTemplate(null)}
        onSave={() => saveTemplate(editingTemplate)}
      />
    );
  }

  return (
    <div className="p-6 space-y-5 animate-fadeIn page-enter">
      {/* Underline tabs (Design.md §12) */}
      <div className="flex items-center border-b-[1.5px] border-[var(--border-subtle)]">
        {(['campaigns', 'templates'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm capitalize transition-colors cursor-pointer -mb-[1.5px] ${
              activeTab === tab
                ? 'border-b-[2.5px] border-purple-600 text-purple-600 font-bold'
                : 'border-b-[2.5px] border-transparent text-[var(--text-muted)] font-medium hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'campaigns' ? (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--surface-card)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-2xs">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 text-3xs font-extrabold bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                  OUTREACH AUTOMATION
                </span>
                <span className="text-xs text-[var(--text-muted)] font-mono">Live Campaign Engine</span>
              </div>
              <h2 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight mt-1">Multi-Channel Sales Campaigns</h2>
              <p className="text-xs text-[var(--text-muted)] font-medium">Activate email sequences, track open rates & reply analytics in real time.</p>
            </div>

            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs font-black text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Campaign</span>
            </button>
          </div>

          {/* New Campaign Form */}
          {isCreating && (
            <form onSubmit={handleCreateCampaign} className="p-5 bg-purple-50/70 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-400/20 rounded-2xl space-y-3 animate-fadeIn">
              <h3 className="text-xs font-extrabold text-[var(--text-primary)] uppercase tracking-wider">New Outreach Sequence</h3>
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newCampName}
                  onChange={(e) => setNewCampName(e.target.value)}
                  placeholder="e.g. Q4 Executive Leadership Campaign..."
                  className="flex-1 text-xs font-semibold px-4 py-2 border border-[var(--border-input)] rounded-xl bg-[var(--surface-input)] text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-extrabold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Launch Sequence
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Campaign Cards Grid */}
          <div className="space-y-4">
            {campaigns.map((camp) => (
              <div key={camp.id} className="bg-[var(--surface-card)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-2xs hover:shadow-md transition-shadow space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                      camp.status === 'Active' ? 'bg-gradient-to-tr from-purple-600 to-indigo-600' : 'bg-slate-400'
                    }`}>
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-extrabold text-[var(--text-primary)]">{camp.name}</h3>
                        <span className={`px-2.5 py-0.5 text-3xs font-extrabold rounded-full ${
                          camp.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-[var(--surface-card-header)] text-[var(--text-muted)]'
                        }`}>
                          {camp.status}
                        </span>
                      </div>
                      <span className="text-3xs text-[var(--text-muted)] font-medium block mt-0.5">Created on {camp.createdAt} • Automated Sequence</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleStatus(camp.id)}
                      className="px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)] bg-[var(--surface-card-header)] hover:bg-[var(--surface-hover)] rounded-xl transition-colors cursor-pointer flex items-center space-x-1"
                    >
                      {camp.status === 'Active' ? <Pause className="w-3.5 h-3.5 text-amber-600" /> : <Play className="w-3.5 h-3.5 text-emerald-600" />}
                      <span>{camp.status === 'Active' ? 'Pause' : 'Resume'}</span>
                    </button>
                  </div>
                </div>

                {/* Campaign Metrics Row */}
                <div className="grid grid-cols-5 gap-3 pt-2 border-t border-[var(--border-subtle)]">
                  <div className="p-3 bg-[var(--surface-card-header)] rounded-xl border border-[var(--border-subtle)]">
                    <span className="text-3xs font-bold text-[var(--text-muted)] uppercase block mb-0.5">Enrolled Leads</span>
                    <span className="text-sm font-extrabold text-[var(--text-secondary)]">{camp.contactsCount}</span>
                  </div>
                  <div className="p-3 bg-[var(--surface-card-header)] rounded-xl border border-[var(--border-subtle)]">
                    <span className="text-3xs font-bold text-[var(--text-muted)] uppercase block mb-0.5">Emails Sent</span>
                    <span className="text-sm font-extrabold text-indigo-600">{camp.emailsSent}</span>
                  </div>
                  <div className="p-3 bg-purple-50/60 dark:bg-purple-500/10 rounded-xl border border-purple-200/60 dark:border-purple-400/20">
                    <span className="text-3xs font-bold text-purple-600 uppercase block mb-0.5">Open Rate</span>
                    <span className="text-sm font-extrabold text-purple-600">{camp.openRate}%</span>
                  </div>
                  <div className="p-3 bg-emerald-50/60 dark:bg-emerald-500/10 rounded-xl border border-emerald-200/60 dark:border-emerald-400/20">
                    <span className="text-3xs font-bold text-emerald-700 dark:text-emerald-400 uppercase block mb-0.5">Reply Rate</span>
                    <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">{camp.replyRate}%</span>
                  </div>
                  <div className="p-3 bg-rose-50/60 dark:bg-rose-500/10 rounded-xl border border-rose-200/60 dark:border-rose-400/20">
                    <span className="text-3xs font-bold text-rose-700 dark:text-rose-400 uppercase block mb-0.5">Bounce Rate</span>
                    <span className="text-sm font-extrabold text-rose-700 dark:text-rose-400">{camp.bounceRate}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Templates toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-[var(--text-muted)]">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search templates..."
                  className="search-pill h-10 text-xs"
                />
              </div>
              <button className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl hover:bg-[var(--surface-hover)] cursor-pointer">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Show Filters</span>
              </button>
              <button className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl hover:bg-[var(--surface-hover)] cursor-pointer">
                <ArrowDownUp className="w-3.5 h-3.5" />
                <span>Sort</span>
              </button>
              <button className="inline-flex items-center justify-center p-2 text-[var(--text-secondary)] bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl hover:bg-[var(--surface-hover)] cursor-pointer" title="View options">
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => setEditingTemplate(emptyTemplate())}
              className="inline-flex items-center space-x-2 px-4 py-2.5 text-xs font-black text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create template</span>
            </button>
          </div>

          {/* Templates table */}
          <div className="glass-card-static overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[var(--surface-card-elevated)] border-b border-[var(--border-subtle)]">
                <tr className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Content</th>
                  <th className="py-3 px-4 w-28">Open Rate</th>
                  <th className="py-3 px-4 w-28">Reply Rate</th>
                  <th className="py-3 px-4 w-16 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredTemplates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-[var(--text-muted)]">
                      No templates match your search.
                    </td>
                  </tr>
                ) : (
                  filteredTemplates.map((tpl) => (
                    <tr key={tpl.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="py-3 px-4">
                        <button onClick={() => toggleStar(tpl.id)} className="cursor-pointer" title={tpl.starred ? 'Unstar' : 'Star'}>
                          <Star className={`w-4 h-4 ${tpl.starred ? 'fill-amber-400 text-amber-400' : 'text-[var(--text-muted)]'}`} />
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setEditingTemplate(tpl)}
                          className="text-xs font-bold text-[var(--text-primary)] hover:text-purple-600 cursor-pointer text-left"
                        >
                          {tpl.name}
                        </button>
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <p className="text-xs font-bold text-[var(--text-primary)] truncate">{tpl.subject}</p>
                        <p className="text-3xs text-[var(--text-muted)] truncate">{tpl.body}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--text-muted)]">{tpl.openRate !== null ? `${tpl.openRate}%` : '-'}</td>
                      <td className="py-3 px-4 text-xs text-[var(--text-muted)]">{tpl.replyRate !== null ? `${tpl.replyRate}%` : '-'}</td>
                      <td className="py-3 px-4 text-right relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === tpl.id ? null : tpl.id)}
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {openMenuId === tpl.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute right-4 mt-1 w-36 bg-[var(--surface-card-elevated)] border border-[var(--border-subtle)] rounded-xl shadow-xl py-1 z-45 text-left">
                              <button
                                onClick={() => { setEditingTemplate(tpl); setOpenMenuId(null); }}
                                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteTemplate(tpl.id)}
                                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer flex items-center gap-1.5"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Template editor: two-pane layout (form + live preview), matching the reference ---
function TemplateEditor({
  template,
  onChange,
  onCancel,
  onSave,
}: {
  template: EmailTemplate;
  onChange: (t: EmailTemplate) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const [tagInput, setTagInput] = useState('');
  const isNew = !template.name && !template.subject && !template.body;

  const addTag = () => {
    const clean = tagInput.trim();
    if (!clean || template.tags.includes(clean)) return;
    onChange({ ...template, tags: [...template.tags, clean] });
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    onChange({ ...template, tags: template.tags.filter(t => t !== tag) });
  };

  return (
    <div className="flex-1 flex flex-col h-full page-enter">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-card-header)] shrink-0">
        <h2 className="text-base font-extrabold text-[var(--text-primary)]">{isNew ? 'New Template' : template.name || 'Edit Template'}</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl hover:bg-[var(--surface-hover)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-md cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-6 p-6 overflow-y-auto">
        {/* Left: form */}
        <div className="glass-card-static p-5 space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Email Template
          </h3>

          <div>
            <label className="block text-3xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Name</label>
            <input
              type="text"
              value={template.name}
              onChange={(e) => onChange({ ...template, name: e.target.value })}
              placeholder="e.g. New Test Template"
              className="w-full px-3 py-2 text-xs font-semibold border border-[var(--border-input)] rounded-lg bg-[var(--surface-input)] text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-3xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Folder</label>
              <button className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface-card)] border border-[var(--border-input)] rounded-lg hover:bg-[var(--surface-hover)] cursor-pointer">
                <Folder className="w-3.5 h-3.5" />
                <span>{template.folder || 'Browse'}</span>
              </button>
            </div>
            <div>
              <label className="block text-3xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Owner</label>
              <div className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-card)] border border-[var(--border-input)] rounded-lg">
                <span>{template.owner} (You)</span>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-3xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Tags</label>
            <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 border border-[var(--border-input)] rounded-lg bg-[var(--surface-input)]">
              {template.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-3xs font-bold bg-purple-100 text-purple-700 rounded-full">
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                  <button onClick={() => removeTag(tag)} className="cursor-pointer"><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                onBlur={addTag}
                placeholder="Add tag..."
                className="flex-1 min-w-[80px] text-xs bg-transparent outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)] py-0.5"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <label className="block text-3xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Subject</label>
            <input
              type="text"
              value={template.subject}
              onChange={(e) => onChange({ ...template, subject: e.target.value })}
              placeholder="e.g. Improve Your Outbound Sales"
              className="w-full px-3 py-2 text-xs font-semibold border border-[var(--border-input)] rounded-lg bg-[var(--surface-input)] text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-3xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Body</label>
            <textarea
              rows={8}
              value={template.body}
              onChange={(e) => onChange({ ...template, body: e.target.value })}
              placeholder="Hey {{first_name}} - ..."
              className="w-full px-3 py-2 text-xs font-medium border border-[var(--border-input)] rounded-lg bg-[var(--surface-input)] text-[var(--text-primary)] focus:outline-none focus:border-purple-500 resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Right: live preview */}
        <div className="glass-card-static p-5 space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" /> Template Preview
          </h3>
          <p className="text-3xs text-[var(--text-muted)] leading-relaxed">
            This is a preview for an example contact. <span className="text-purple-600 font-semibold cursor-pointer hover:underline">Click here</span> to generate the preview for a specific contact.
          </p>

          <div className="p-4 bg-[var(--surface-card-header)] border border-[var(--border-subtle)] rounded-xl space-y-2">
            <p className="text-3xs text-[var(--text-muted)]">
              To: <span className="text-[var(--text-secondary)] font-semibold">Example Contact &lt;example@google.com&gt;</span>
            </p>
            <p className="text-3xs text-[var(--text-muted)]">
              Subject: <span className="text-[var(--text-primary)] font-bold">{template.subject || '(no subject)'}</span>
            </p>
            <div className="pt-2 border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
              {template.body
                ? template.body.replace(/\{\{first_name\}\}/g, 'Alex').replace(/\{\{company\}\}/g, 'Example Co').replace(/\{\{now_weekday\}\}/g, 'Thursday')
                : <span className="italic text-[var(--text-muted)]">Email body preview will appear here...</span>}
            </div>
          </div>

          <button className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-[var(--text-primary)] bg-amber-300 hover:bg-amber-200 rounded-lg shadow-2xs cursor-pointer">
            <Send className="w-3.5 h-3.5" />
            <span>Send Test Email to Me</span>
          </button>
          <p className="text-4xs text-[var(--text-muted)]">Tests will deliver from your default mailbox.</p>
        </div>
      </div>
    </div>
  );
}
