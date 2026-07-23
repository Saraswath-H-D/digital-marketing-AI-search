import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database,
  X,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  Code2,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  Sparkles,
  Server
} from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  pushLeadsToSupabase,
  pullLeadsFromSupabase,
  generateSupabaseSQL,
  SupabaseConfig
} from '../lib/supabase';
import { Lead } from '../types';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
  onLeadsUpdated: (leads: Lead[]) => void;
}

export default function SupabaseModal({
  isOpen,
  onClose,
  leads,
  onLeadsUpdated
}: SupabaseModalProps) {
  const [config, setConfig] = useState<SupabaseConfig>(getSupabaseConfig());
  const [activeTab, setActiveTab] = useState<'connect' | 'sql' | 'guide'>('connect');
  const [testing, setTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ success: boolean; message: string } | null>(null);
  
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; text: string } | null>(null);
  
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState<{ success: boolean; text: string } | null>(null);

  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const currentConfig = getSupabaseConfig();
      setConfig(currentConfig);
      setStatusMessage(null);
      setPushResult(null);
      setPullResult(null);
    }
  }, [isOpen]);

  const handleTestConnection = async () => {
    setTesting(true);
    setStatusMessage(null);
    saveSupabaseConfig(config);
    
    const result = await testSupabaseConnection(config);
    setStatusMessage(result);
    setTesting(false);
  };

  const handleSaveConfig = () => {
    saveSupabaseConfig(config);
    handleTestConnection();
  };

  const handlePushToSupabase = async () => {
    setPushing(true);
    setPushResult(null);
    
    const res = await pushLeadsToSupabase(leads, config);
    setPushing(false);

    if (res.success) {
      setPushResult({
        success: true,
        text: `Successfully pushed ${res.count} registration contacts to Supabase table '${config.tableName}'!`
      });
    } else {
      setPushResult({
        success: false,
        text: `Push failed: ${res.error || 'Please verify credentials & table creation.'}`
      });
    }
  };

  const handlePullFromSupabase = async () => {
    setPulling(true);
    setPullResult(null);

    const res = await pullLeadsFromSupabase(config);
    setPulling(false);

    if (res.success) {
      if (res.leads.length === 0) {
        setPullResult({
          success: true,
          text: `Connected to Supabase, but the table '${config.tableName}' currently has 0 rows.`
        });
      } else {
        onLeadsUpdated(res.leads);
        setPullResult({
          success: true,
          text: `Successfully synced ${res.leads.length} contacts from Supabase!`
        });
      }
    } else {
      setPullResult({
        success: false,
        text: `Pull failed: ${res.error || 'Please verify credentials.'}`
      });
    }
  };

  const sqlCode = generateSupabaseSQL(config.tableName || 'registration_contacts');

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="supabase-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            id="supabase-modal-content"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                    Connect with Supabase
                    <span className="text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      PostgreSQL DB
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">Sync Excel registration report contacts directly with your cloud database</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 space-x-6 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('connect')}
                className={`pb-3 flex items-center space-x-2 transition-all border-b-2 ${
                  activeTab === 'connect'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Server className="w-4 h-4" />
                <span>API Credentials & Sync</span>
              </button>
              <button
                onClick={() => setActiveTab('sql')}
                className={`pb-3 flex items-center space-x-2 transition-all border-b-2 ${
                  activeTab === 'sql'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Code2 className="w-4 h-4" />
                <span>SQL Schema Generator</span>
              </button>
              <button
                onClick={() => setActiveTab('guide')}
                className={`pb-3 flex items-center space-x-2 transition-all border-b-2 ${
                  activeTab === 'guide'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                <span>Step-by-Step Guide</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {activeTab === 'connect' && (
                <div className="space-y-5">
                  {/* Credentials Input */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                      <span>Supabase Connection Settings</span>
                      <a
                        href="https://supabase.com/dashboard"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-medium text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        Open Supabase Dashboard
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </h4>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Supabase Project URL
                      </label>
                      <input
                        type="text"
                        value={config.url}
                        onChange={(e) => setConfig({ ...config, url: e.target.value })}
                        placeholder="https://your-project-id.supabase.co"
                        className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Supabase Anon / API Key
                      </label>
                      <input
                        type="password"
                        value={config.anonKey}
                        onChange={(e) => setConfig({ ...config, anonKey: e.target.value })}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Database Table Name
                      </label>
                      <input
                        type="text"
                        value={config.tableName}
                        onChange={(e) => setConfig({ ...config, tableName: e.target.value })}
                        placeholder="registration_contacts"
                        className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Test Connection Button */}
                    <div className="pt-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testing || !config.url || !config.anonKey}
                        className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center space-x-2 shadow-xs"
                      >
                        {testing ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Testing Connection...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Test & Verify Connection</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveConfig}
                        className="px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 underline"
                      >
                        Save Configuration
                      </button>
                    </div>

                    {/* Status Feedback */}
                    {statusMessage && (
                      <div
                        className={`p-3 rounded-lg text-xs font-medium flex items-start space-x-2 border ${
                          statusMessage.success
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-amber-50 border-amber-200 text-amber-800'
                        }`}
                      >
                        {statusMessage.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        )}
                        <span>{statusMessage.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Sync Actions Box */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        Excel Data Synchronization
                      </h4>
                      <span className="text-xs text-slate-500 font-semibold">{leads.length} contacts loaded in Apollo</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Push to Supabase */}
                      <button
                        type="button"
                        onClick={handlePushToSupabase}
                        disabled={pushing || !config.url || !config.anonKey}
                        className="p-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-left transition-all shadow-sm hover:shadow-md disabled:opacity-50 group"
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <UploadCloud className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-bold">Push Excel to Supabase</span>
                        </div>
                        <p className="text-[11px] text-emerald-100 leading-snug">
                          Upload all {leads.length} registration contacts directly into your Supabase SQL table.
                        </p>
                      </button>

                      {/* Pull from Supabase */}
                      <button
                        type="button"
                        onClick={handlePullFromSupabase}
                        disabled={pulling || !config.url || !config.anonKey}
                        className="p-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-left transition-all shadow-sm hover:shadow-md disabled:opacity-50 group"
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <DownloadCloud className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                          <span className="text-xs font-bold">Pull from Supabase</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          Fetch live contacts from your Supabase PostgreSQL table into Apollo.
                        </p>
                      </button>
                    </div>

                    {/* Push Result Banner */}
                    {pushResult && (
                      <div
                        className={`p-3 rounded-lg text-xs font-medium border ${
                          pushResult.success
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-red-50 text-red-800 border-red-200'
                        }`}
                      >
                        {pushResult.text}
                      </div>
                    )}

                    {/* Pull Result Banner */}
                    {pullResult && (
                      <div
                        className={`p-3 rounded-lg text-xs font-medium border ${
                          pullResult.success
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-red-50 text-red-800 border-red-200'
                        }`}
                      >
                        {pullResult.text}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'sql' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Supabase SQL Setup Query
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Run this SQL query in your Supabase SQL Editor to create the exact table schema for this Registration Excel Report.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all flex items-center space-x-1.5 shadow-xs"
                    >
                      {copiedSql ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied SQL!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy SQL Script</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="relative">
                    <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto border border-slate-800 leading-relaxed max-h-72">
                      {sqlCode}
                    </pre>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Tip: Where to run this in Supabase?
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      1. Go to your Supabase Project Dashboard → click <strong>SQL Editor</strong> in the left navigation sidebar.<br />
                      2. Click <strong>+ New query</strong>, paste the script above, and click <strong>Run</strong>.<br />
                      3. Return here and click <strong>Push Excel to Supabase</strong>!
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'guide' && (
                <div className="space-y-4 text-xs text-slate-700">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    How to connect Apollo with Supabase (3 Simple Steps)
                  </h4>

                  <div className="space-y-3">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <div className="font-bold text-slate-900 flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">1</span>
                        <span>Create or select a Supabase Project</span>
                      </div>
                      <p className="text-slate-600 pl-7 leading-relaxed">
                        Go to <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-emerald-600 font-semibold underline">supabase.com</a> and sign in. Create a new free project or select an existing project.
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <div className="font-bold text-slate-900 flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">2</span>
                        <span>Get your Project URL & Anon Key</span>
                      </div>
                      <p className="text-slate-600 pl-7 leading-relaxed">
                        In your Supabase project dashboard, navigate to <strong>Project Settings → API</strong>. Copy your <strong>Project URL</strong> and <strong>anon / public API key</strong> and paste them into the credentials tab above.
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <div className="font-bold text-slate-900 flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">3</span>
                        <span>Create the table & push Excel Sheet</span>
                      </div>
                      <p className="text-slate-600 pl-7 leading-relaxed">
                        Copy the SQL query from the <strong>SQL Schema Generator</strong> tab, run it in Supabase SQL Editor, then click <strong>Push Excel to Supabase</strong> to sync all 51+ registrants!
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {leads.length} contacts available for Supabase sync
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors shadow-xs"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
