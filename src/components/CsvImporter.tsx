import React, { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, Check, AlertCircle, FileSpreadsheet, Eye, ArrowRight, Table, Tag, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { setActiveHeaders, normalizeCityName, normalizeNameOrTitle } from '../data/leadStorage.ts';

interface CsvImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: any[]) => Promise<boolean>;
}

// System 18 Standard Headers Configuration & Auto-Detect Aliases
const SYSTEM_FIELDS = [
  { key: 'firstName', label: 'First Name', required: true, aliases: ['fast name', 'first name', 'firstname', 'fname', 'first_name', 'f_name', 'given name', 'given_name', 'f name', 'first'] },
  { key: 'lastName', label: 'Last Name', required: false, aliases: ['lastname', 'last name', 'lname', 'last_name', 'l_name', 'surname', 'family name', 'family_name', 'l name', 'last'] },
  { key: 'email', label: 'Email', required: true, aliases: ['email', 'email address', 'primary email', 'work email', 'mail', 'e-mail', 'contact email', 'email_id', 'emailid'] },
  { key: 'phone', label: 'Phone Number', required: false, aliases: ['phone number', 'phone', 'mobile', 'telephone', 'contact number', 'cell', 'phone_no', 'mobile_no', 'phone_number'] },
  { key: 'jobTitle', label: 'Job Title', required: false, aliases: ['jobtitle', 'job title', 'title', 'role', 'designation', 'position', 'occupation', 'job_title'] },
  { key: 'organization', label: 'Company Name', required: false, aliases: ['companyname', 'company name', 'company', 'organization', 'org', 'employer', 'business', 'firm', 'company_name', 'organization_name'] },
  { key: 'city', label: 'City', required: false, aliases: ['city', 'city_name', 'town', 'address', 'person location', 'location'] },
  { key: 'state', label: 'State', required: false, aliases: ['state', 'province', 'state_name', 'region'] },
  { key: 'country', label: 'Country', required: false, aliases: ['country', 'nation', 'country_name'] },
  { key: 'sourceName', label: 'Source', required: false, aliases: ['source', 'source name', 'source_name', 'lead source', 'lead_source', 'registration source', 'channel', 'utm_source'] },
  { key: 'emailStatus', label: 'Email Status', required: false, aliases: ['email status', 'email verification status', 'email_status', 'verification status', 'deliverability', 'email_verification_status'] },
  { key: 'seniority', label: 'Seniority', required: false, aliases: ['seniority', 'management level', 'seniority level', 'level', 'seniority_level', 'job level', 'experience level'] },
  { key: 'department', label: 'Department', required: false, aliases: ['department', 'dept', 'function', 'team', 'department_name', 'business unit'] },
  { key: 'industry', label: 'Industry', required: false, aliases: ['industry', 'sector', 'market sector', 'domain', 'business_type', 'industry_name'] },
  { key: 'companySize', label: 'Employee Size', required: false, aliases: ['employee size', 'company size', 'employee headcount', 'headcount', 'no of employees', 'number of employees', 'employees', 'company_size', 'employee_size'] },
  { key: 'linkedinUrl', label: 'Person Linkedin Url', required: false, aliases: ['person linkdin url', 'person linkedin url', 'linkedin', 'linkedin url', 'linkedin_url', 'person linkedin', 'linkedin profile', 'profile url'] },
  { key: 'website', label: 'Website', required: false, aliases: ['website', 'company website', 'url', 'web', 'domain', 'company url', 'site'] },
  { key: 'companyLinkedinUrl', label: 'Company Linkedin Url', required: false, aliases: ['company linkdin url', 'company linkedin url', 'company linkedin', 'company_linkedin_url', 'org linkedin', 'organization linkedin'] },
];

export default function CsvImporter({ isOpen, onClose, onImport }: CsvImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headerMapping, setHeaderMapping] = useState<Record<string, string>>({});
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importTag, setImportTag] = useState('');
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'mapping' | 'preview'>('mapping');
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

  // Helper to find best matching CSV column for a system field
  const autoDetectColumn = (field: typeof SYSTEM_FIELDS[0], csvHeaders: string[]): string => {
    // 1. Exact match first
    for (const csvH of csvHeaders) {
      const cleanH = csvH.toLowerCase().trim();
      if (field.aliases.some(alias => cleanH === alias.toLowerCase().trim())) {
        return csvH;
      }
    }
    // 2. Substring match
    for (const csvH of csvHeaders) {
      const cleanH = csvH.toLowerCase().trim();
      if (field.aliases.some(alias => cleanH.includes(alias.toLowerCase().trim()))) {
        return csvH;
      }
    }
    return '';
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
          setRawHeaders([]);
          setRawRows([]);
          setParsedData([]);
          return;
        }

        const headers = (results.meta.fields || (data[0] ? Object.keys(data[0]) : []))
          .map(h => h.trim())
          .filter(Boolean);

        if (headers.length > 0) {
          setActiveHeaders(headers);
        }

        setRawHeaders(headers);
        setRawRows(data);

        // Auto-detect initial header mapping
        const initialMapping: Record<string, string> = {};
        SYSTEM_FIELDS.forEach(field => {
          initialMapping[field.key] = autoDetectColumn(field, headers);
        });

        // Special handling for full name if separate first/last name columns aren't found
        if (!initialMapping.firstName) {
          const fullNameCol = headers.find(h => ['full name', 'fullname', 'contact name', 'attendee name', 'name'].includes(h.toLowerCase().trim()));
          if (fullNameCol) {
            initialMapping.firstName = fullNameCol;
          }
        }

        setHeaderMapping(initialMapping);
      },
      error: (err) => {
        setError(`Failed to parse CSV file: ${err.message}`);
        setRawHeaders([]);
        setRawRows([]);
        setParsedData([]);
      }
    });
  };

  // Re-compute parsedData whenever rawRows or headerMapping changes
  useEffect(() => {
    if (rawRows.length === 0) {
      setParsedData([]);
      return;
    }

    const mappedLeads = rawRows.map((r: any) => {
      const getVal = (sysKey: string): string => {
        const mappedCsvHeader = headerMapping[sysKey];
        if (!mappedCsvHeader || r[mappedCsvHeader] === undefined || r[mappedCsvHeader] === null) {
          return '';
        }
        return String(r[mappedCsvHeader]).trim();
      };

      let fName = getVal('firstName');
      let lName = getVal('lastName');

      // If First Name mapping points to a full name column, split it
      if (fName && (!lName || lName === '-') && fName.includes(' ')) {
        const parts = fName.split(/\s+/);
        fName = parts[0] || '';
        lName = parts.slice(1).join(' ');
      }

      const cleanVal = (val: any) => {
        if (val === undefined || val === null) return '-';
        const str = String(val).trim();
        return (str === '' || str === 'undefined' || str === 'null') ? '-' : str;
      };

      const leadObj: any = {
        _csvHeaders: rawHeaders,
        firstName: normalizeNameOrTitle(fName),
        lastName: normalizeNameOrTitle(lName),
        email: cleanVal(getVal('email')),
        phone: cleanVal(getVal('phone')),
        jobTitle: normalizeNameOrTitle(getVal('jobTitle')),
        organization: normalizeNameOrTitle(getVal('organization')),
        city: normalizeCityName(getVal('city')),
        state: cleanVal(getVal('state')),
        country: cleanVal(getVal('country')),
        sourceName: getVal('sourceName') ? getVal('sourceName').replace(/\s+/g, '-') : '-',
        emailStatus: cleanVal(getVal('emailStatus')) || 'Verified',
        seniority: cleanVal(getVal('seniority')),
        department: cleanVal(getVal('department')),
        industry: cleanVal(getVal('industry')),
        companySize: cleanVal(getVal('companySize')),
        linkedinUrl: cleanVal(getVal('linkedinUrl')),
        website: cleanVal(getVal('website')),
        companyLinkedinUrl: cleanVal(getVal('companyLinkedinUrl')),
        registrationTime: cleanVal(getVal('registrationTime') || new Date().toLocaleString()),
        approvalStatus: cleanVal(getVal('approvalStatus') || 'approved'),
        questions: cleanVal(getVal('questions')),
      };

      // Also copy all original raw CSV fields onto lead object for custom field support
      Object.keys(r).forEach(k => {
        if (k.trim()) leadObj[k.trim()] = r[k];
      });

      const hasAnyData = Object.values(r).some(v => v !== undefined && v !== null && String(v).trim() !== '');
      return hasAnyData ? leadObj : null;
    }).filter(Boolean);

    setParsedData(mappedLeads);
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

  const handleImportSubmit = async () => {
    if (parsedData.length === 0) return;
    setIsUploading(true);

    const fileNameTag = file ? file.name.replace(/\.csv$/i, '').trim().replace(/\s+/g, '-') : 'CSV-Import';
    const finalTag = (importTag && importTag.trim()) ? importTag.trim().replace(/\s+/g, '-') : fileNameTag;

    const finalData = parsedData.map(item => ({
      ...item,
      sourceName: (item.sourceName && item.sourceName !== '-') ? item.sourceName : finalTag
    }));

    const success = await onImport(finalData);

    setIsUploading(false);
    if (success) {
      setFile(null);
      setRawHeaders([]);
      setRawRows([]);
      setHeaderMapping({});
      setParsedData([]);
      setImportTag('');
      onClose();
    } else {
      setError('Import failed. Please check your backend connection and try again.');
    }
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
    <AnimatePresence>
      {isOpen && (
        <div id="csv-importer-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <motion.div
            id="csv-importer-content"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden my-6 flex flex-col max-h-[90vh]"
          >
            {/* Modal Top Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-white border-b border-gray-150 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-purple-950 tracking-tight">Bulk Import Contacts & Mapping</h3>
                  <p className="text-2xs text-purple-700/80 font-medium">Upload CSV, map header columns, and import into Operon directory & Supabase</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-purple-100/80 text-gray-400 hover:text-gray-700 transition-colors"
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
                      ? 'border-purple-500 bg-purple-50/60 scale-[0.99]'
                      : 'border-purple-200 hover:border-purple-400 hover:bg-purple-50/30'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv"
                    className="hidden"
                  />
                  <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-3.5 shadow-sm">
                    <Upload className="w-7 h-7" />
                  </div>
                  <p className="text-base font-bold text-purple-950">Drag & drop your CSV file here</p>
                  <p className="text-xs text-purple-700/70 font-medium mt-1">or click to browse your computer files (CSV only)</p>

                  <div className="mt-6 flex items-center justify-center flex-wrap gap-2 text-2xs font-bold text-gray-500">
                    <span className="text-gray-400 uppercase tracking-widest">Supported Headers:</span>
                    <span className="bg-purple-100/80 text-purple-900 px-2.5 py-1 rounded-lg">First Name</span>
                    <span className="bg-purple-100/80 text-purple-900 px-2.5 py-1 rounded-lg">Last Name</span>
                    <span className="bg-purple-100/80 text-purple-900 px-2.5 py-1 rounded-lg">Email</span>
                    <span className="bg-purple-100/80 text-purple-900 px-2.5 py-1 rounded-lg">Phone Number</span>
                    <span className="bg-purple-100/80 text-purple-900 px-2.5 py-1 rounded-lg">Job Title</span>
                    <span className="bg-purple-100/80 text-purple-900 px-2.5 py-1 rounded-lg">Company Name</span>
                    <span className="bg-purple-100/80 text-purple-900 px-2.5 py-1 rounded-lg">City & 11 More</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* File Metadata Header Bar */}
                  <div className="flex items-center justify-between p-3.5 bg-purple-50/70 border border-purple-200/90 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                        <Table className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-extrabold text-purple-950 truncate max-w-sm">{file.name}</p>
                          <span className="px-2 py-0.5 text-3xs font-extrabold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                            {rawRows.length} Rows Detected
                          </span>
                        </div>
                        <p className="text-xs text-purple-700 font-medium">
                          {rawHeaders.length} CSV Columns • {parsedData.length} Valid Leads Mapped
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* View Tabs */}
                      <div className="bg-white p-1 rounded-xl border border-purple-200 flex items-center space-x-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setActiveTab('mapping')}
                          className={`px-3 py-1 text-2xs font-extrabold rounded-lg transition-all flex items-center space-x-1.5 ${
                            activeTab === 'mapping'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'text-purple-900 hover:bg-purple-50'
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
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'text-purple-900 hover:bg-purple-50'
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>Lead Record Preview</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          setRawHeaders([]);
                          setRawRows([]);
                          setHeaderMapping({});
                          setParsedData([]);
                          setError('');
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
                    <div className="border border-purple-200 rounded-xl overflow-hidden shadow-xs bg-white">
                      <div className="bg-purple-100/70 px-4 py-2.5 border-b border-purple-200 flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-purple-950">
                          <SlidersHorizontal className="w-4 h-4 text-purple-700" />
                          <span className="text-xs font-black uppercase tracking-wider">CSV Header Mapping & Real Data Preview</span>
                        </div>
                        <span className="text-2xs font-bold text-purple-800 bg-white px-2.5 py-0.5 rounded-full border border-purple-300">
                          Row 1 Live Sample Values Shown Below
                        </span>
                      </div>

                      <div className="divide-y divide-purple-100 max-h-80 overflow-y-auto">
                        {SYSTEM_FIELDS.map((field) => {
                          const currentMappedCol = headerMapping[field.key] || '';
                          const sampleVal = getSampleValue(field.key);
                          const isMapped = Boolean(currentMappedCol);

                          return (
                            <div
                              key={field.key}
                              className={`p-3 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                                isMapped ? 'bg-white hover:bg-purple-50/30' : 'bg-gray-50/50 hover:bg-gray-100/50 opacity-80'
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
                                    <span className="font-extrabold text-purple-950">{field.label}</span>
                                    {field.required && (
                                      <span className="text-3xs font-extrabold bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded uppercase">Required</span>
                                    )}
                                  </div>
                                  <p className="text-3xs text-gray-400 font-mono">Field Key: {field.key}</p>
                                </div>
                              </div>

                              {/* Middle: Mapping Dropdown Selector */}
                              <div className="flex-1 min-w-[200px]">
                                <select
                                  value={currentMappedCol}
                                  onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                  className={`w-full py-1.5 px-3 text-xs font-semibold rounded-xl border focus:outline-none transition-all cursor-pointer ${
                                    isMapped
                                      ? 'border-purple-300 bg-purple-50/40 text-purple-950 font-bold focus:ring-2 focus:ring-purple-500/20'
                                      : 'border-gray-200 bg-white text-gray-400 focus:border-purple-400'
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
                                  <span className="text-3xs font-extrabold text-gray-400 uppercase tracking-wider shrink-0">Row 1:</span>
                                  <span className={`text-2xs font-extrabold truncate ${sampleVal !== '-' ? 'text-slate-800 font-mono' : 'text-gray-400 italic'}`}>
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
                    <div className="border border-purple-200 rounded-xl overflow-hidden shadow-xs bg-white">
                      <div className="bg-purple-100/70 px-4 py-2.5 border-b border-purple-200 flex items-center justify-between">
                        <span className="text-xs font-black text-purple-950 uppercase tracking-wider">Processed Lead Objects Preview (First 5)</span>
                        <Eye className="w-4 h-4 text-purple-700" />
                      </div>
                      <div className="divide-y divide-purple-100 max-h-80 overflow-y-auto">
                        {parsedData.slice(0, 5).map((item, idx) => (
                          <div key={idx} className="p-3.5 text-xs flex justify-between items-center hover:bg-purple-50/20 transition-colors">
                            <div className="space-y-0.5">
                              <p className="font-extrabold text-purple-950 text-sm">{item.firstName} {item.lastName}</p>
                              <p className="text-purple-700 font-semibold">{item.email}</p>
                              <div className="flex items-center space-x-3 text-3xs text-gray-500 font-medium pt-1">
                                <span>Phone: {item.phone || '-'}</span>
                                <span>•</span>
                                <span>City: {item.city || '-'}</span>
                                <span>•</span>
                                <span>Source: {item.sourceName || '-'}</span>
                              </div>
                            </div>
                            <div className="text-right space-y-0.5">
                              <p className="font-bold text-gray-800">{item.jobTitle || 'No Title'}</p>
                              <p className="text-gray-500 font-medium">{item.organization || 'No Company'}</p>
                              <p className="text-3xs text-purple-600 font-semibold">{item.industry || 'General Industry'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-gray-150">
                {/* Tag Input Box */}
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-purple-600">
                    <Tag className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={importTag}
                    onChange={(e) => setImportTag(e.target.value)}
                    placeholder="Tag this CSV import (e.g. Q3-Marketing, Event-Leads)..."
                    className="w-full pl-9 pr-3 py-2 text-xs font-bold border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-purple-50/30 text-purple-950 placeholder-purple-400 transition-all shadow-2xs"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-xs font-extrabold text-purple-950 bg-white border border-purple-200 rounded-xl hover:bg-purple-50 focus:outline-none transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isUploading || parsedData.length === 0}
                    onClick={handleImportSubmit}
                    className="px-6 py-2.5 text-xs font-black text-white bg-purple-600 rounded-xl hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center space-x-2 cursor-pointer active:scale-95 shrink-0"
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
  );
}
