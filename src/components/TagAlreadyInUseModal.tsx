import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tag, AlertCircle, X } from 'lucide-react';

interface TagAlreadyInUseModalProps {
  isOpen: boolean;
  /** The conflicting tag name — also used to pre-fill the editable text input. */
  tag: string;
  /**
   * Called with the (possibly edited) tag name the user wants to continue with.
   * Resolves to `{ ok: true }` once it's confirmed free — the caller then closes this
   * modal and proceeds. Resolves to `{ ok: false }` when it's STILL in use (unchanged,
   * or changed to another tag that's also taken) — the modal stays open and shows the
   * conflict inline so the user can try again; the import is never allowed to continue
   * until a genuinely unique tag name is provided.
   */
  onSubmit: (newTag: string) => Promise<{ ok: boolean }>;
  onCancel: () => void;
}

// Tag names must be unique per upload — reusing one that already has leads under it is
// never silently allowed and never offered as a "continue anyway" option. Shown whenever
// the tag resolved for THIS upload already has live leads under it, independent of the
// file-level check (lib/csvFileRegistry.ts) and the lead-level duplicate check
// (lib/dedupe.ts). The import cannot proceed until this resolves to a free tag name or
// the user cancels.
export default function TagAlreadyInUseModal({ isOpen, tag, onSubmit, onCancel }: TagAlreadyInUseModalProps) {
  const [value, setValue] = useState(tag);
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-seed the input with the current conflicting tag every time this modal opens (a
  // fresh conflict, not a re-render of an in-progress one) — never mid-edit.
  useEffect(() => {
    if (isOpen) {
      setValue(tag);
      setError('');
    }
  }, [isOpen, tag]);

  const handleContinue = async () => {
    const clean = value.trim().replace(/\s+/g, '-');
    if (!clean) {
      setError('Enter a tag name, or cancel this import.');
      return;
    }
    setIsChecking(true);
    setError('');
    try {
      const result = await onSubmit(clean);
      if (!result.ok) {
        setError(`"${clean}" is also already being used. Please enter a different tag name.`);
        inputRef.current?.focus();
      }
      // On success the caller flips `isOpen` false and moves on — nothing further to do here.
    } finally {
      setIsChecking(false);
    }
  };

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
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-50 via-orange-50/50 to-transparent dark:from-amber-500/10 dark:via-transparent dark:to-transparent border-b border-[var(--border-subtle)]">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
                  <Tag className="w-5 h-5" />
                </div>
                <h3 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight">Tag Name Already Exists</h3>
              </div>
              <button onClick={onCancel} className="p-1.5 rounded-xl hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                The tag name <span className="font-bold text-[var(--text-primary)]">"{tag}"</span> is already being used. Please enter a different tag name before importing this file.
              </p>

              <div>
                <label htmlFor="tag-conflict-input" className="micro-label block mb-1.5">New Tag Name</label>
                <input
                  ref={inputRef}
                  id="tag-conflict-input"
                  type="text"
                  value={value}
                  onChange={(e) => { setValue(e.target.value); if (error) setError(''); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!isChecking) handleContinue();
                    }
                  }}
                  autoFocus
                  className="glass-input !text-xs font-bold focus:!border-violet-500 focus:!ring-2 focus:!ring-violet-500/20"
                />
                {error && (
                  <p className="mt-1.5 text-3xs font-semibold text-rose-600 flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{error}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2.5">
                <button
                  onClick={onCancel}
                  className="btn-secondary flex-1"
                >
                  Cancel Import
                </button>
                <button
                  onClick={handleContinue}
                  disabled={isChecking || !value.trim()}
                  className="btn-primary flex-1 disabled:opacity-40"
                >
                  {isChecking ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Change Tag Name / Continue</span>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
