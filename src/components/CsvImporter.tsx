import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, Check, AlertCircle, FileSpreadsheet, Eye, ArrowRight, Table } from 'lucide-react';
import { setActiveHeaders } from '../data/leadStorage.ts';


interface CsvImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: any[]) => Promise<boolean>;
}

export default function CsvImporter({ isOpen, onClose, onImport }: CsvImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
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
          setActiveHeaders(rawHeaders);
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
            let matchedKey = keys.find(k => 
              possibleKeys.some(pk => k.toLowerCase().trim() === pk.toLowerCase().trim())
            );

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

          // Full Name column lookups (covers 'name', 'full name', 'contact name', 'contacts', 'attendee', etc.)
          const fullName = findVal(['full name', 'fullname', 'contact name', 'contact person', 'person name', 'attendee name', 'name of attendee', 'participant name', 'delegate name', 'lead name', 'contacts', 'contact', 'name', 'names', 'attendee', 'participant', 'delegate']);

          if (!fName && fullName) {
            const parts = fullName.split(/\s+/);
            fName = parts[0] || '';
            lName = parts.slice(1).join(' ');
          } else if (fName && !lName && fName.includes(' ')) {
            const parts = fName.split(/\s+/);
            fName = parts[0] || '';
            lName = parts.slice(1).join(' ');
          }

          const rawEmail = findVal(['email', 'email address', 'mail', 'e-mail', 'contact email']);

          // Fallback to name from email if name is still missing
          if (!fName && rawEmail && rawEmail.includes('@')) {
            const username = rawEmail.split('@')[0];
            const cleanUser = username.replace(/[^a-zA-Z0-9._-]/g, '');
            const parts = cleanUser.split(/[._-]/).filter(Boolean);
            if (parts.length > 0) {
              fName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
              if (parts.length > 1 && !lName) {
                lName = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
              }
            }
          }

          // Clean fallback default source from file name
          let defaultSource = selectedFile.name
            .replace(/\.csv$/i, '')
            .replace(/^apollo_?(contacts|leads)_?(export_?)?/i, '')
            .replace(/[-_]/g, ' ')
            .trim();

          if (!defaultSource || /^export$|^contacts$|^leads$|^data$|^file$|^sheet$/i.test(defaultSource)) {
            defaultSource = 'Registration Report';
          } else {
            defaultSource = defaultSource
              .split(/\s+/)
              .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ');
          }

          const extractedSource = findVal(
            ['source name', 'source_name', 'lead source', 'lead_source', 'registration source', 'source', 'channel', 'utm_source', 'source medium'],
            ['resource', 'sourcecode', 'outsource']
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
          leadObj.registrationTime = cleanVal(findVal(['registration time', 'time', 'registered', 'date', 'created at']));

          return leadObj;
        }).filter(item => item.firstName || item.email);

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
    
    const success = await onImport(parsedData);
    
    setIsUploading(false);
    if (success) {
      setFile(null);
      setParsedData([]);
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

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-hidden transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUploading || parsedData.length === 0}
                  onClick={handleImportSubmit}
                  className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center space-x-1.5"
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
