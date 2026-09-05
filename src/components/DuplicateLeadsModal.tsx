import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, X, CheckCircle2 } from 'lucide-react';
import { BulkImportResult } from '../data/leadStorage.ts';

interface DuplicateLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: BulkImportResult | null;
  csvName?: string;
}

// Every relevant field on these leads matched exactly (tag plays no part in the
// comparison — see lib/dedupe.ts). Beyond this many names the list switches to a
// preview + "View All Duplicates" toggle rather than rendering hundreds/thousands of
// rows at once (see the 1,000+1 case).
const PREVIEW_LIMIT = 25;

// Mandatory popup — shown only when duplicatesSkipped > 0. Lists every exact-duplicate
// lead the import corrected to one record. Never shows the CSV filename or the tag name
// in place of a lead's actual name.
export default function DuplicateLeadsModal({ isOpen, onClose, result, csvName }: DuplicateLeadsModalProps) {
  const [showAll, setShowAll] = useState(false);

  if (!result || result.duplicatesSkipped === 0) return null;

  const names = result.duplicateLeadNames;
  const isLarge = names.length > PREVIEW_LIMIT;
  const visibleNames = showAll || !isLarge ? names : names.slice(0, PREVIEW_LIMIT);

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
                  <h3 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight">Exact Duplicate Leads Found</h3>
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
                I found exact duplicates of {names.length} existing lead{names.length === 1 ? '' : 's'}. Each duplicate was corrected to one lead.
              </p>

              <div className="max-h-40 overflow-y-auto border border-[var(--border-subtle)] rounded-xl divide-y divide-[var(--border-subtle)]">
                {visibleNames.map((name) => (
                  <div key={name} className="px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">{name}</span>
                  </div>
                ))}
              </div>

              {isLarge && (
                <button
                  onClick={() => setShowAll(v => !v)}
                  className="text-3xs font-extrabold text-violet-600 hover:text-violet-800 uppercase tracking-wider"
                >
                  {showAll ? 'Show Less' : `View All ${names.length} Duplicates`}
                </button>
              )}

              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-400/20 rounded-xl space-y-1">
                <p className="text-2xs font-bold text-emerald-800 dark:text-emerald-400">
                  ✓ {result.duplicatesSkipped} duplicate cop{result.duplicatesSkipped === 1 ? 'y was' : 'ies were'} skipped and not added to Supabase.
                </p>
                <p className="text-2xs font-bold text-emerald-800 dark:text-emerald-400">
                  ✓ {result.count} new lead{result.count === 1 ? ' was' : 's were'} imported.
                </p>
                <p className="text-3xs text-[var(--text-muted)] font-medium pt-0.5">
                  Only one copy of each duplicate lead was kept.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--surface-card-header)] shrink-0">
              <button onClick={onClose} className="btn-primary">
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
