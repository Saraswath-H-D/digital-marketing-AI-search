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
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-3xs font-extrabold bg-purple-100 text-purple-700 rounded-full border border-purple-200">
              OUTREACH AUTOMATION
            </span>
            <span className="text-xs text-slate-400 font-mono">Live Campaign Engine</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">Multi-Channel Sales Campaigns</h2>
          <p className="text-xs text-slate-500 font-medium">Activate email sequences, track open rates & reply analytics in real time.</p>
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
        <form onSubmit={handleCreateCampaign} className="p-5 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-3 animate-fadeIn">
          <h3 className="text-xs font-extrabold text-purple-950 uppercase tracking-wider">New Outreach Sequence</h3>
          <div className="flex space-x-3">
            <input
              type="text"
              value={newCampName}
              onChange={(e) => setNewCampName(e.target.value)}
              placeholder="e.g. Q4 Executive Leadership Campaign..."
              className="flex-1 text-xs font-semibold px-4 py-2 border border-purple-200 rounded-xl bg-white focus:outline-none focus:border-purple-500"
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
              className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Campaign Cards Grid */}
      <div className="space-y-4">
        {campaigns.map((camp) => (
          <div key={camp.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition-shadow space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                  camp.status === 'Active' ? 'bg-gradient-to-tr from-purple-600 to-indigo-600' : 'bg-slate-400'
                }`}>
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-extrabold text-slate-900">{camp.name}</h3>
                    <span className={`px-2.5 py-0.5 text-3xs font-extrabold rounded-full ${
                      camp.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {camp.status}
                    </span>
                  </div>
                  <span className="text-3xs text-slate-400 font-medium block mt-0.5">Created on {camp.createdAt} • Automated Sequence</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => toggleStatus(camp.id)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer flex items-center space-x-1"
                >
                  {camp.status === 'Active' ? <Pause className="w-3.5 h-3.5 text-amber-600" /> : <Play className="w-3.5 h-3.5 text-emerald-600" />}
                  <span>{camp.status === 'Active' ? 'Pause' : 'Resume'}</span>
                </button>
              </div>
            </div>

            {/* Campaign Metrics Row */}
            <div className="grid grid-cols-5 gap-3 pt-2 border-t border-slate-100">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
                <span className="text-3xs font-bold text-slate-400 uppercase block mb-0.5">Enrolled Leads</span>
                <span className="text-sm font-extrabold text-slate-800">{camp.contactsCount}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
                <span className="text-3xs font-bold text-slate-400 uppercase block mb-0.5">Emails Sent</span>
                <span className="text-sm font-extrabold text-indigo-700">{camp.emailsSent}</span>
              </div>
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-150">
                <span className="text-3xs font-bold text-purple-700 uppercase block mb-0.5">Open Rate</span>
                <span className="text-sm font-extrabold text-purple-900">{camp.openRate}%</span>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-150">
                <span className="text-3xs font-bold text-emerald-700 uppercase block mb-0.5">Reply Rate</span>
                <span className="text-sm font-extrabold text-emerald-900">{camp.replyRate}%</span>
              </div>
              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-150">
                <span className="text-3xs font-bold text-rose-700 uppercase block mb-0.5">Bounce Rate</span>
                <span className="text-sm font-extrabold text-rose-900">{camp.bounceRate}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
