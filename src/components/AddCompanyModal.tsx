import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Building2, Globe, Linkedin, Briefcase, Users2, Tag, MapPin, CheckCircle } from 'lucide-react';
import SearchableSelect from './SearchableSelect.tsx';
import { INDUSTRY_OPTIONS, EMPLOYEE_SIZE_OPTIONS } from '../lib/optionConstants.ts';

interface AddCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (companyData: any) => Promise<boolean>;
}

export default function AddCompanyModal({ isOpen, onClose, onAdd }: AddCompanyModalProps) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setName(''); setDomain(''); setLinkedinUrl(''); setIndustry(''); setCompanySize('');
    setTagsInput(''); setCity(''); setState(''); setCountry('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Company name is required.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

    const success = await onAdd({
      name: name.trim(),
      domain: domain.trim(),
      linkedinUrl: linkedinUrl.trim(),
      industry,
      companySize,
      tags,
      city: city.trim(),
      state: state.trim(),
      country: country.trim(),
    });

    setIsSubmitting(false);
    if (success) {
      resetForm();
      onClose();
    } else {
      setError('Failed to create company. Please check your connection and try again.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="add-company-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            id="add-company-modal-content"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="w-full max-w-2xl glass-modal overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[var(--surface-card-header)] border-b border-[var(--border-subtle)]">
              <div className="flex items-center space-x-2 text-[var(--text-primary)]">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold tracking-tight">Add Single Company</h3>
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
                {/* Company Name */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Trilliant Digital"
                    className="glass-input"
                  />
                </div>

                {/* Company Domain */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Company Domain
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-muted)]">
                      <Globe className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="e.g. trilliantdigital.com"
                      className="glass-input pl-9 pr-3 !text-sm"
                    />
                  </div>
                </div>

                {/* Company LinkedIn Profile URL */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Company LinkedIn Profile URL
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-muted)]">
                      <Linkedin className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="e.g. linkedin.com/company/..."
                      className="glass-input pl-9 pr-3 !text-sm"
                    />
                  </div>
                </div>

                {/* Industry — searchable */}
                <SearchableSelect
                  label="Industry"
                  value={industry}
                  onChange={setIndustry}
                  options={INDUSTRY_OPTIONS}
                  placeholder="Type to search industries..."
                  icon={<Briefcase className="w-4 h-4" />}
                />

                {/* Employee Size — searchable */}
                <SearchableSelect
                  label="Employee Size"
                  value={companySize}
                  onChange={setCompanySize}
                  options={EMPLOYEE_SIZE_OPTIONS}
                  placeholder="Type to search employee size..."
                  icon={<Users2 className="w-4 h-4" />}
                />

                {/* Company Tags */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Company Tags
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-muted)]">
                      <Tag className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="e.g. Enterprise, Priority (comma-separated)"
                      className="glass-input pl-9 pr-3 !text-sm"
                    />
                  </div>
                </div>

                {/* City */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    City
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

                {/* State */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    State
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Karnataka"
                    className="glass-input"
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Country
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. India"
                    className="glass-input"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[var(--border-subtle)]">
                <button type="button" onClick={onClose} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Save Company</span>
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
