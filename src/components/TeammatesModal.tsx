import React, { useState } from 'react';
import { X, UserPlus, Mail, Shield, Check, Users, Sparkles } from 'lucide-react';

interface TeammatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowMessage: (text: string, type: 'success' | 'error') => void;
}

export default function TeammatesModal({ isOpen, onClose, onShowMessage }: TeammatesModalProps) {
  const [emailsText, setEmailsText] = useState('');
  const [role, setRole] = useState<'Admin' | 'Sales Manager' | 'Sales Rep'>('Sales Rep');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailsText.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onShowMessage(`Invited teammates with ${role} access!`, 'success');
      setEmailsText('');
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[var(--surface-card-elevated)] rounded-3xl shadow-2xl overflow-hidden border border-[var(--border-subtle)]" style={{ backdropFilter: 'blur(40px) saturate(180%)' }}>
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 via-orange-400 to-pink-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-orange-950/40">
              <UserPlus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">Invite Sales Teammates</h3>
              <p className="text-2xs text-purple-200">Grant team access to Operon Enterprise Lead Intelligence</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleInvite} className="p-6 space-y-4">
          <div>
            <label className="text-3xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
              Teammate Email Addresses (Comma or Newline separated)
            </label>
            <textarea
              rows={4}
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              placeholder="e.g. sarah.rep@company.com, mike.manager@company.com"
              className="w-full text-xs font-medium p-3.5 border border-[var(--border-input)] rounded-2xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-[var(--surface-input)] text-[var(--text-primary)]"
              required
            />
          </div>

          <div>
            <label className="text-3xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider block mb-1.5">
              Select Enterprise Access Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { name: 'Admin', desc: 'Full database & user access' },
                { name: 'Sales Manager', desc: 'Team outreach & reporting' },
                { name: 'Sales Rep', desc: 'Lead discovery & email' }
              ].map((r) => (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => setRole(r.name as any)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    role === r.name
                      ? 'border-indigo-600 bg-indigo-50/80 text-indigo-900 ring-2 ring-indigo-500/20 font-bold'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <span className="text-xs font-extrabold block">{r.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-medium leading-tight block mt-0.5">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-extrabold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 via-orange-400 to-pink-500 hover:from-amber-300 hover:to-pink-400 rounded-xl shadow-md transition-all cursor-pointer flex items-center space-x-2"
            >
              {isSubmitting ? (
                <span>Sending Invites...</span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Send Team Invites</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
