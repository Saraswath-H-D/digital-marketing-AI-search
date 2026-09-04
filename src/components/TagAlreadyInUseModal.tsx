import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tag, RefreshCw, ArrowRight } from 'lucide-react';

interface TagAlreadyInUseModalProps {
  isOpen: boolean;
  tag: string;
  onKeep: () => void;
  onChangeTag: () => void;
}

// Shown whenever the tag typed in for THIS upload already has live leads in Supabase
// under it — independent of the file-level check (lib/csvFileRegistry.ts) and the
// lead-level duplicate check (lib/dedupe.ts). Reusing a tag on purpose (adding more
// leads to the same list) is normal and fine — this only ever asks, never blocks.
export default function TagAlreadyInUseModal({ isOpen, tag, onKeep, onChangeTag }: TagAlreadyInUseModalProps) {
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
                <Tag className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight">Tag Already In Use</h3>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                The tag <span className="font-bold text-[var(--text-primary)]">"{tag}"</span> already has leads in your list. That's fine if you're adding more leads to the same list — new leads will still be checked for duplicates against it as usual.
              </p>

              <div className="space-y-2.5">
                <button
                  onClick={onKeep}
                  className="w-full flex items-start space-x-3 p-3.5 rounded-xl border border-violet-300 bg-[var(--accent-primary-soft)] hover:bg-violet-100/60 dark:hover:bg-violet-500/15 transition-colors cursor-pointer text-left"
                >
                  <ArrowRight className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-xs font-extrabold text-[var(--text-primary)]">Keep Using "{tag}"</span>
                    <span className="block text-3xs text-[var(--text-muted)] font-medium mt-0.5">Continue this import under the same tag.</span>
                  </div>
                </button>
                <button
                  onClick={onChangeTag}
                  className="w-full flex items-start space-x-3 p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-left"
                >
                  <RefreshCw className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-xs font-extrabold text-[var(--text-primary)]">Change Tag Name</span>
                    <span className="block text-3xs text-[var(--text-muted)] font-medium mt-0.5">Don't import yet — I'll use a different tag for this upload.</span>
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
