import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface BaseProps {
  label: string;
  options: string[];
  placeholder?: string;
  required?: boolean;
  icon?: React.ReactNode;
  // Whether text typed but not matching any option can still be committed as a value.
  // Defaults to true (matches the original single-value behavior). Set false for
  // fields that should only ever accept picks from the live option list (e.g. Industry
  // in the filters sidebar — searching against real data, not inventing new values).
  allowFreeText?: boolean;
}

type SearchableSelectProps =
  | (BaseProps & { multiple?: false; value: string; onChange: (value: string) => void })
  | (BaseProps & { multiple: true; value: string[]; onChange: (value: string[]) => void });

// Searchable combobox: type to filter a provided option list, click a result to
// select it. Matches the `glass-input` visual language (border/radius/focus ring) so
// it drops into an existing Add-form grid — see AddLeadModal.tsx/AddCompanyModal.tsx's
// per-field pattern — without looking out of place.
//
// Single mode (default): one value, free typing beyond the option list is allowed by
// default (the raw text becomes the value on blur) — works for a fixed list
// (Seniority) or an open-ended one (Industry on Add forms) without forcing the user to
// pick only from what's shown.
//
// Multi mode (`multiple`): value/onChange work over a string[] instead. Picking an
// option toggles its membership and the dropdown stays open so several picks can be
// made in a row; selections render as removable chips beneath the input. Free-typed
// text (when `allowFreeText`) commits as an additional chip on blur/Enter rather than
// replacing the whole value.
export default function SearchableSelect(props: SearchableSelectProps) {
  const { label, options, placeholder, required, icon, allowFreeText = true } = props;
  const isMulti = props.multiple === true;

  const [query, setQuery] = useState(isMulti ? '' : props.value);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the visible text in sync if the value changes from outside (e.g. form reset)
  // — only meaningful in single mode, where query mirrors the one selected value.
  useEffect(() => {
    if (!isMulti) setQuery(props.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMulti ? null : props.value]);

  const commitFreeText = () => {
    const typed = query.trim();
    if (!typed || !allowFreeText) return;
    if (isMulti) {
      if (!props.value.includes(typed)) props.onChange([...props.value, typed]);
      setQuery('');
    } else {
      props.onChange(typed);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // Commit whatever's currently typed, even if it doesn't match an option — a
        // searchable field shouldn't silently discard free-typed input (unless
        // allowFreeText is off, in which case unmatched text is simply dropped).
        if (isMulti) {
          commitFreeText();
        } else if (allowFreeText) {
          props.onChange(query);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const selectedValues = isMulti ? props.value : [];
  const filtered = (query.trim()
    ? options.filter(opt => opt.toLowerCase().includes(query.trim().toLowerCase()))
    : options
  ).filter(opt => !isMulti || !selectedValues.includes(opt));

  const selectOption = (opt: string) => {
    if (isMulti) {
      if (!props.value.includes(opt)) props.onChange([...props.value, opt]);
      setQuery('');
      // Keep the dropdown open so several options can be picked in a row.
    } else {
      setQuery(opt);
      props.onChange(opt);
      setIsOpen(false);
    }
  };

  const removeChip = (opt: string) => {
    if (isMulti) props.onChange(props.value.filter(v => v !== opt));
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-muted)]">
            {icon}
          </span>
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (isMulti) commitFreeText();
            }
          }}
          placeholder={placeholder || `Search ${label.toLowerCase()}...`}
          className={`glass-input ${icon ? 'pl-9' : ''} pr-9 !text-sm`}
        />
        <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[var(--text-muted)]">
          {isOpen ? <Search className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </div>

      {isMulti && selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedValues.map(v => (
            <span
              key={v}
              className="inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-black bg-violet-100 text-violet-950 border border-violet-300 rounded-lg shadow-2xs"
            >
              <span className="truncate max-w-[140px]">{v}</span>
              <button
                type="button"
                onClick={() => removeChip(v)}
                className="hover:text-violet-600 focus:outline-none cursor-pointer"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {isOpen && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-lg">
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => selectOption(opt)}
              className="w-full text-left px-3.5 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
