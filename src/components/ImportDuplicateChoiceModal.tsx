import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Layers, ShieldCheck } from 'lucide-react';
import { DuplicatePreviewResult } from '../data/leadStorage.ts';

interface ImportDuplicateChoiceModalProps {
  isOpen: boolean;
  preview: DuplicatePreviewResult | null;
  fileName?: string;
  /** Display only — a lead's tag/context is compared regardless of whether one was given. */
  tagLabel?: string | null;
  onChoose: (choice: 'only-new' | 'full-file') => void;
  onCancel: () => void;
}

// Pre-import choice — shown whenever a dry-run duplicate check (see
// previewBulkImportDuplicates) finds this file contains leads that already exist.
// Asked EVERY time this happens, whether an explicit tag was given for the upload or
// not — the comparison is about the lead data itself, not the tag or the filename (see
// lib/dedupe.ts). Nothing is imported until the user picks one.
export default function ImportDuplicateChoiceModal({ isOpen, preview, fileName, tagLabel, onChoose, onCancel }: ImportDuplicateChoiceModalProps) {
  if (!preview) return null;

  // Every single row already exists — there is no "only new leads" to import, so that
  // option would just import nothing and confuse the choice. Only the full-file
  // (re-affirm every row per the app's existing duplicate-handling behavior) or cancel
  // are offered.
  const allDuplicates = preview.uniqueRows === 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="w-full max-w-md glass-modal overflow-hidden"
          >
            <div className="flex items-center space-x-3 px-6 py-4 bg-gradient-to-r from-amber-50 via-orange-50/50 to-transparent dark:from-amber-500/10 dark:via-transparent dark:to-transparent border-b border-[var(--border-subtle)]">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
                <Copy className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight">
                {allDuplicates ? 'All Leads Already Exist' : 'Duplicate Leads Detected'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-[var(--surface-card-header)] border border-[var(--border-subtle)] rounded-xl space-y-1 text-2xs font-semibold">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Leads found in the uploaded file</span>
                  <span className="text-[var(--text-primary)] font-bold">{preview.totalRows}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Already exist{tagLabel ? ` (tag "${tagLabel}")` : ''}</span>
                  <span className="text-[var(--text-primary)] font-bold">{preview.duplicatesSkipped}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">New leads found</span>
                  <span className="text-[var(--text-primary)] font-bold">{preview.uniqueRows}</span>
                </div>
              </div>

              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {fileName ? <span className="font-bold text-[var(--text-primary)]">{fileName}</span> : 'This file'} — how would you like to import it?
              </p>

              <div className="space-y-2.5">
                {!allDuplicates && (
                  <button
                    onClick={() => onChoose('only-new')}
                    className="w-full flex items-start space-x-3 p-3.5 rounded-xl border border-violet-300 bg-[var(--accent-primary-soft)] hover:bg-violet-100/60 dark:hover:bg-violet-500/15 transition-colors cursor-pointer text-left"
                  >
                    <ShieldCheck className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-xs font-extrabold text-[var(--text-primary)]">Import Only New / Non-Duplicate Leads ({preview.uniqueRows})</span>
                      <span className="block text-3xs text-[var(--text-muted)] font-medium mt-0.5">Recommended. Skip the {preview.duplicatesSkipped} duplicate{preview.duplicatesSkipped === 1 ? '' : 's'} — only new leads are added.</span>
                    </div>
                  </button>
                )}
                <button
                  onClick={() => onChoose('full-file')}
                  className={`w-full flex items-start space-x-3 p-3.5 rounded-xl border transition-colors cursor-pointer text-left ${
                    allDuplicates
                      ? 'border-violet-300 bg-[var(--accent-primary-soft)] hover:bg-violet-100/60 dark:hover:bg-violet-500/15'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <Layers className={`w-4 h-4 shrink-0 mt-0.5 ${allDuplicates ? 'text-violet-600' : 'text-[var(--text-muted)]'}`} />
                  <div>
                    <span className="block text-xs font-extrabold text-[var(--text-primary)]">Import Complete File ({preview.totalRows})</span>
                    <span className="block text-3xs text-[var(--text-muted)] font-medium mt-0.5">Include every row, duplicates included, per the app's existing duplicate-handling behavior. A row sharing a real email with an existing lead updates that lead rather than creating a second record.</span>
                  </div>
                </button>
              </div>

              <button
                onClick={onCancel}
                className="w-full text-3xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] uppercase tracking-wider pt-1"
              >
                Cancel — don't import anything
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
