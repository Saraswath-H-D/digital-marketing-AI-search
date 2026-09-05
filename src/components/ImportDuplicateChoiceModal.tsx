import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Layers, ShieldCheck, Tag } from 'lucide-react';
import { DuplicatePreviewResult } from '../data/leadStorage.ts';

interface ImportDuplicateChoiceModalProps {
  isOpen: boolean;
  preview: DuplicatePreviewResult | null;
  fileName?: string;
  /** True when the tag resolved for this upload already has leads under it in the
   *  database. Purely informational here — reusing an existing tag is normal and never
   *  blocked; tag and lead-duplicate detection are independent checks (see lib/dedupe.ts)
   *  that this single popup happens to report together. */
  tagAlreadyExists?: boolean;
  onChoose: (choice: 'only-new' | 'full-file') => void;
  onCancel: () => void;
}

// Single combined pre-import popup covering both independent checks — "does this tag
// already have leads under it?" and "do any of this file's leads already exist?" (see
// lib/dedupe.ts; tag plays no part in that second comparison). Shown whenever EITHER is
// true; skipped entirely only when the tag is fresh (or none was given) AND every lead
// in the file is genuinely new. Nothing is imported until the user picks one.
export default function ImportDuplicateChoiceModal({ isOpen, preview, fileName, tagAlreadyExists, onChoose, onCancel }: ImportDuplicateChoiceModalProps) {
  if (!preview) return null;

  const allNew = preview.duplicatesSkipped === 0;
  const allDup = preview.uniqueRows === 0;
  const mixed = !allNew && !allDup;

  let title: string;
  let prompt: string;
  // The primary button's actual effect — NEVER inferred from whether a secondary
  // button exists (an all-duplicates file's only button must still force-include
  // those duplicates per the app's existing handling, not silently import nothing).
  let primaryChoice: 'full-file' | 'only-new';
  let primaryLabel: string;
  let secondaryLabel: string | null;

  if (tagAlreadyExists) {
    if (mixed) {
      title = 'This tag already exists. Some leads in this CSV are already present.';
      prompt = 'What would you like to upload?';
      primaryChoice = 'full-file';
      primaryLabel = 'Upload Full File';
      secondaryLabel = 'Upload Only Non-Duplicates';
    } else if (allDup) {
      title = 'All leads in this CSV already exist under this tag.';
      prompt = '';
      primaryChoice = 'full-file';
      primaryLabel = 'Upload Full File';
      secondaryLabel = null;
    } else {
      title = 'This tag already exists, but all leads in this CSV are new.';
      prompt = '';
      primaryChoice = 'only-new';
      primaryLabel = 'Upload All New Leads';
      secondaryLabel = null;
    }
  } else if (mixed) {
    title = fileName ? 'Some leads from this CSV already exist.' : 'Some leads already exist in your database.';
    prompt = 'Would you like to add the entire file or only the new leads?';
    primaryChoice = 'full-file';
    primaryLabel = 'Add Full File';
    secondaryLabel = 'Add Only Non-Duplicates';
  } else {
    // allDup, no tag conflict — allNew-with-no-tag-conflict never reaches this modal at
    // all (the caller skips it and imports immediately).
    title = 'All leads from this CSV already exist.';
    prompt = '';
    primaryChoice = 'full-file';
    primaryLabel = 'Add Full File';
    secondaryLabel = null;
  }

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
                {tagAlreadyExists ? <Tag className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </div>
              <h3 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight">{title}</h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-[var(--surface-card-header)] border border-[var(--border-subtle)] rounded-xl space-y-1 text-2xs font-semibold">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Total leads in CSV</span>
                  <span className="text-[var(--text-primary)] font-bold">{preview.totalRows}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Duplicate leads</span>
                  <span className="text-[var(--text-primary)] font-bold">{preview.duplicatesSkipped}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">New / non-duplicate leads</span>
                  <span className="text-[var(--text-primary)] font-bold">{preview.uniqueRows}</span>
                </div>
              </div>

              {prompt && (
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {fileName ? <span className="font-bold text-[var(--text-primary)]">{fileName}</span> : 'This file'} — {prompt}
                </p>
              )}

              <div className="space-y-2.5">
                {secondaryLabel && (
                  <button
                    onClick={() => onChoose('only-new')}
                    className="w-full flex items-start space-x-3 p-3.5 rounded-xl border border-violet-300 bg-[var(--accent-primary-soft)] hover:bg-violet-100/60 dark:hover:bg-violet-500/15 transition-colors cursor-pointer text-left"
                  >
                    <ShieldCheck className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-xs font-extrabold text-[var(--text-primary)]">{secondaryLabel} ({preview.uniqueRows})</span>
                      <span className="block text-3xs text-[var(--text-muted)] font-medium mt-0.5">Recommended. Skip the {preview.duplicatesSkipped} duplicate{preview.duplicatesSkipped === 1 ? '' : 's'} — only new leads are added.</span>
                    </div>
                  </button>
                )}
                <button
                  onClick={() => onChoose(primaryChoice)}
                  className={`w-full flex items-start space-x-3 p-3.5 rounded-xl border transition-colors cursor-pointer text-left ${
                    secondaryLabel
                      ? 'border-[var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--surface-hover)]'
                      : 'border-violet-300 bg-[var(--accent-primary-soft)] hover:bg-violet-100/60 dark:hover:bg-violet-500/15'
                  }`}
                >
                  <Layers className={`w-4 h-4 shrink-0 mt-0.5 ${secondaryLabel ? 'text-[var(--text-muted)]' : 'text-violet-600'}`} />
                  <div>
                    <span className="block text-xs font-extrabold text-[var(--text-primary)]">{primaryLabel} ({preview.totalRows})</span>
                    <span className="block text-3xs text-[var(--text-muted)] font-medium mt-0.5">
                      {allNew
                        ? 'Every lead in this file is new — all of them are added.'
                        : "Include every row, duplicates included, per the app's existing duplicate-handling behavior. A row sharing a real email with an existing lead updates that lead rather than creating a second record."}
                    </span>
                  </div>
                </button>
              </div>

              <button
                onClick={onCancel}
                className="w-full text-3xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] uppercase tracking-wider pt-1"
              >
                Cancel — don't upload anything
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
