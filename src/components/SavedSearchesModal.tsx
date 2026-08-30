import React, { useState } from 'react';
import { X, Bookmark, Search, Trash2, ArrowRight, Check } from 'lucide-react';
import { SavedSearch, Filters } from '../types.ts';

interface SavedSearchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySearch: (filters: Filters) => void;
  onShowMessage: (text: string, type: 'success' | 'error') => void;
}

export default function SavedSearchesModal({
  isOpen,
  onClose,
  onApplySearch,
  onShowMessage
}: SavedSearchesModalProps) {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([
    {
      id: 'ss-1',
      name: 'Enterprise CTOs – India',
      count: 248,
      lastUpdated: 'Today',
      createdDate: '2026-08-01',
      filters: {
        search: '',
        jobTitles: ['CTO', 'Director Engineering'],
        companies: [],
        cities: ['Bangalore', 'Chennai', 'Mumbai'],
        sources: [],
        statuses: [],
        savedOnly: false
      }
    },
    {
      id: 'ss-2',
      name: 'High Intent SaaS Leads',
      count: 512,
      lastUpdated: 'Yesterday',
      createdDate: '2026-08-12',
      filters: {
        search: '',
        jobTitles: [],
        companies: [],
        cities: [],
        sources: [],
        statuses: ['approved'],
        savedOnly: false
      }
    },
    {
      id: 'ss-3',
      name: 'Finance Decision Makers',
      count: 184,
      lastUpdated: '3 days ago',
      createdDate: '2026-07-28',
      filters: {
        search: '',
        jobTitles: ['CFO', 'Director Finance', 'VP Finance'],
        companies: [],
        cities: [],
        sources: [],
        statuses: [],
        savedOnly: false
      }
    }
  ]);

  if (!isOpen) return null;

  const handleDelete = (id: string) => {
    setSavedSearches(prev => prev.filter(s => s.id !== id));
    onShowMessage('Saved search deleted.', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="relative w-full max-w-xl bg-[var(--surface-card-elevated)] rounded-3xl shadow-2xl overflow-hidden border border-[var(--border-subtle)]" style={{ backdropFilter: 'blur(40px) saturate(180%)' }}>
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 text-amber-400 flex items-center justify-center font-black shadow-md">
              <Bookmark className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">Saved Targeting Searches</h3>
              <p className="text-2xs text-purple-200">Quickly rerun segment filters across lead directory</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List Body */}
        <div className="p-6 space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
          {savedSearches.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-6 text-center italic">No saved searches stored yet.</p>
          ) : (
            savedSearches.map((s) => (
              <div
                key={s.id}
                className="p-4 bg-[var(--surface-card-header)] border border-[var(--border-subtle)] rounded-2xl flex items-center justify-between hover:bg-indigo-50/40 hover:border-indigo-200 transition-all group"
              >
                <div>
                  <h4 className="text-xs font-extrabold text-[var(--text-primary)] group-hover:text-indigo-600">{s.name}</h4>
                  <div className="flex items-center space-x-2 text-3xs font-semibold text-[var(--text-muted)] mt-1">
                    <span className="text-indigo-600 font-bold">{s.count} Matching Contacts</span>
                    <span>•</span>
                    <span>Updated {s.lastUpdated}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete Saved Search"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      onApplySearch(s.filters);
                      onShowMessage(`Applied saved search "${s.name}"!`, 'success');
                      onClose();
                    }}
                    className="inline-flex items-center space-x-1 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Run Search</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
