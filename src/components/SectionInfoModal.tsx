import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Home, Building, List, Bookmark, Users, TrendingUp, Clock, MapPin, Tag } from 'lucide-react';
import { Lead } from '../types.ts';

export type SectionModalKind = 'Home' | 'Organizations' | 'Directories' | 'Bookmarks';

interface SectionInfoModalProps {
  section: SectionModalKind | null;
  leads: Lead[];
  onClose: () => void;
  onApplyFilter: (kind: 'organization' | 'city' | 'source' | 'saved', value?: string) => void;
  onUnsave: (lead: Lead) => void;
}

const SECTION_META: Record<SectionModalKind, { icon: React.ReactNode; title: string; subtitle: string }> = {
  Home: { icon: <Home className="w-4 h-4" />, title: 'Home Overview', subtitle: 'Your directory at a glance' },
  Organizations: { icon: <Building className="w-4 h-4" />, title: 'Organizations', subtitle: 'Contacts grouped by company' },
  Directories: { icon: <List className="w-4 h-4" />, title: 'Directories', subtitle: 'Browse by city or source' },
  Bookmarks: { icon: <Bookmark className="w-4 h-4" />, title: 'Bookmarked Contacts', subtitle: 'Contacts you\'ve saved' },
};

export default function SectionInfoModal({ section, leads, onClose, onApplyFilter, onUnsave }: SectionInfoModalProps) {
  const isOpen = section !== null;

  const stats = useMemo(() => {
    const total = leads.length;
    const saved = leads.filter(l => l.isSaved).length;
    const approved = leads.filter(l => l.approvalStatus === 'approved').length;
    const pending = leads.filter(l => l.approvalStatus === 'pending').length;
    const rejected = leads.filter(l => l.approvalStatus === 'rejected').length;
    const recent = [...leads]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
    return { total, saved, approved, pending, rejected, recent };
  }, [leads]);

  const orgGroups = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach(l => {
      const org = (l.organization || '').trim();
      if (org && org !== '-') map.set(org, (map.get(org) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 25);
  }, [leads]);

  const cityGroups = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach(l => {
      const city = (l.city || '').trim();
      if (city && city !== '-') map.set(city, (map.get(city) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [leads]);

  const sourceGroups = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach(l => {
      const src = (l.sourceName || '').trim();
      if (src && src !== '-') map.set(src, (map.get(src) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [leads]);

  const savedLeads = useMemo(() => leads.filter(l => l.isSaved), [leads]);

  if (!section) return null;
  const meta = SECTION_META[section];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="w-full max-w-lg glass-modal overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
                  {meta.icon}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--text-primary)]">{meta.title}</h3>
                  <p className="text-3xs text-[var(--text-muted)] font-medium">{meta.subtitle}</p>
                </div>
              </div>
              <button onClick={onClose} className="btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {section === 'Home' && (
                <>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { label: 'Total', value: stats.total, color: 'text-indigo-600' },
                      { label: 'Saved', value: stats.saved, color: 'text-amber-600' },
                      { label: 'Approved', value: stats.approved, color: 'text-emerald-600' },
                    ].map(s => (
                      <div key={s.label} className="p-3 bg-[var(--surface-card-header)] border border-[var(--border-subtle)] rounded-xl text-center">
                        <div className={`text-lg font-extrabold ${s.color}`}>{s.value}</div>
                        <div className="text-4xs font-bold uppercase tracking-wider text-[var(--text-muted)] mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 className="text-3xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> Recently Added
                    </h4>
                    <div className="space-y-1.5">
                      {stats.recent.map(l => (
                        <div key={l.id} className="flex items-center justify-between px-3 py-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg text-xs">
                          <span className="font-semibold text-[var(--text-primary)]">{l.firstName} {l.lastName}</span>
                          <span className="text-[var(--text-muted)]">{l.organization !== '-' ? l.organization : l.jobTitle}</span>
                        </div>
                      ))}
                      {stats.recent.length === 0 && <p className="text-xs text-[var(--text-muted)] italic">No contacts yet.</p>}
                    </div>
                  </div>
                </>
              )}

              {section === 'Organizations' && (
                <div className="space-y-1.5">
                  {orgGroups.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] italic text-center py-6">No organizations found in your contacts yet.</p>
                  ) : (
                    orgGroups.map(([org, count]) => (
                      <button
                        key={org}
                        onClick={() => { onApplyFilter('organization', org); onClose(); }}
                        className="w-full flex items-center justify-between px-3 py-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-left"
                      >
                        <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{org}</span>
                        <span className="text-3xs font-bold text-[var(--text-muted)] shrink-0 ml-2">{count} contact{count !== 1 ? 's' : ''}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {section === 'Directories' && (
                <>
                  <div>
                    <h4 className="text-3xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" /> By City
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {cityGroups.length === 0 && <p className="text-xs text-[var(--text-muted)] italic">No city data yet.</p>}
                      {cityGroups.map(([city, count]) => (
                        <button
                          key={city}
                          onClick={() => { onApplyFilter('city', city); onClose(); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-3xs font-bold bg-[var(--surface-card-header)] border border-[var(--border-subtle)] rounded-full hover:bg-[var(--surface-hover)] cursor-pointer text-[var(--text-secondary)]"
                        >
                          {city} <span className="text-[var(--text-muted)]">({count})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pt-3 border-t border-[var(--border-subtle)]">
                    <h4 className="text-3xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
                      <Tag className="w-3 h-3" /> By Source
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {sourceGroups.length === 0 && <p className="text-xs text-[var(--text-muted)] italic">No source data yet.</p>}
                      {sourceGroups.map(([src, count]) => (
                        <button
                          key={src}
                          onClick={() => { onApplyFilter('source', src); onClose(); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-3xs font-bold bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-400/20 rounded-full hover:bg-purple-100 dark:hover:bg-purple-500/20 cursor-pointer text-purple-700 dark:text-purple-300"
                        >
                          {src} <span className="text-purple-400">({count})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {section === 'Bookmarks' && (
                <div className="space-y-1.5">
                  {savedLeads.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] italic text-center py-6">No saved contacts yet — bookmark a contact from the table to see it here.</p>
                  ) : (
                    savedLeads.map(l => (
                      <div key={l.id} className="flex items-center justify-between px-3 py-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">{l.firstName} {l.lastName}</p>
                          <p className="text-3xs text-[var(--text-muted)] truncate">{l.jobTitle !== '-' ? l.jobTitle : ''}{l.organization !== '-' ? ` · ${l.organization}` : ''}</p>
                        </div>
                        <button
                          onClick={() => onUnsave(l)}
                          className="shrink-0 ml-2 p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 cursor-pointer"
                          title="Remove bookmark"
                        >
                          <Bookmark className="w-3.5 h-3.5 fill-amber-400" />
                        </button>
                      </div>
                    ))
                  )}
                  {savedLeads.length > 0 && (
                    <button
                      onClick={() => { onApplyFilter('saved'); onClose(); }}
                      className="w-full mt-2 px-3 py-2 text-xs font-bold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg cursor-pointer"
                    >
                      View all {savedLeads.length} saved contacts in Contact Directory →
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
