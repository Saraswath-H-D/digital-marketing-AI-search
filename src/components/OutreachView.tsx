import React, { useState } from 'react';
import { 
  Send, 
  Mail, 
  Phone, 
  CheckSquare, 
  Plus, 
  Play, 
  Pause, 
  BarChart2, 
  Users, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { OutreachCampaign, Lead } from '../types.ts';

interface OutreachViewProps {
  leads: Lead[];
  onShowMessage: (text: string, type: 'success' | 'error') => void;
}

export default function OutreachView({ leads, onShowMessage }: OutreachViewProps) {
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

  return (
    <div className="p-6 space-y-6 animate-fadeIn">
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
  );
}
