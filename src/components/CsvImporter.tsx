import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, Check, AlertCircle, FileSpreadsheet, Eye, ArrowRight, Table, Tag } from 'lucide-react';
import { replaceActiveHeaders, getStoredLeads } from '../data/leadStorage.ts';

interface CsvImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: any[]) => Promise<boolean>;
}

export default function CsvImporter({ isOpen, onClose, onImport }: CsvImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importTag, setImportTag] = useState('');
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
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
      setParsedData([]);
      return;
    }

    setError('');
    setFile(selectedFile);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parse warnings:', results.errors);
        }

        const data = results.data as any[];
        if (data.length === 0) {
          setError('The uploaded CSV file is empty.');
          setParsedData([]);
          return;
        }

        const rawHeaders = (results.meta.fields || (data[0] ? Object.keys(data[0]) : [])).map(h => h.trim()).filter(Boolean);
        if (rawHeaders.length > 0) {
          replaceActiveHeaders(rawHeaders);
        }


        // Map column names flexibly to lead fields
        const mapped = data.map((r: any) => {
          const keys = Object.keys(r);
          const leadObj: any = {
            _csvHeaders: rawHeaders
          };

          // Store exact CSV header key-values directly on the lead object
          keys.forEach(k => {
            if (k.trim()) {
              leadObj[k.trim()] = r[k];
            }
          });

          const findVal = (possibleKeys: string[], excludeSubstring: string[] = []) => {
            // 1. Exact match first
            let matchedKey = keys.find(k => {
              const cleanK = k.toLowerCase().trim();
              if (excludeSubstring.some(ex => cleanK.includes(ex))) return false;
              return possibleKeys.some(pk => cleanK === pk.toLowerCase().trim());
            });

            // 2. Controlled substring match
            if (!matchedKey) {
              matchedKey = keys.find(k => {
                const cleanK = k.toLowerCase().trim();
                if (excludeSubstring.some(ex => cleanK.includes(ex))) return false;
                return possibleKeys.some(pk => cleanK.includes(pk.toLowerCase().trim()));
              });
            }
            return matchedKey ? String(r[matchedKey]).trim() : '';
          };

          // Explicit First Name and Last Name column lookups
          let fName = findVal(['first name', 'firstname', 'fname', 'first_name']);
          let lName = findVal(['last name', 'lastname', 'lname', 'last_name', 'surname']);

          // Full Name column lookups
          const fullName = findVal(['full name', 'fullname', 'contact name', 'contact person', 'person name', 'attendee name', 'name of attendee', 'name', 'attendee']);

          if (!fName && fullName) {
            const parts = fullName.split(/\s+/);
            fName = parts[0] || '';
            lName = parts.slice(1).join(' ');
          }

          const rawEmail = findVal(
            ['email', 'email address', 'primary email', 'work email', 'mail', 'e-mail', 'contact email'],
            ['status', 'secondary', 'alt', 'backup', 'validation', 'verified', 'flag']
          );

          const extractedSource = findVal(
            ['source name', 'source_name', 'lead source', 'lead_source', 'registration source', 'source', 'channel', 'utm_source'],
            ['resource', 'sourcecode', 'outsource', 'status']
          );

          const cleanVal = (val: any) => {
            if (val === undefined || val === null) return '-';
            const str = String(val).trim();
            return (str === '' || str === 'undefined' || str === 'null') ? '-' : str;
          };

          // Populate standard attributes for filters, searching, and Supabase
          leadObj.firstName = cleanVal(fName);
          leadObj.lastName = cleanVal(lName);
          leadObj.email = cleanVal(rawEmail);
          leadObj.organization = cleanVal(findVal(['organization', 'company', 'employer', 'business', 'org', 'firm']));
          leadObj.jobTitle = cleanVal(findVal(['job title', 'jobtitle', 'title', 'role', 'designation', 'position', 'occupation']));
          leadObj.city = cleanVal(findVal(['city', 'location', 'town', 'country', 'state', 'address', 'region']));
          leadObj.phone = cleanVal(findVal(['phone', 'phone number', 'mobile', 'telephone', 'contact number', 'cell']));
          leadObj.approvalStatus = cleanVal(findVal(['approval status', 'status', 'approved', 'state']) || 'approved');
          leadObj.questions = cleanVal(findVal(['do have any questions to speaker!', 'questions', 'question', 'inquiry', 'notes', 'comments', 'remarks']));
          leadObj.sourceName = extractedSource ? extractedSource.trim().replace(/\s+/g, '-') : '-';

          const hasAnyRowData = Object.values(r).some(v => v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '-');
          return hasAnyRowData ? leadObj : null;
        }).filter(Boolean) as any[];

 // Must have at least name and email

        if (mapped.length === 0) {
          setError('Could not extract any valid leads with name and email columns. Check header titles.');
          setParsedData([]);
        } else {
          setParsedData(mapped);
        }
      },
      error: (err) => {
        setError(`Failed to parse file: ${err.message}`);
        setParsedData([]);
      }
    });
  };

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

  const handleImportSubmit = async () => {
    if (parsedData.length === 0) return;
    setIsUploading(true);
    
    // Attach custom import tag or file name to each lead
    const fileNameTag = file ? file.name.replace(/\.csv$/i, '').trim().replace(/\s+/g, '-') : 'CSV-Import';
    const finalTag = (importTag && importTag.trim()) ? importTag.trim().replace(/\s+/g, '-') : fileNameTag;

    const finalData = parsedData.map(item => ({
      ...item,
      sourceName: finalTag
    }));

    const success = await onImport(finalData);
    
    setIsUploading(false);
    if (success) {
      setFile(null);
      setParsedData([]);
      setImportTag('');
      onClose();
    } else {
      setError('Import failed. Please check backend connection and try again.');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="csv-importer-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            id="csv-importer-content"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center space-x-2 text-gray-800">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold tracking-tight">Bulk Import Attendees</h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Drag & Drop Area */}
              {!file ? (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragActive
                      ? 'border-indigo-500 bg-indigo-50/50 scale-99'
                      : 'border-gray-200 hover:border-indigo-400 hover:bg-gray-50/50'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv"
                    className="hidden"
                  />
                  <Upload className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-800">Drag & drop your CSV file here</p>
                  <p className="text-xs text-gray-400 mt-1">or click to browse your files (CSV only)</p>
                  
                  <div className="mt-5 inline-flex items-center space-x-4 text-xs font-semibold text-gray-400">
                    <span>Expected headers:</span>
                    <span className="bg-gray-100 px-2 py-0.5 rounded-md">First Name</span>
                    <span className="bg-gray-100 px-2 py-0.5 rounded-md">Email</span>
                    <span className="bg-gray-100 px-2 py-0.5 rounded-md">Organization</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* File status */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-150 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Table className="w-8 h-8 text-indigo-600 bg-indigo-50 rounded-lg p-1.5" />
                      <div>
                        <p className="text-sm font-semibold text-gray-800 truncate max-w-md">{file.name}</p>
                        <p className="text-xs text-gray-450 font-semibold">{parsedData.length} valid lead records detected</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setFile(null);
                        setParsedData([]);
                        setError('');
                      }}
                      className="p-1 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Preview Area */}
                  {parsedData.length > 0 && (
                    <div className="border border-gray-150 rounded-lg overflow-hidden">
                      <div className="bg-gray-50/50 px-4 py-2 border-b border-gray-150 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead Record Preview (First 3)</span>
                        <Eye className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                        {parsedData.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="p-3 text-xs flex justify-between items-center">
                            <div>
                              <p className="font-semibold text-gray-850">{item.firstName} {item.lastName}</p>
                              <p className="text-gray-400">{item.email}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-600 truncate max-w-xs">{item.jobTitle || 'No Title'}</p>
                              <p className="text-gray-400 text-2xs">{item.organization || 'No Company'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons & Tag Input */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-gray-100">
                {/* Tag Input Box beside Import Button */}
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-indigo-500">
                    <Tag className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={importTag}
                    onChange={(e) => setImportTag(e.target.value)}
                    placeholder="Tag this CSV import (e.g. Q3-Marketing, Event-Leads)..."
                    className="w-full pl-8.5 pr-3 py-2 text-xs font-semibold border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-indigo-50/20 text-slate-800 placeholder-slate-400 transition-all shadow-2xs"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 focus:outline-none transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isUploading || parsedData.length === 0}
                    onClick={handleImportSubmit}
                    className="px-5 py-2 text-xs font-black text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer active:scale-95 shrink-0"
                  >
                    {isUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Importing...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Import {parsedData.length} Leads</span>
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
  );
}
