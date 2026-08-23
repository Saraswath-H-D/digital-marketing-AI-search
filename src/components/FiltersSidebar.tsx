import React, { useState, useMemo } from 'react';
import { Filters, FilterOptions } from '../types.ts';
import { 
  ChevronDown, 
  ChevronUp,
  X, 
  RefreshCw, 
  Search,
  SlidersHorizontal,
  Tag,
  RotateCcw
} from 'lucide-react';

interface FiltersSidebarProps {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  filterOptions: FilterOptions;
  onClear: () => void;
  isLoading: boolean;
}

export default function FiltersSidebar({
  filters,
  setFilters,
  filterOptions,
  onClear,
  isLoading,
}: FiltersSidebarProps) {
  // Column Search State
  const [columnSearch, setColumnSearch] = useState('');
  
  // Custom Accordion Open/Closed State
  const [openCustomSections, setOpenCustomSections] = useState<Record<string, boolean>>({});

  // Inner Option Search per column
  const [optionSearches, setOptionSearches] = useState<Record<string, string>>({});

  // All available custom columns from uploaded CSV file
  const customFiltersObj = filterOptions.customFilters || {};
  const totalColumnCount = Object.keys(customFiltersObj).length;

  // Filter column accordions based on search input
  const filteredColumns = useMemo(() => {
    const entries = Object.entries(customFiltersObj);
    if (!columnSearch.trim()) return entries;
    const query = columnSearch.trim().toLowerCase();
    return entries.filter(([colName]) => {
      const cleanName = colName.replace(/_/g, ' ').toLowerCase();
      return cleanName.includes(query);
    });
  }, [customFiltersObj, columnSearch]);

  // Active filter count calculation
  const activeCustomFilterCount = useMemo(() => {
    if (!filters.customFilters) return 0;
    return Object.values(filters.customFilters).reduce((acc, vals) => acc + (vals ? vals.length : 0), 0);
  }, [filters.customFilters]);

  const hasActiveFilters = activeCustomFilterCount > 0;

  const handleClearAll = () => {
    setFilters(prev => ({
      ...prev,
      customFilters: {}
    }));
    onClear();
  };

  return (
    <aside id="filters-sidebar" className="w-80 border-r border-[var(--border-subtle)] bg-[var(--surface-card)] flex flex-col h-full overflow-hidden select-none shrink-0">
      
      {/* Sidebar Top Header */}
      <div className="p-4 bg-[var(--surface-card-elevated)] border-b border-[var(--border-subtle)] shrink-0 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
            <Tag className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="micro-label font-black text-xs tracking-widest uppercase text-[var(--text-primary)]">CSV Column Filters</span>
              {activeCustomFilterCount > 0 && (
                <span className="px-2 py-0.5 text-[9px] font-black text-white bg-purple-600 rounded-full shadow-2xs">
                  {activeCustomFilterCount} Active
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 font-semibold">{totalColumnCount} CSV columns available</p>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleClearAll}
            className="text-2xs font-black text-purple-900 flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-purple-50 border border-purple-200 rounded-xl transition-all cursor-pointer super-3d-white-btn"
            title="Clear all active CSV column filters"
          >
            <RotateCcw className="w-3 h-3 text-purple-700" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* 3D Column Search Bar */}
      <div className="p-3 border-b border-pink-200/60 bg-[#FDF2F8] shrink-0">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-purple-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={columnSearch}
            onChange={(e) => setColumnSearch(e.target.value)}
            placeholder={`Search ${totalColumnCount} CSV column filters...`}
            className="w-full pl-9.5 pr-8 py-2 text-xs border border-purple-200 rounded-2xl focus:outline-none focus:border-purple-500 transition-all bg-white/95 placeholder-slate-400 font-bold text-purple-950 super-3d-input"
          />
          {columnSearch && (
            <button
              type="button"
              onClick={() => setColumnSearch('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-purple-600 active:scale-90 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3D Column Accordions List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin">
        {totalColumnCount === 0 ? (
          <div className="text-center py-10 px-4 bg-white/80 rounded-2xl border border-purple-200/60 super-3d-card">
            <Tag className="w-8 h-8 text-purple-300 mx-auto mb-2" />
            <p className="text-xs font-black text-purple-950">No CSV Columns Found</p>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">Upload a CSV file to activate targeting filters for all headers.</p>
          </div>
        ) : filteredColumns.length === 0 ? (
          <div className="text-center py-8 px-4 bg-white/80 rounded-2xl border border-purple-200/60 super-3d-card">
            <Search className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <p className="text-xs font-black text-purple-950">No Matching Filters</p>
            <p className="text-[11px] text-slate-500 mt-1">No CSV columns match "{columnSearch}"</p>
            <button
              onClick={() => setColumnSearch('')}
              className="mt-2 text-xs font-black text-purple-700 hover:underline cursor-pointer"
            >
              Clear search
            </button>
          </div>
        ) : (
          filteredColumns.map(([columnName, options]) => {
            const selectedCustomValues = (filters.customFilters && filters.customFilters[columnName]) || [];
            const isOpen = !!openCustomSections[columnName];
            const cleanTitle = columnName.replace(/_/g, ' ');
            const isActive = selectedCustomValues.length > 0;
            const optSearch = optionSearches[columnName] || '';

            // Filter inner options if user types in option search
            const filteredOptions = optSearch.trim()
              ? options.filter(opt => opt.toLowerCase().includes(optSearch.trim().toLowerCase()))
              : options;

            return (
              <div key={columnName} className="select-none">
                {/* 3D Accordion Pill Header Button */}
                <button
                  onClick={() => setOpenCustomSections(prev => ({ ...prev, [columnName]: !prev[columnName] }))}
                  className={`w-full flex items-center justify-between py-2.5 px-3.5 rounded-full border transition-all duration-200 text-left cursor-pointer group super-3d-card ${
                    isActive 
                      ? 'bg-purple-100 border-purple-300 text-purple-950 font-black shadow-sm' 
                      : 'bg-white hover:bg-pink-50/60 border-pink-200/90 text-slate-900'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${
                      isActive ? 'bg-purple-600 text-white border-purple-700' : 'bg-purple-50 text-purple-600 border-purple-200'
                    }`}>
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-black tracking-tight capitalize truncate max-w-[150px]">{cleanTitle}</span>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    {selectedCustomValues.length > 0 && (
                      <span className="px-2 py-0.5 text-[9px] font-black bg-purple-600 text-white rounded-full shadow-2xs">
                        {selectedCustomValues.length}
                      </span>
                    )}
                    <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-purple-700" /> : <ChevronDown className="w-3.5 h-3.5 text-purple-700" />}
                    </div>
                  </div>
                </button>

                {/* Expanded 3D Options Container */}
                {isOpen && (
                  <div className="p-3 bg-white/95 rounded-2xl border border-purple-200 shadow-sm space-y-2 mt-1.5 animate-fadeIn super-3d-card">
                    {/* Inner Option Search Bar for long option lists */}
                    {options.length > 6 && (
                      <div className="relative mb-2">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-purple-400">
                          <Search className="w-3 h-3" />
                        </span>
                        <input
                          type="text"
                          value={optSearch}
                          onChange={(e) => setOptionSearches(prev => ({ ...prev, [columnName]: e.target.value }))}
                          placeholder={`Filter ${cleanTitle} options...`}
                          className="w-full pl-7 pr-6 py-1 text-xs border border-purple-200 rounded-xl focus:outline-none focus:border-purple-500 bg-purple-50/40 text-purple-950 font-bold"
                        />
                        {optSearch && (
                          <button
                            type="button"
                            onClick={() => setOptionSearches(prev => ({ ...prev, [columnName]: '' }))}
                            className="absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 hover:text-purple-600"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Option Checkboxes */}
                    <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                      {filteredOptions.length === 0 ? (
                        <p className="text-xs text-gray-400 italic py-1 text-center">No matching options</p>
                      ) : (
                        filteredOptions.map(val => {
                          const isChecked = selectedCustomValues.includes(val);
                          return (
                            <label 
                              key={val} 
                              className={`flex items-center space-x-2.5 py-1.5 px-2.5 rounded-xl cursor-pointer text-xs transition-colors border ${
                                isChecked 
                                  ? 'bg-purple-100/90 border-purple-300 text-purple-950 font-black' 
                                  : 'hover:bg-purple-50/60 border-transparent text-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setFilters(prev => {
                                    const currentCustom = prev.customFilters || {};
                                    const currentColVals = currentCustom[columnName] || [];
                                    const newColVals = isChecked 
                                      ? currentColVals.filter(v => v !== val)
                                      : [...currentColVals, val];
                                    return {
                                      ...prev,
                                      customFilters: {
                                        ...currentCustom,
                                        [columnName]: newColVals
                                      }
                                    };
                                  });
                                }}
                                className="w-3.5 h-3.5 rounded-sm text-purple-600 border-purple-300 focus:ring-purple-500 cursor-pointer accent-purple-600"
                              />
                              <span className="truncate">{val}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="px-4 py-2 bg-purple-50/80 border-t border-purple-200 flex items-center justify-center space-x-2 text-2xs font-extrabold text-purple-700 animate-pulse shrink-0">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" />
          <span>Syncing CSV column filters...</span>
        </div>
      )}
    </aside>
  );
}
