import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, Check, AlertCircle, FileSpreadsheet, Table, Tag, CheckCircle2 } from 'lucide-react';
import { COMPANY_FIELDS, parseCsvFile, buildAutoMapping, mapRowsToCompanies, isCsvParseError } from '../lib/csvMapping.ts';
import { previewBulkImportCompanyDuplicates, CompanyDuplicatePreviewResult } from '../data/companyStorage.ts';
import ImportDuplicateChoiceModal from './ImportDuplicateChoiceModal.tsx';

interface CompanyImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: any[], options?: { includeDuplicates?: boolean }) => Promise<boolean>;
}

// Structurally the same flow as CsvImporter.tsx (parse -> map -> duplicate check ->
// import), trimmed down for Companies: no file-hash "already uploaded this exact file"
// check and no tag-uniqueness gate — podTag is a simple per-batch label here (wrapped
// into Company.podTags on save, see companyStorage.ts and types.ts), not the
// campaign-style identity CSV leads' csvTag is, so there's nothing to warn about
// reusing it.
export default function CompanyImporter({ isOpen, onClose, onImport }: CompanyImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headerMapping, setHeaderMapping] = useState<Record<string, string>>({});
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [podTag, setPodTag] = useState('');
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [pendingDuplicateChoice, setPendingDuplicateChoice] = useState<{ preview: CompanyDuplicatePreviewResult; finalPodTag: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragActive(true);
    else if (e.type === 'dragleave') setIsDragActive(false);
  };

  const processFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Only CSV files are supported.');
      return;
    }
    setError('');
    setFile(selectedFile);

    parseCsvFile(selectedFile).then((result) => {
      if (isCsvParseError(result)) {
        setError(result.error);
        setRawHeaders([]);
        setRawRows([]);
        setParsedData([]);
        return;
      }
      const { headers, rows } = result;
      setRawHeaders(headers);
      setRawRows(rows);
      setHeaderMapping(buildAutoMapping(headers, COMPANY_FIELDS));
    });
  };

  useEffect(() => {
    if (rawRows.length === 0) { setParsedData([]); return; }
    setParsedData(mapRowsToCompanies(rawRows, headerMapping));
  }, [rawRows, headerMapping]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  };

  const resetForm = () => {
    setFile(null);
    setRawHeaders([]);
    setRawRows([]);
    setHeaderMapping({});
    setParsedData([]);
    setPodTag('');
  };

  const buildFinalData = (finalPodTag: string | null) =>
    parsedData.map(item => ({ ...item, podTag: finalPodTag }));

  const doActualImport = async (finalPodTag: string | null, includeDuplicates: boolean) => {
    setIsUploading(true);
    const finalData = buildFinalData(finalPodTag);
    const success = await onImport(finalData, { includeDuplicates });
    setIsUploading(false);
    if (success) {
      resetForm();
      onClose();
    } else {
      setError('Import failed. Please check your backend connection and try again.');
    }
  };

  const handleImportSubmit = async () => {
    if (parsedData.length === 0 || isUploading) return;
    const finalPodTag = podTag.trim() ? podTag.trim().replace(/\s+/g, '-') : null;

    setIsCheckingDuplicates(true);
    let preview: CompanyDuplicatePreviewResult;
    try {
      preview = await previewBulkImportCompanyDuplicates(buildFinalData(finalPodTag));
    } finally {
      setIsCheckingDuplicates(false);
    }

    if (preview.duplicatesSkipped > 0) {
      setPendingDuplicateChoice({ preview, finalPodTag });
      return;
    }
    await doActualImport(finalPodTag, false);
  };

  const handleDuplicateChoice = async (choice: 'only-new' | 'full-file') => {
    const pending = pendingDuplicateChoice;
    setPendingDuplicateChoice(null);
    if (!pending) return;
    await doActualImport(pending.finalPodTag, choice === 'full-file');
  };

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="w-full max-w-3xl glass-modal overflow-hidden my-6 flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-50 via-indigo-50/50 to-transparent dark:from-violet-500/10 dark:via-transparent dark:to-transparent border-b border-[var(--border-subtle)] shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-md">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight">Import Companies</h3>
                  <p className="text-2xs text-[var(--text-muted)] font-medium">Upload a CSV of companies</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {error && (
                <div className="p-3.5 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold border border-rose-200 flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <span>{error}</span>
                </div>
              )}

              {!file ? (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                    isDragActive ? 'border-violet-500 bg-violet-50/60 scale-[0.99]' : 'border-violet-200 hover:border-violet-400 hover:bg-violet-50/30'
                  }`}
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                  <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center mx-auto mb-3.5 shadow-sm">
                    <Upload className="w-7 h-7" />
                  </div>
                  <p className="text-base font-bold text-[var(--text-primary)]">Drag & drop your CSV file here</p>
                  <p className="text-xs text-[var(--text-muted)] font-medium mt-1">or click to browse (CSV only)</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 bg-violet-50/70 dark:bg-violet-500/10 border border-violet-200/90 dark:border-violet-400/20 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-xs">
                        <Table className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-[var(--text-primary)] truncate max-w-sm">{file.name}</p>
                        <p className="text-xs text-[var(--text-secondary)] font-medium">{rawHeaders.length} CSV Columns • {parsedData.length} Companies Mapped</p>
                      </div>
                    </div>
                    <button onClick={resetForm} className="p-2 rounded-xl hover:bg-rose-100 text-rose-500 transition-colors" title="Change CSV File">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-xs bg-[var(--surface-card)]">
                    <div className="bg-violet-100/70 px-4 py-2.5 border-b border-violet-200">
                      <span className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">Preview (first 5)</span>
                    </div>
                    <div className="divide-y divide-violet-100 max-h-72 overflow-y-auto">
                      {parsedData.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="p-3 text-xs flex justify-between items-center">
                          <div>
                            <p className="font-extrabold text-[var(--text-primary)]">{item.name}</p>
                            <p className="text-[var(--text-muted)]">{item.domain || 'No domain'} • {item.industry || 'No industry'}</p>
                          </div>
                          <p className="text-[var(--text-muted)]">{item.city || '-'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 pt-4 border-t border-[var(--border-subtle)]">
                <div className="flex-1">
                  <label className="micro-label block mb-1.5">Pod / Group Tag (optional)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-violet-600">
                      <Tag className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={podTag}
                      onChange={(e) => setPodTag(e.target.value)}
                      placeholder="Which pod is this for? (e.g. Pod-A)"
                      className="glass-input pl-9 pr-3 !text-xs font-bold"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end space-x-2.5">
                  <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                  <button
                    type="button"
                    disabled={isUploading || isCheckingDuplicates || parsedData.length === 0}
                    onClick={handleImportSubmit}
                    className="btn-primary shrink-0"
                  >
                    {isUploading ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Importing...</span></>
                    ) : isCheckingDuplicates ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Checking for duplicates...</span></>
                    ) : (
                      <><Check className="w-4 h-4" /><span>Import {parsedData.length} Companies</span></>
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
      <ImportDuplicateChoiceModal
        isOpen={!!pendingDuplicateChoice}
        preview={pendingDuplicateChoice?.preview || null}
        fileName={file?.name}
        onChoose={handleDuplicateChoice}
        onCancel={() => setPendingDuplicateChoice(null)}
      />
    )}
    </>
  );
}
