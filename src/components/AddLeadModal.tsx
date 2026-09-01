import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UserPlus, Mail, Building, Briefcase, MapPin, Phone, MessageSquare, Tag, CheckCircle } from 'lucide-react';

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (leadData: any) => Promise<boolean>;
  filterOptions: {
    sources: string[];
    statuses: string[];
  };
}

export default function AddLeadModal({ isOpen, onClose, onAdd, filterOptions }: AddLeadModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('approved');
  const [sourceName, setSourceName] = useState('Manual Entry');
  const [questions, setQuestions] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !email) {
      setError('First name and email are required.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    const success = await onAdd({
      firstName,
      lastName,
      email,
      organization,
      jobTitle,
      city,
      phone,
      approvalStatus,
      sourceName,
      questions,
    });

    setIsSubmitting(false);
    if (success) {
      // Reset form
      setFirstName('');
      setLastName('');
      setEmail('');
      setOrganization('');
      setJobTitle('');
      setCity('');
      setPhone('');
      setApprovalStatus('approved');
      setSourceName('Manual Entry');
      setQuestions('');
      onClose();
    } else {
      setError('Failed to create lead. Please check your credentials and try again.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="add-lead-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            id="add-lead-modal-content"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="w-full max-w-2xl glass-modal overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[var(--surface-card-header)] border-b border-[var(--border-subtle)]">
              <div className="flex items-center space-x-2 text-[var(--text-primary)]">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold tracking-tight">Create New Lead</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. John"
                      className="glass-input"
                    />
                  </div>
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Doe"
                    className="glass-input"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-muted)]">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. john.doe@company.com"
                      className="glass-input pl-9 pr-3 !text-sm"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-muted)]">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="glass-input pl-9 pr-3 !text-sm"
                    />
                  </div>
                </div>

                {/* Company / Organization */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Company / Organization
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-muted)]">
                      <Building className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="e.g. TrilliantDigital"
                      className="glass-input pl-9 pr-3 !text-sm"
                    />
                  </div>
                </div>

                {/* Job Title */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Job Title
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-muted)]">
                      <Briefcase className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Digital Marketing Manager"
                      className="glass-input pl-9 pr-3 !text-sm"
                    />
                  </div>
                </div>

                {/* City / Location */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Location / City
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-muted)]">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Bangalore"
                      className="glass-input pl-9 pr-3 !text-sm"
                    />
                  </div>
                </div>

                {/* Source Name */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Lead Source
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-muted)]">
                      <Tag className="w-4 h-4" />
                    </span>
                    <select
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                      className="glass-select pl-9 pr-3 !text-sm appearance-none cursor-pointer"
                    >
                      <option value="Manual Entry">Manual Entry</option>
                      <option value="Facebook Ads">Facebook Ads</option>
                      <option value="WhatsApp Invitation">WhatsApp Invitation</option>
                      <option value="Old Registrants Email Campaign">Old Registrants Email Campaign</option>
                      <option value="Direct">Direct</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Approval Status */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Approval Status
                </label>
                <div className="flex items-center space-x-4">
                  {['approved', 'pending', 'denied'].map((status) => (
                    <label key={status} className="flex items-center space-x-2 text-sm font-medium text-[var(--text-secondary)] capitalize cursor-pointer">
                      <input
                        type="radio"
                        name="approvalStatus"
                        value={status}
                        checked={approvalStatus === status}
                        onChange={() => setApprovalStatus(status)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      />
                      <span>{status}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Questions */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Questions to Speaker
                </label>
                <div className="relative">
                  <span className="absolute top-3 left-3 pointer-events-none text-[var(--text-muted)]">
                    <MessageSquare className="w-4 h-4" />
                  </span>
                  <textarea
                    rows={2}
                    value={questions}
                    onChange={(e) => setQuestions(e.target.value)}
                    placeholder="Describe any questions or custom inquiries..."
                    className="glass-textarea pl-9 pr-3 !text-sm resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Save Lead</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
