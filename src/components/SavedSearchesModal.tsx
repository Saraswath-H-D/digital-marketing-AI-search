import React, { useEffect, useState } from 'react';
import { X, Bookmark, Trash2, ArrowRight, Plus, Briefcase, Layers } from 'lucide-react';
import { CustomICP, FilterOptions } from '../types.ts';
import { getStoredCustomICPs, syncCustomICPsFromSupabase, addCustomICP, deleteCustomICP } from '../data/customIcpStorage.ts';
import SearchableSelect from './SearchableSelect.tsx';

interface SavedSearchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterOptions: FilterOptions;
  onApplySearch: (icp: { jobTitles: string[]; industries: string[] }) => void;
  onShowMessage: (text: string, type: 'success' | 'error') => void;
}

// Repurposed from the old fully-mocked "Saved Searches" feature into the real Custom
// ICP feature (spec item 9): an ICP is deliberately scoped to Job Titles + Industries
// only (not an arbitrary full-filter snapshot), named, saved to Supabase, and reusable
// for future searches/campaign targeting.
export default function SavedSearchesModal({
  isOpen,
  onClose,
  filterOptions,
  onApplySearch,
  onShowMessage
}: SavedSearchesModalProps) {
  const [icps, setIcps] = useState<CustomICP[]>(getStoredCustomICPs());
  const [isSyncing, setIsSyncing] = useState(false);
  const [name, setName] = useState('');
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsSyncing(true);
    syncCustomICPsFromSupabase()
      .then(setIcps)
      .finally(() => setIsSyncing(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async (id: number) => {
    const { error } = await deleteCustomICP(id);
    setIcps(getStoredCustomICPs());
    onShowMessage(error ? `ICP removed locally, but Supabase delete failed: ${error}` : 'Custom ICP deleted.', error ? 'error' : 'success');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      onShowMessage('Give this ICP a name before saving.', 'error');
      return;
    }
    if (jobTitles.length === 0 && industries.length === 0) {
      onShowMessage('Pick at least one Job Title or Industry.', 'error');
      return;
    }
    setIsSaving(true);
    await addCustomICP({ name: name.trim(), jobTitles, industries });
    setIcps(getStoredCustomICPs());
    setName('');
    setJobTitles([]);
    setIndustries([]);
    setIsSaving(false);
    onShowMessage('Custom ICP saved!', 'success');
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
              <h3 className="text-base font-extrabold tracking-tight">Custom ICPs</h3>
              <p className="text-2xs text-violet-200">Save a Job Title + Industry combination to reuse for targeting</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {/* Create New ICP */}
          <div className="p-4 bg-[var(--surface-card-header)] border border-[var(--border-subtle)] rounded-2xl space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                ICP Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. US B2B SaaS Sales Leaders"
                className="glass-input !text-sm"
              />
            </div>

            <SearchableSelect
              multiple
              allowFreeText
              label="Job Titles"
              value={jobTitles}
              onChange={setJobTitles}
              options={filterOptions.jobTitles || []}
              placeholder="Type or search job title..."
              icon={<Briefcase className="w-4 h-4" />}
            />

            <SearchableSelect
              multiple
              allowFreeText={false}
              label="Industries"
              value={industries}
              onChange={setIndustries}
              options={filterOptions.industries || []}
              placeholder="Search industry..."
              icon={<Layers className="w-4 h-4" />}
            />

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 text-xs font-black text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save ICP'}</span>
            </button>
          </div>

          {/* Saved ICP List */}
          <div className="space-y-3">
            {isSyncing ? (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center italic">Loading saved ICPs...</p>
            ) : icps.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-6 text-center italic">No saved ICPs yet.</p>
            ) : (
              icps.map((icp) => (
                <div
                  key={icp.id}
                  className="p-4 bg-[var(--surface-card-header)] border border-[var(--border-subtle)] rounded-2xl flex items-center justify-between hover:bg-indigo-50/40 hover:border-indigo-200 transition-all group"
                >
                  <div className="min-w-0">
                    <h4 className="text-xs font-extrabold text-[var(--text-primary)] group-hover:text-indigo-600 truncate">{icp.name}</h4>
                    <div className="flex flex-wrap items-center gap-1 text-3xs font-semibold text-[var(--text-muted)] mt-1">
                      {icp.jobTitles.length > 0 && (
                        <span className="text-indigo-600 font-bold">{icp.jobTitles.length} Job Title{icp.jobTitles.length !== 1 ? 's' : ''}</span>
                      )}
                      {icp.jobTitles.length > 0 && icp.industries.length > 0 && <span>•</span>}
                      {icp.industries.length > 0 && (
                        <span className="text-emerald-600 font-bold">{icp.industries.length} Industr{icp.industries.length !== 1 ? 'ies' : 'y'}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleDelete(icp.id)}
                      className="p-2 rounded-xl text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Delete Custom ICP"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        onApplySearch({ jobTitles: icp.jobTitles, industries: icp.industries });
                        onShowMessage(`Applied ICP "${icp.name}"!`, 'success');
                        onClose();
                      }}
                      className="inline-flex items-center space-x-1 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <span>Run ICP</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
