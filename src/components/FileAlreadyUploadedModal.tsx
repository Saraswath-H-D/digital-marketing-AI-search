import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileSpreadsheet, Copy, Layers } from 'lucide-react';

interface FileAlreadyUploadedModalProps {
  isOpen: boolean;
  fileName: string;
  existingTags: string[];
  newTag: string | null;
  onChoose: (choice: 'both' | 'one') => void;
}

// File-level duplicate: the exact same CSV bytes were uploaded before under a different
// tag. This is a separate check from lead-level duplicate detection (dedupe.ts) — see
// lib/csvFileRegistry.ts. Never decided silently; always asks.
export default function FileAlreadyUploadedModal({ isOpen, fileName, existingTags, newTag, onChoose }: FileAlreadyUploadedModalProps) {
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
            <div className="flex items-center space-x-3 px-6 py-4 bg-gradient-to-r from-violet-50 via-indigo-50/50 to-transparent dark:from-violet-500/10 dark:via-transparent dark:to-transparent border-b border-[var(--border-subtle)]">
              <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-md shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight">CSV File Already Uploaded</h3>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                This CSV file has already been uploaded with a different tag. What would you like to do?
              </p>

              <div className="p-3 bg-[var(--surface-card-header)] border border-[var(--border-subtle)] rounded-xl space-y-1.5 text-2xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)] font-bold">File</span>
                  <span className="text-[var(--text-primary)] font-semibold truncate max-w-[220px]">{fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)] font-bold">Previously uploaded as</span>
                  <span className="text-[var(--text-primary)] font-semibold">{existingTags.join(', ') || '(no tag)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)] font-bold">This upload's tag</span>
                  <span className="text-[var(--text-primary)] font-semibold">{newTag || '(no tag)'}</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={() => onChoose('both')}
                  className="w-full flex items-start space-x-3 p-3.5 rounded-xl border border-violet-300 bg-[var(--accent-primary-soft)] hover:bg-violet-100/60 dark:hover:bg-violet-500/15 transition-colors cursor-pointer text-left"
                >
                  <Layers className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-xs font-extrabold text-[var(--text-primary)]">Upload Both</span>
                    <span className="block text-3xs text-[var(--text-muted)] font-medium mt-0.5">Keep the same lead data — no duplicate records — and let these leads carry both tags.</span>
                  </div>
                </button>
                <button
                  onClick={() => onChoose('one')}
                  className="w-full flex items-start space-x-3 p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-left"
                >
                  <Copy className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-xs font-extrabold text-[var(--text-primary)]">Consider Only One File</span>
                    <span className="block text-3xs text-[var(--text-muted)] font-medium mt-0.5">Treat this as the same upload — keep the existing tag, skip re-importing.</span>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
