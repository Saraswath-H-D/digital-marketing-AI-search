import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, Check, AlertCircle, FileSpreadsheet, Eye, ArrowRight, Table, Tag, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { setActiveHeaders } from '../data/leadStorage.ts';
import { SYSTEM_FIELDS, parseCsvFile, buildAutoMapping, mapRowsToLeads, isCsvParseError } from '../lib/csvMapping.ts';
import { hashFile, resolveFileConflict, recordCsvFileUpload } from '../lib/csvFileRegistry.ts';
import FileAlreadyUploadedModal from './FileAlreadyUploadedModal.tsx';

interface CsvImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: any[]) => Promise<boolean>;
}

export default function CsvImporter({ isOpen, onClose, onImport }: CsvImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headerMapping, setHeaderMapping] = useState<Record<string, string>>({});
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importTag, setImportTag] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'mapping' | 'preview'>('mapping');
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [pendingFileConflict, setPendingFileConflict] = useState<{ existingTags: string[]; newTag: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const processFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Only CSV files are supported.');
      setFile(null);
      setRawHeaders([]);
      setRawRows([]);
      setParsedData([]);
      return;
    }

    setError('');
    setInfoMessage('');
    setFile(selectedFile);
    setFileHash(null);
    hashFile(selectedFile).then(setFileHash).catch(() => setFileHash(null));

    parseCsvFile(selectedFile).then((result) => {
      if (isCsvParseError(result)) {
        setError(result.error);
        setRawHeaders([]);
        setRawRows([]);
        setParsedData([]);
        return;
      }

      const { headers, rows, skippedPreambleRows } = result;
      if (skippedPreambleRows > 0) {
        console.info(`Detected ${skippedPreambleRows} report/summary row(s) above the real header row — skipped them.`);
      }

      setActiveHeaders(headers);
      setRawHeaders(headers);
      setRawRows(rows);
      setHeaderMapping(buildAutoMapping(headers));
    });
  };

  // Re-compute parsedData whenever rawRows or headerMapping changes
  useEffect(() => {
    if (rawRows.length === 0) {
      setParsedData([]);
      return;
    }
    setParsedData(mapRowsToLeads(rawRows, headerMapping, rawHeaders));
  }, [rawRows, headerMapping, rawHeaders]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleMappingChange = (fieldKey: string, csvHeader: string) => {
    setHeaderMapping(prev => ({
      ...prev,
      [fieldKey]: csvHeader
    }));
  };

  const resetForm = () => {
    setFile(null);
    setRawHeaders([]);
    setRawRows([]);
    setHeaderMapping({});
    setParsedData([]);
    setImportTag('');
    setFileHash(null);
  };

  // Runs the actual import — only ever called after the file-level duplicate check (see
  // handleImportSubmit) has been resolved, so this never re-checks the file itself.
  const doActualImport = async (finalTag: string) => {
    setIsUploading(true);

    // csvTag is stamped on EVERY row in this batch unconditionally — it's the upload's
    // own identity, independent of sourceName. sourceName is left exactly as the CSV
    // mapped it (or '-' if the row had none) and is NEVER defaulted to the tag name —
    // a lead with no real source should display "-", not the batch tag, in the Source
    // column. Previously the tag only ever lived inside sourceName (defaulted onto
    // source-less rows), which both mislabeled the Source column and, for rows that DID
    // have their own source value, lost the tag association entirely — the underlying
    // bug that made searching/deleting by tag miss rows or leave part of an upload
    // behind. csvTag now carries the tag reliably on its own regardless.
    const finalData = parsedData.map(item => ({
      ...item,
      csvTag: finalTag,
      // Carried the same way _csvHeaders already is, so callers (App.tsx) can label the
      // duplicate popup with the real filename instead of falling back to the tag.
      _csvFileName: file?.name || 'CSV Import',
    }));

    const success = await onImport(finalData);

    setIsUploading(false);
    if (success) {
      if (fileHash) recordCsvFileUpload(fileHash, file?.name || 'CSV import', finalTag, finalData.length);
      resetForm();
      onClose();
    } else {
      setError('Import failed. Please check your backend connection and try again.');
    }
  };

  const handleImportSubmit = async () => {
    if (parsedData.length === 0 || isUploading) return; // guard against duplicate/overlapping submits

    const fileNameTag = file ? file.name.replace(/\.csv$/i, '').trim().replace(/\s+/g, '-') : 'CSV-Import';
    const finalTag = (importTag && importTag.trim()) ? importTag.trim().replace(/\s+/g, '-') : fileNameTag;

    // File-level duplicate check — a completely separate check from lead-level exact
    // duplicates (see lib/csvFileRegistry.ts). Runs BEFORE any header mapping/lead
    // comparison, per the required processing order. Only a still-ACTIVE prior upload
    // (verified live against Supabase, not just "ever recorded") can trigger this — a
    // deleted CSV is always treated as brand new, and its old tag is never restored.
    if (fileHash) {
      const conflict = await resolveFileConflict(fileHash, finalTag);
      if (conflict.status === 'same-active-tag') {
        setInfoMessage(`This exact CSV file was already imported as "${finalTag}". Nothing new was imported.`);
        return;
      }
      if (conflict.status === 'different-active-tag') {
        setPendingFileConflict({ existingTags: conflict.activeTags, newTag: finalTag });
        return;
      }
      // status === 'new' — either never uploaded, or every prior recorded tag for this
      // exact file has since been deleted. Proceed as a fresh upload; never restore the
      // old tag. (No banner here — the modal closes immediately on success, so it would
      // never be seen; the chat-driven upload path surfaces this instead, since its log
      // persists.)
    }

    await doActualImport(finalTag);
  };

  const handleFileConflictChoice = async (choice: 'both' | 'one') => {
    const conflict = pendingFileConflict;
    setPendingFileConflict(null);
    if (!conflict) return;

    if (choice === 'one') {
      setInfoMessage(`Kept this CSV under its existing tag ("${conflict.existingTags.join(', ')}"). Nothing new was imported.`);
      return;
    }

    // "Upload Both" — proceed with the new tag; lead-level exact-duplicate detection
    // inside bulkImportLeads still applies normally and will never create duplicate
    // lead records even though the file itself is now associated with two tags.
    await doActualImport(conflict.newTag);
  };

  // Extract sample value for Row 1 preview
  const getSampleValue = (fieldKey: string): string => {
    const csvHeader = headerMapping[fieldKey];
    if (!csvHeader || !rawRows[0] || rawRows[0][csvHeader] === undefined || rawRows[0][csvHeader] === null) {
      return '-';
    }
    const val = String(rawRows[0][csvHeader]).trim();
    return val || '-';
  };

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <div id="csv-importer-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <motion.div
            id="csv-importer-content"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="w-full max-w-4xl glass-modal overflow-hidden my-6 flex flex-col max-h-[90vh]"
          >
            {/* Modal Top Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-50 via-indigo-50/50 to-transparent dark:from-violet-500/10 dark:via-transparent dark:to-transparent border-b border-[var(--border-subtle)] shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-md">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight">Bulk Import Contacts & Mapping</h3>
                  <p className="text-2xs text-[var(--text-muted)] font-medium">Upload CSV, map header columns, and import into Operon directory & Supabase</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Main Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {error && (
                <div className="p-3.5 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold border border-rose-200 flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {infoMessage && (
                <div className="p-3.5 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 rounded-xl text-xs font-semibold border border-sky-200 dark:border-sky-400/20 flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-sky-500" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {/* Drag & Drop File Input Area */}
              {!file ? (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                    isDragActive
                      ? 'border-violet-500 bg-violet-50/60 scale-[0.99]'
                      : 'border-violet-200 hover:border-violet-400 hover:bg-violet-50/30'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv"
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center mx-auto mb-3.5 shadow-sm">
                    <Upload className="w-7 h-7" />
                  </div>
                  <p className="text-base font-bold text-[var(--text-primary)]">Drag & drop your CSV file here</p>
                  <p className="text-xs text-[var(--text-muted)] font-medium mt-1">or click to browse your computer files (CSV only)</p>

                  <div className="mt-6 flex items-center justify-center flex-wrap gap-2 text-2xs font-bold text-[var(--text-muted)]">
                    <span className="text-[var(--text-muted)] uppercase tracking-widest">Supported Headers:</span>
                    <span className="bg-violet-100/80 text-violet-900 px-2.5 py-1 rounded-lg">First Name</span>
                    <span className="bg-violet-100/80 text-violet-900 px-2.5 py-1 rounded-lg">Last Name</span>
                    <span className="bg-violet-100/80 text-violet-900 px-2.5 py-1 rounded-lg">Email</span>
                    <span className="bg-violet-100/80 text-violet-900 px-2.5 py-1 rounded-lg">Phone Number</span>
                    <span className="bg-violet-100/80 text-violet-900 px-2.5 py-1 rounded-lg">Job Title</span>
                    <span className="bg-violet-100/80 text-violet-900 px-2.5 py-1 rounded-lg">Company Name</span>
                    <span className="bg-violet-100/80 text-violet-900 px-2.5 py-1 rounded-lg">City & 11 More</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* File Metadata Header Bar */}
                  <div className="flex items-center justify-between p-3.5 bg-violet-50/70 dark:bg-violet-500/10 border border-violet-200/90 dark:border-violet-400/20 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-xs">
                        <Table className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-extrabold text-[var(--text-primary)] truncate max-w-sm">{file.name}</p>
                          <span className="px-2 py-0.5 text-3xs font-extrabold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                            {rawRows.length} Rows Detected
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] font-medium">
                          {rawHeaders.length} CSV Columns • {parsedData.length} Valid Leads Mapped
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* View Tabs */}
                      <div className="bg-[var(--surface-card-elevated)] p-1 rounded-xl border border-[var(--border-subtle)] flex items-center space-x-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setActiveTab('mapping')}
                          className={`px-3 py-1 text-2xs font-extrabold rounded-lg transition-all flex items-center space-x-1.5 ${
                            activeTab === 'mapping'
                              ? 'bg-violet-600 text-white shadow-xs'
                              : 'text-violet-900 hover:bg-violet-50'
                          }`}
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          <span>Header Mapping</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab('preview')}
                          className={`px-3 py-1 text-2xs font-extrabold rounded-lg transition-all flex items-center space-x-1.5 ${
                            activeTab === 'preview'
                              ? 'bg-violet-600 text-white shadow-xs'
                              : 'text-violet-900 hover:bg-violet-50'
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>Lead Record Preview</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          resetForm();
                          setError('');
                          setInfoMessage('');
                        }}
                        className="p-2 rounded-xl hover:bg-rose-100 text-rose-500 transition-colors"
                        title="Change CSV File"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* TAB 1: INTERACTIVE HEADER MAPPING TABLE */}
                  {activeTab === 'mapping' && (
                    <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-xs bg-[var(--surface-card)]">
                      <div className="bg-violet-100/70 px-4 py-2.5 border-b border-violet-200 flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-[var(--text-primary)]">
                          <SlidersHorizontal className="w-4 h-4 text-[var(--text-secondary)]" />
                          <span className="text-xs font-black uppercase tracking-wider">CSV Header Mapping & Real Data Preview</span>
                        </div>
                        <span className="text-2xs font-bold text-violet-600 bg-[var(--surface-card)] px-2.5 py-0.5 rounded-full border border-violet-300">
                          Row 1 Live Sample Values Shown Below
                        </span>
                      </div>

                      <div className="divide-y divide-violet-100 max-h-80 overflow-y-auto">
                        {SYSTEM_FIELDS.map((field) => {
                          const currentMappedCol = headerMapping[field.key] || '';
                          const sampleVal = getSampleValue(field.key);
                          const isMapped = Boolean(currentMappedCol);

                          return (
                            <div
                              key={field.key}
                              className={`p-3 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                                isMapped ? 'bg-[var(--surface-card)] hover:bg-violet-50/30 dark:hover:bg-violet-500/10' : 'bg-[var(--surface-card-header)] hover:bg-[var(--surface-hover)] opacity-80'
                              }`}
                            >
                              {/* Left: System Field Label */}
                              <div className="w-full md:w-56 shrink-0 flex items-center space-x-2">
                                {isMapped ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                                )}
                                <div>
                                  <div className="flex items-center space-x-1.5">
                                    <span className="font-extrabold text-[var(--text-primary)]">{field.label}</span>
                                    {field.required && (
                                      <span className="text-3xs font-extrabold bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded uppercase">Required</span>
                                    )}
                                  </div>
                                  <p className="text-3xs text-[var(--text-muted)] font-mono">Field Key: {field.key}</p>
                                </div>
                              </div>

                              {/* Middle: Mapping Dropdown Selector */}
                              <div className="flex-1 min-w-[200px]">
                                <select
                                  value={currentMappedCol}
                                  onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                  className={`w-full py-1.5 px-3 text-xs font-semibold rounded-xl border focus:outline-none transition-all cursor-pointer ${
                                    isMapped
                                      ? 'border-violet-300 bg-violet-50/40 text-[var(--text-primary)] font-bold focus:ring-2 focus:ring-violet-500/20'
                                      : 'border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] focus:border-violet-400'
                                  }`}
                                >
                                  <option value="">-- (Do Not Import / Unmapped) --</option>
                                  {rawHeaders.map((csvH) => (
                                    <option key={csvH} value={csvH}>
                                      CSV Column: "{csvH}"
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Right: Sample Data Preview Pill */}
                              <div className="w-full md:w-64 shrink-0 text-right">
                                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-gray-100/80 border border-gray-200 max-w-full truncate">
                                  <span className="text-3xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider shrink-0">Row 1:</span>
                                  <span className={`text-2xs font-extrabold truncate ${sampleVal !== '-' ? 'text-[var(--text-primary)] font-mono' : 'text-[var(--text-muted)] italic'}`}>
                                    {sampleVal}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: PARSED LEAD RECORD PREVIEW */}
                  {activeTab === 'preview' && (
                    <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-xs bg-[var(--surface-card)]">
                      <div className="bg-violet-100/70 px-4 py-2.5 border-b border-violet-200 flex items-center justify-between">
                        <span className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">Processed Lead Objects Preview (First 5)</span>
                        <Eye className="w-4 h-4 text-[var(--text-secondary)]" />
                      </div>
                      <div className="divide-y divide-violet-100 max-h-80 overflow-y-auto">
                        {parsedData.slice(0, 5).map((item, idx) => (
                          <div key={idx} className="p-3.5 text-xs flex justify-between items-center hover:bg-violet-50/20 transition-colors">
                            <div className="space-y-0.5">
                              <p className="font-extrabold text-[var(--text-primary)] text-sm">{item.firstName} {item.lastName}</p>
                              <p className="text-[var(--text-secondary)] font-semibold">{item.email}</p>
                              <div className="flex items-center space-x-3 text-3xs text-[var(--text-muted)] font-medium pt-1">
                                <span>Phone: {item.phone || '-'}</span>
                                <span>•</span>
                                <span>City: {item.city || '-'}</span>
                                <span>•</span>
                                <span>Source: {item.sourceName || '-'}</span>
                              </div>
                            </div>
                            <div className="text-right space-y-0.5">
                              <p className="font-bold text-gray-800">{item.jobTitle || 'No Title'}</p>
                              <p className="text-[var(--text-muted)] font-medium">{item.organization || 'No Company'}</p>
                              <p className="text-3xs text-violet-600 font-semibold">{item.industry || 'General Industry'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 pt-4 border-t border-[var(--border-subtle)]">
                {/* Tag Input Box */}
                <div className="flex-1">
                  <label htmlFor="csv-import-tag-input" className="micro-label block mb-1.5">Tag Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-violet-600">
                      <Tag className="w-4 h-4" />
                    </div>
                    <input
                      id="csv-import-tag-input"
                      type="text"
                      value={importTag}
                      onChange={(e) => setImportTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault(); // no surrounding <form>, but keep this inert regardless
                        // Enter auto-uploads only once a real tag name is present; an empty
                        // tag here does nothing (the toolbar button below still falls back
                        // to a filename-based tag on click, unchanged).
                        if (!importTag.trim() || isUploading || parsedData.length === 0) return;
                        handleImportSubmit();
                      }}
                      placeholder="Tag this CSV import (e.g. Q3-Marketing, Event-Leads)..."
                      className="glass-input pl-9 pr-3 !text-xs font-bold focus:!border-violet-500 focus:!ring-2 focus:!ring-violet-500/20 !bg-violet-50/30 dark:!bg-violet-500/10 !border-violet-200 placeholder-violet-400"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isUploading || parsedData.length === 0}
                    onClick={handleImportSubmit}
                    className="btn-primary shrink-0"
                  >
                    {isUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Importing to Operon & Supabase...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Import {parsedData.length} Mapped Leads</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {isOpen && (
      <FileAlreadyUploadedModal
        isOpen={!!pendingFileConflict}
        fileName={file?.name || ''}
        existingTags={pendingFileConflict?.existingTags || []}
        newTag={pendingFileConflict?.newTag || null}
        onChoose={handleFileConflictChoice}
      />
    )}
    </>
  );
}
