import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
}: ConfirmDeleteModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          id="confirm-delete-modal-backdrop" 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-md"
        >
          {/* Modal Card */}
          <motion.div
            id="confirm-delete-modal-content"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="w-full max-w-md glass-modal overflow-hidden p-6"
          >
            {/* Header / Body Container */}
            <div>
              <div className="flex items-start space-x-4">
                {/* Warning Icon Badge */}
                <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950 flex items-center justify-center text-red-600 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                
                {/* Text Content */}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">{title}</h3>
                    <button
                      onClick={onClose}
                      className="btn-icon"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-medium text-[var(--text-muted)] leading-relaxed">
                    {message}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Button Row */}
            <div className="mt-6 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="btn-danger"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{confirmText}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
