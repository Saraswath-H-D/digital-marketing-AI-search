import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, X, CheckCircle2, Loader2, Tag } from 'lucide-react';
import { BulkImportResult } from '../data/leadStorage.ts';

interface DuplicateLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: BulkImportResult | null;
  csvName?: string;
  /** Called once per accepted tag conflict: (email, newTag) => Promise<success>. */
  onAddTag: (email: string, tag: string) => Promise<boolean>;
}

// Mandatory popup — shown only when duplicatesSkipped > 0. Lists every exact-duplicate
// lead the import corrected to one record, and — only if at least one duplicate's tag
// genuinely differs from the existing lead's tag — asks a single consolidated question
// about adding those new tags, rather than one popup per lead.
export default function DuplicateLeadsModal({ isOpen, onClose, result, csvName, onAddTag }: DuplicateLeadsModalProps) {
  const [resolution, setResolution] = useState<'pending' | 'applying' | 'done'>('pending');

  if (!result || result.duplicatesSkipped === 0) return null;

  const hasConflicts = result.tagConflicts.length > 0;

  const applyTagDecision = async (accept: boolean) => {
    if (!accept) {
      setResolution('done');
      return;
    }
    setResolution('applying');
    // De-dupe by (email, tag) — a lead can appear in tagConflicts more than once if
    // several duplicate rows in the batch shared the same new tag.
    const seen = new Set<string>();
    for (const conflict of result.tagConflicts) {
      if (!conflict.existing.email || !conflict.newTag) continue;
      const key = `${conflict.existing.email}::${conflict.newTag}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await onAddTag(conflict.existing.email, conflict.newTag);
    }
    setResolution('done');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="w-full max-w-lg glass-modal overflow-hidden my-6 flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-50 via-orange-50/50 to-transparent dark:from-amber-500/10 dark:via-transparent dark:to-transparent border-b border-[var(--border-subtle)] shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
                  <Copy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight">Duplicate Leads Found</h3>
                  {csvName && <p className="text-2xs text-[var(--text-muted)] font-medium">{csvName}</p>}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                I found exact duplicates of these leads and corrected them to one lead:
              </p>

              <div className="max-h-40 overflow-y-auto border border-[var(--border-subtle)] rounded-xl divide-y divide-[var(--border-subtle)]">
                {result.duplicateLeadNames.map((name) => (
                  <div key={name} className="px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">{name}</span>
                  </div>
                ))}
              </div>

              <p className="text-3xs text-[var(--text-muted)] font-medium">
                {result.duplicatesSkipped} duplicate cop{result.duplicatesSkipped === 1 ? 'y was' : 'ies were'} skipped and not added to Supabase.
              </p>

              {hasConflicts && (
                <div className="p-3.5 bg-violet-50/70 dark:bg-violet-500/10 border border-violet-200/70 dark:border-violet-400/20 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-[var(--text-primary)] flex items-center space-x-1.5">
                    <Tag className="w-3.5 h-3.5 text-violet-600" />
                    <span>Some of these leads have different tags. Would you like to add the new tags to the existing leads?</span>
                  </p>

                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {result.tagConflicts.map((c, idx) => (
                      <div key={idx} className="flex items-center justify-between text-2xs px-2.5 py-1.5 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg">
                        <span className="font-bold text-[var(--text-primary)] truncate">{c.leadName}</span>
                        <span className="text-[var(--text-muted)] font-medium shrink-0 ml-2">
                          {c.existing.tagName || '(no tag)'} <span className="text-violet-500">→</span> {c.newTag}
                        </span>
                      </div>
                    ))}
                  </div>

                  {resolution === 'pending' && (
                    <div className="flex items-center space-x-2">
                      <button onClick={() => applyTagDecision(true)} className="btn-primary !text-xs !py-1.5 flex-1">
                        Add New Tags
                      </button>
                      <button onClick={() => applyTagDecision(false)} className="btn-secondary !text-xs !py-1.5 flex-1">
                        Don't Add
                      </button>
                    </div>
                  )}
                  {resolution === 'applying' && (
                    <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-violet-600 py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Adding tags…</span>
                    </div>
                  )}
                  {resolution === 'done' && (
                    <div className="flex items-center space-x-1.5 text-2xs font-bold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Tag decision applied.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--surface-card-header)] shrink-0">
              <button
                onClick={onClose}
                disabled={hasConflicts && resolution === 'pending'}
                className="btn-primary disabled:opacity-40"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Done</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
