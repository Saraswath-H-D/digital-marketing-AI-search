import React, { useEffect, useState } from 'react';
import { Building2, Upload, Plus, Trash2, Tag, Search } from 'lucide-react';
import { Company } from '../types.ts';
import { getStoredCompanies, deleteCompany, getDistinctCompanyPodTags } from '../data/companyStorage.ts';
import CompanyImporter from './CompanyImporter.tsx';
import AddCompanyModal from './AddCompanyModal.tsx';

interface CompaniesViewProps {
  onImport: (items: any[], options?: { includeDuplicates?: boolean }) => Promise<boolean>;
  onAdd: (companyData: any) => Promise<boolean>;
  onShowMessage: (text: string, type: 'success' | 'error') => void;
}

// Companies management page — reached via the sidebar's "Companies" icon (repurposed
// from the old Organizations popup, see OperonNavigationDrawer.tsx). Deliberately
// simpler than LeadsTable — Import + Add Single Company + a basic list + a Pod filter,
// not a full replica of every Contacts feature (per the approved plan).
export default function CompaniesView({ onImport, onAdd, onShowMessage }: CompaniesViewProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [podFilter, setPodFilter] = useState<string>('');

  const refresh = () => setCompanies(getStoredCompanies());

  useEffect(() => { refresh(); }, []);

  const distinctPodTags = getDistinctCompanyPodTags();

  const filtered = companies.filter(c => {
    if (podFilter && !(c.podTags || []).includes(podFilter)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return [c.name, c.domain, c.industry, c.city].some(v => (v || '').toLowerCase().includes(q));
    }
    return true;
  });

  const handleDelete = async (id: number) => {
    const { error } = await deleteCompany(id);
    refresh();
    onShowMessage(error ? `Deleted locally, but Supabase sync had an issue: ${error}` : 'Company deleted.', error ? 'error' : 'success');
  };

  return (
    <div className="flex-1 overflow-y-auto page-enter p-6 space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[var(--text-primary)] tracking-tight">Companies</h2>
            <p className="text-xs text-[var(--text-muted)] font-medium">{companies.length} total</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => setIsImporterOpen(true)} className="btn-secondary !text-xs">
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>
          <button onClick={() => setIsAddOpen(true)} className="btn-primary !text-xs">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Single Company</span>
          </button>
        </div>
      </div>

      {/* Search + Pod filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-muted)]">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="glass-input pl-9 !text-sm"
          />
        </div>
        {distinctPodTags.length > 0 && (
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-muted)]">
              <Tag className="w-4 h-4" />
            </span>
            <select
              value={podFilter}
              onChange={(e) => setPodFilter(e.target.value)}
              className="glass-select pl-9 pr-8 !text-sm appearance-none cursor-pointer"
            >
              <option value="">All Pods</option>
              {distinctPodTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--surface-card)]">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--text-muted)] font-medium">
            {companies.length === 0 ? 'No companies yet — import a CSV or add one manually.' : 'No companies match your search/filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-card-header)] text-2xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  <th className="text-left px-4 py-2.5">Name</th>
                  <th className="text-left px-4 py-2.5">Domain</th>
                  <th className="text-left px-4 py-2.5">Industry</th>
                  <th className="text-left px-4 py-2.5">Employee Size</th>
                  <th className="text-left px-4 py-2.5">Location</th>
                  <th className="text-left px-4 py-2.5">Pod</th>
                  <th className="text-right px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                    <td className="px-4 py-2.5 font-bold text-[var(--text-primary)]">{c.name}</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{c.domain || '-'}</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{c.industry || '-'}</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{c.companySize || '-'}</td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{[c.city, c.state, c.country].filter(Boolean).join(', ') || '-'}</td>
                    <td className="px-4 py-2.5">
                      {c.podTags && c.podTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.podTags.map(t => (
                            <span key={t} className="px-2 py-0.5 text-3xs font-extrabold bg-violet-100 text-violet-800 rounded-full">{t}</span>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-500 transition-colors" title="Delete Company">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CompanyImporter
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onImport={async (items, options) => {
          const success = await onImport(items, options);
          refresh();
          return success;
        }}
      />
      <AddCompanyModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdd={async (data) => {
          const success = await onAdd(data);
          refresh();
          return success;
        }}
      />
    </div>
  );
}
