import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Mail, Target, Copy, Check, RotateCcw, 
  Brain, User, Lightbulb, Send, X, ArrowRight, ArrowLeft,
  Briefcase, MapPin, Building, HelpCircle, Loader2, MessageSquare, Flame,
  Search, Plus, Edit3, Trash2, Zap, Terminal, CheckCircle2
} from 'lucide-react';
import { Lead, Filters, FilterOptions } from '../types.ts';
import { processNaturalLanguageCommand, AICommandResult } from '../lib/aiAssistant.ts';
import { restoreLeadsFromTrash, getTrashLeads, getDeletedHistory } from '../data/leadStorage.ts';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeads: Lead[];
  allLeads?: Lead[];
  filterOptions?: FilterOptions;
  onApplyLeadFilter: (leadIds: number[] | null) => void;
  onSelectLeadInTable: (leadId: number) => void;
  onShowMessage: (text: string, type: 'success' | 'error') => void;
  creditBalance: number;
  setCreditBalance: React.Dispatch<React.SetStateAction<number>>;
  // NL AI Action Handlers
  onAddLead?: (leadData: any) => Promise<boolean | undefined>;
  onUpdateLead?: (id: number, leadData: any) => Promise<boolean | undefined>;
  onDeleteLead?: (lead: Lead) => Promise<void>;
  onSetSearchInput?: (query: string) => void;
  onRefreshLeads?: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  result?: AICommandResult;
  timestamp: string;
}

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
  isOpen,
  onClose,
  selectedLeads,
  allLeads = [],
  filterOptions = { jobTitles: [], companies: [], cities: [], sources: [], statuses: [] },
  onApplyLeadFilter,
  onSelectLeadInTable,
  onShowMessage,
  creditBalance,
  setCreditBalance,
  onAddLead,
  onUpdateLead,
  onDeleteLead,
  onSetSearchInput,
  onRefreshLeads
}) => {
  const [activeTab, setActiveTab] = useState<'assistant' | 'pitch' | 'matcher'>('assistant');
  const [selectedLeadForPitch, setSelectedLeadForPitch] = useState<Lead | null>(null);

  // Natural Language AI Assistant States
  const [naturalPrompt, setNaturalPrompt] = useState<string>('');
  const [isProcessingCommand, setIsProcessingCommand] = useState<boolean>(false);
  const [deletedLeadsHistory, setDeletedLeadsHistory] = useState<Lead[]>([]);
  const [restoredLeadsHistory, setRestoredLeadsHistory] = useState<Lead[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: 'Hello! I am your AI Command Assistant. Type any search term, or instruct me in plain English to insert new leads or update existing records.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Outreach Pitch Form States
  const [outreachAngle, setOutreachAngle] = useState<string>('Value-First Pitch');
  const [tone, setTone] = useState<string>('Professional');
  const [refinementPrompt, setRefinementPrompt] = useState<string>('');
  const [isGeneratingPitch, setIsGeneratingPitch] = useState<boolean>(false);
  
  // Pitch Result States
  const [pitchResult, setPitchResult] = useState<{
    subject: string;
    body: string;
    insights: string[];
  } | null>(null);

  const [copiedSubject, setCopiedSubject] = useState<boolean>(false);
  const [copiedBody, setCopiedBody] = useState<boolean>(false);

  // ICP Matcher States
  const [icpQuery, setIcpQuery] = useState<string>('');
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [matchResults, setMatchResults] = useState<{
    leadId: number;
    matchScore: number;
    explanation: string;
    leadDetails?: Lead;
  }[] | null>(null);
  const [hasAppliedIcpFilter, setHasAppliedIcpFilter] = useState<boolean>(false);

  // Auto-select the first selected lead from the table if available
  useEffect(() => {
    if (selectedLeads.length > 0) {
      if (!selectedLeadForPitch || !selectedLeads.some(l => l.id === selectedLeadForPitch.id)) {
        setSelectedLeadForPitch(selectedLeads[0]);
        setPitchResult(null);
      }
    } else {
      setSelectedLeadForPitch(null);
    }
  }, [selectedLeads]);

  // ==================== NATURAL LANGUAGE COMMAND EXECUTION ====================
  const handleExecuteNLCommand = async (inputPrompt?: string) => {
    const queryToProcess = (inputPrompt || naturalPrompt).trim();
    if (!queryToProcess) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: queryToProcess,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatLogs(prev => [...prev, userMsg]);
    if (!inputPrompt) setNaturalPrompt('');
    setIsProcessingCommand(true);

    try {
      // Build conversation history and active page context
      const historyItems = chatLogs.map(m => ({ sender: m.sender, text: m.text }));
      const activePageLeads = selectedLeads.length > 0 ? selectedLeads : allLeads;

      // Process using AI engine (Gemini or offline NLP fallback with conversation memory)
      const res: AICommandResult = await processNaturalLanguageCommand(
        queryToProcess,
        allLeads,
        filterOptions,
        historyItems,
        activePageLeads
      );

      // Execute Action directly on Database & UI
      let assistantReplyText = res.explanation;

      if (res.action === 'search') {
        if (res.searchQuery && onSetSearchInput) {
          onSetSearchInput(res.searchQuery);
        }
        if (res.matchingLeadIds) {
          onApplyLeadFilter(res.matchingLeadIds);
        }
        onShowMessage(`Found ${res.matchingLeadIds?.length || 0} matching records directly on page.`, 'success');
      } else if (res.action === 'create' && res.newLeadData && onAddLead) {
        const success = await onAddLead(res.newLeadData);
        if (success) {
          const displayName = res.newLeadData.lastName && res.newLeadData.lastName !== '-'
            ? `${res.newLeadData.firstName} ${res.newLeadData.lastName}`
            : `${res.newLeadData.firstName}`;
          assistantReplyText = `✅ Inserted new record for "${displayName}" (${res.newLeadData.organization || 'Company'}) into database. Page refreshed immediately.`;
          onShowMessage(`Successfully added lead ${displayName}!`, 'success');
        }
      } else if (res.action === 'update' && res.targetLeadId && res.updateData && onUpdateLead) {
        const success = await onUpdateLead(res.targetLeadId, res.updateData);
        if (success) {
          assistantReplyText = `✏️ Successfully updated lead #${res.targetLeadId}. Changed fields: ${Object.keys(res.updateData).join(', ')}. Page refreshed immediately.`;
          onShowMessage(`Updated lead #${res.targetLeadId} successfully!`, 'success');
        }
      } else if (res.action === 'delete') {
        if (res.deleteLeadId) {
          const target = allLeads.find(l => l.id === res.deleteLeadId);
          if (target && onDeleteLead) {
            await onDeleteLead(target);
            setDeletedLeadsHistory(prev => [target, ...prev]);
            assistantReplyText = `🗑️ Permanently deleted lead #${res.deleteLeadId} (${target.firstName} ${target.lastName || ''}) from database.`;
            onShowMessage(`Deleted lead #${res.deleteLeadId} successfully!`, 'success');
          }
        } else if (res.matchingLeadIds && res.matchingLeadIds.length > 0 && onDeleteLead) {
          const targets = allLeads.filter(l => res.matchingLeadIds!.includes(l.id));
          for (const t of targets) {
            await onDeleteLead(t);
          }
          setDeletedLeadsHistory(prev => [...targets, ...prev]);
          assistantReplyText = `🗑️ Permanently deleted ${targets.length} lead record(s) matching your condition. Page refreshed immediately.`;
          onShowMessage(`Deleted ${targets.length} lead(s) successfully!`, 'success');
        } else {
          assistantReplyText = `No matching lead records found to delete for your prompt condition.`;
        }
      } else if (res.action === 'restore') {
        const trash = deletedLeadsHistory.length > 0 ? deletedLeadsHistory : getTrashLeads();
        if (trash.length > 0) {
          const { updatedLeads, restoredCount, restoredList } = await restoreLeadsFromTrash(trash);
          if (restoredCount > 0) {
            setRestoredLeadsHistory(restoredList);
            onApplyLeadFilter(null);
            if (onSetSearchInput) onSetSearchInput('');
            if (onRefreshLeads) onRefreshLeads();
            assistantReplyText = `🔄 Restored exactly ${restoredCount} deleted lead record(s) back into table without duplicates! Total active contacts: ${updatedLeads.length}.`;
            onShowMessage(`Restored ${restoredCount} lead(s) back to table!`, 'success');
          } else {
            assistantReplyText = `All matching deleted leads are already active on your page (0 duplicates added).`;
          }
          setDeletedLeadsHistory([]);
        } else {
          assistantReplyText = `No deleted leads found in trash memory to restore.`;
        }
      } else if (res.action === 'show_revived') {
        if (restoredLeadsHistory.length > 0) {
          const listStr = restoredLeadsHistory.map((l, idx) => `${idx + 1}. ${l.firstName} ${l.lastName || ''} (${l.jobTitle || '-'} at ${l.organization || '-'}, Email: ${l.email})`).join('\n');
          assistantReplyText = `Here are the ${restoredLeadsHistory.length} lead records that were recently revived:\n${listStr}`;
        } else {
          assistantReplyText = `No recently revived leads found in session memory. Currently showing ${allLeads.length} active leads on page.`;
        }
      } else if (res.action === 'show_deleted') {
        const trash = getTrashLeads();
        const history = getDeletedHistory();
        const combined = [...deletedLeadsHistory, ...trash, ...history];
        const uniqueLeads = Array.from(new Map(combined.map(l => [`${l.firstName}_${l.lastName}_${l.email}_${l.organization}`, l])).values());

        if (uniqueLeads.length > 0) {
          const listStr = uniqueLeads.slice(0, 30).map((l, idx) => `${idx + 1}. ${l.firstName} ${l.lastName && l.lastName !== '-' ? l.lastName : ''} (${l.jobTitle || '-'} at ${l.organization || '-'}, Email: ${l.email || '-'})`).join('\n');
          assistantReplyText = `Here are the ${uniqueLeads.length} earlier & recently deleted lead records:\n${listStr}`;
        } else {
          assistantReplyText = `No deleted leads found in trash or audit history.`;
        }
      }

      // Add assistant response log
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: assistantReplyText,
        result: res,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatLogs(prev => [...prev, assistantMsg]);
      if (onRefreshLeads) onRefreshLeads();

    } catch (err: any) {
      console.error('AI command execution failed:', err);
      setChatLogs(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: `An error occurred: ${err.message || 'Could not execute command.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsProcessingCommand(false);
    }
  };

  // Handle Personalized Pitch Generation
  const handleGeneratePitch = async (isRefinement = false) => {
    if (!selectedLeadForPitch) {
      onShowMessage('Please select a lead to generate a pitch.', 'error');
      return;
    }

    if (creditBalance < 2) {
      onShowMessage('Insufficient credits! Please refill in the header toolbar.', 'error');
      return;
    }

    setIsGeneratingPitch(true);
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const lead = selectedLeadForPitch;
      const companyStr = lead.organization ? `at ${lead.organization}` : '';
      const titleStr = lead.jobTitle || 'leader';
      const cityStr = lead.city ? `based in ${lead.city}` : '';

      let subject = `${outreachAngle}: Connecting with ${lead.firstName} ${companyStr}`;
      if (outreachAngle === 'Quick Intro') {
        subject = `Quick question regarding ${lead.organization || 'your team\'s growth'}, ${lead.firstName}`;
      } else if (outreachAngle === 'Pain-Point Centric') {
        subject = `Optimizing operations for ${lead.organization || 'your team'}`;
      } else if (outreachAngle === 'Coffee Meeting Invitation') {
        subject = `Coffee chat in ${lead.city || 'town'}, ${lead.firstName}?`;
      }

      const greeting = tone === 'Casual' ? `Hi ${lead.firstName},` : `Dear ${lead.firstName},`;
      let noteMention = '';
      if (lead.questions && lead.questions.trim() && lead.questions.toLowerCase() !== 'no') {
        noteMention = `\n\nI noticed your registration note regarding "${lead.questions}". We've helped several leaders in similar positions streamline this exact workflow.`;
      }

      let customInstructionText = '';
      if (isRefinement && refinementPrompt.trim()) {
        customInstructionText = `\n\n[Note based on your instruction: "${refinementPrompt}"]`;
      }

      const body = `${greeting}

Hope you are having a productive week${cityStr ? ` in ${lead.city}` : ''}.

I came across your profile as a ${titleStr} ${companyStr}. Given your background and expertise, I wanted to reach out regarding how leading companies are leveraging modern automated lead acquisition and data workflows to scale outreach efficiently.${noteMention}${customInstructionText}

Would you be open to a brief 10-minute discovery call next week to explore potential synergies?

Best regards,
Apollo AI Growth Team`;

      const insights = [
        `High-intent prospect: ${titleStr} ${companyStr}`,
        lead.city ? `Geographic target location: ${lead.city}` : 'National/Global prospect profile',
        lead.questions && lead.questions.toLowerCase() !== 'no' 
          ? `Submitted active inquiry: "${lead.questions.slice(0, 60)}..."`
          : 'High engagement probability based on event participation'
      ];

      setPitchResult({ subject, body, insights });
      setCreditBalance(prev => Math.max(0, prev - 2));
      onShowMessage('AI Personalized Pitch generated successfully!', 'success');
    } catch (err: any) {
      console.error(err);
      onShowMessage(err.message || 'Error generating AI pitch.', 'error');
    } finally {
      setIsGeneratingPitch(false);
    }
  };

  // Handle ICP Lead Matcher Search
  const handleIcpMatch = async () => {
    if (!icpQuery.trim()) {
      onShowMessage('Please describe your target ICP first.', 'error');
      return;
    }

    if (creditBalance < 3) {
      onShowMessage('Insufficient credits! Please refill in the header toolbar.', 'error');
      return;
    }

    setIsMatching(true);
    await new Promise(resolve => setTimeout(resolve, 900));

    try {
      const storageModule = await import('../data/leadStorage.ts');
      const allLeadsData = storageModule.getStoredLeads();
      const queryLower = icpQuery.toLowerCase();
      const keywords = queryLower.split(/\s+/).filter(k => k.length > 2);

      const scored = allLeadsData.map(l => {
        let score = 30;
        const title = (l.jobTitle || '').toLowerCase();
        const org = (l.organization || '').toLowerCase();
        const city = (l.city || '').toLowerCase();
        const question = (l.questions || '').toLowerCase();

        keywords.forEach(kw => {
          if (title.includes(kw)) score += 20;
          if (org.includes(kw)) score += 15;
          if (city.includes(kw)) score += 15;
          if (question.includes(kw)) score += 25;
        });

        score = Math.min(98, Math.max(score, 45));

        let explanation = `${l.jobTitle || 'Professional'} ${l.organization ? `at ${l.organization}` : ''} in ${l.city || 'Target Region'}`;
        if (l.questions && l.questions.toLowerCase() !== 'no') {
          explanation += ` — Active inquiry: "${l.questions}"`;
        }

        return {
          leadId: l.id,
          matchScore: score,
          explanation,
          leadDetails: l
        };
      });

      scored.sort((a, b) => b.matchScore - a.matchScore);
      const topMatches = scored.slice(0, 15);

      setMatchResults(topMatches);
      setHasAppliedIcpFilter(false);
      setCreditBalance(prev => Math.max(0, prev - 3));
      onShowMessage(`AI found ${topMatches.length} matching target leads!`, 'success');
    } catch (err: any) {
      console.error(err);
      onShowMessage('Error matching leads.', 'error');
    } finally {
      setIsMatching(false);
    }
  };

  const applyIcpFilter = (matches: any[]) => {
    if (!matches || matches.length === 0) return;
    const matchingIds = matches.map(m => m.leadId);
    onApplyLeadFilter(matchingIds);
    setHasAppliedIcpFilter(true);
    onShowMessage(`Applied AI recommendation filter: Showing ${matchingIds.length} leads.`, 'success');
  };

  const clearIcpFilter = () => {
    onApplyLeadFilter(null);
    setHasAppliedIcpFilter(false);
    onShowMessage('AI filter cleared. Showing all Leads.', 'success');
  };

  const handleCopy = (text: string, type: 'subject' | 'body') => {
    navigator.clipboard.writeText(text);
    if (type === 'subject') {
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2000);
    } else {
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2000);
    }
    onShowMessage('Copied to clipboard!', 'success');
  };

  if (!isOpen) return null;

  return (
    <div className="w-[430px] shrink-0 border-l border-gray-200 bg-white flex flex-col h-full shadow-2xl relative z-30 animate-slideIn">
      
      {/* Drawer Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50/40 via-white to-white">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-950 leading-none font-display tracking-tight">Apollo AI Assistant</h2>
            <span className="text-4xs uppercase tracking-wider text-indigo-600 font-black block mt-1 font-mono">
              Natural Language Command & Control
            </span>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-650 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-gray-200 p-1 bg-gray-50/50 shrink-0 select-none">
        <button
          onClick={() => setActiveTab('assistant')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1 transition-all ${
            activeTab === 'assistant' 
              ? 'bg-white text-indigo-700 shadow-3xs border border-gray-200/50' 
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>AI Command</span>
        </button>
        <button
          onClick={() => setActiveTab('pitch')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1 transition-all ${
            activeTab === 'pitch' 
              ? 'bg-white text-indigo-700 shadow-3xs border border-gray-200/50' 
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Pitch</span>
        </button>
        <button
          onClick={() => setActiveTab('matcher')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1 transition-all ${
            activeTab === 'matcher' 
              ? 'bg-white text-indigo-700 shadow-3xs border border-gray-200/50' 
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>ICP Matcher</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ==================== TAB 0: Natural Language AI Assistant ==================== */}
        {activeTab === 'assistant' && (
          <div className="flex flex-col h-full space-y-3 animate-fadeIn">
            
            {/* Conversational Chat Log */}
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-3 min-h-[300px] overflow-y-auto font-sans">
              {chatLogs.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl p-3 text-xs leading-relaxed font-medium ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none shadow-sm font-semibold'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-3xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {/* Result Details Card */}
                    {msg.result && msg.result.action === 'create' && msg.result.newLeadData && (
                      <div className="mt-2 pt-2 border-t border-gray-150 text-2xs text-gray-700 space-y-1 bg-emerald-50/50 p-2 rounded-lg">
                        <div className="font-bold text-emerald-800 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Inserted Record</span>
                        </div>
                        <div>Name: <b>{msg.result.newLeadData.firstName} {msg.result.newLeadData.lastName || ''}</b></div>
                        <div>Title: {msg.result.newLeadData.jobTitle} at {msg.result.newLeadData.organization}</div>
                        <div>Email: {msg.result.newLeadData.email}</div>
                      </div>
                    )}

                    {msg.result && msg.result.action === 'update' && (
                      <div className="mt-2 pt-2 border-t border-gray-150 text-2xs text-gray-700 space-y-1 bg-amber-50/50 p-2 rounded-lg">
                        <div className="font-bold text-amber-800 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-amber-600" />
                          <span>Updated Record #{msg.result.targetLeadId}</span>
                        </div>
                        {msg.result.updateData && Object.entries(msg.result.updateData).map(([k, v]) => (
                          <div key={k} className="font-mono">
                            <span className="capitalize">{k}</span>: <b>{String(v)}</b>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-gray-400 mt-1 px-1 font-mono">{msg.timestamp}</span>
                </div>
              ))}

              {isProcessingCommand && (
                <div className="flex items-center space-x-2 text-xs text-indigo-600 font-semibold bg-white p-2.5 rounded-xl border border-gray-200">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>AI Assistant is understanding and executing payload...</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="relative">
              <textarea
                value={naturalPrompt}
                onChange={(e) => setNaturalPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleExecuteNLCommand();
                  }
                }}
                placeholder="Type natural language command... e.g. 'Search Procurement Managers' or 'Add lead VP Sales at Acme Corp' or 'Update lead #1 email to contact@acme.com'"
                rows={2}
                className="w-full text-xs p-3 pr-10 border border-gray-200 rounded-xl focus:outline-hidden focus:border-indigo-500 resize-none bg-white font-medium shadow-3xs"
              />
              <button
                onClick={() => handleExecuteNLCommand()}
                disabled={isProcessingCommand || !naturalPrompt.trim()}
                className="absolute right-2.5 bottom-3.5 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
                title="Send AI Command"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

          </div>
        )}
        
        {/* ==================== TAB 1: Outreach Pitch Generator ==================== */}
        {activeTab === 'pitch' && (
          <div className="space-y-4 animate-fadeIn">
            
            {/* Selected Lead Profile Panel */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-150 relative">
              <h3 className="text-2xs font-extrabold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center space-x-1">
                <User className="w-3.5 h-3.5" />
                <span>Target Lead Profile</span>
              </h3>
              
              {selectedLeads.length > 0 ? (
                <div className="space-y-3">
                  {selectedLeads.length > 1 && (
                    <div className="mb-2">
                      <label className="block text-4xs font-extrabold text-gray-400 uppercase mb-1">
                        Select Lead to Target ({selectedLeads.length} Selected)
                      </label>
                      <select
                        value={selectedLeadForPitch?.id || ''}
                        onChange={(e) => {
                          const id = parseInt(e.target.value);
                          const lead = selectedLeads.find(l => l.id === id);
                          if (lead) {
                            setSelectedLeadForPitch(lead);
                            setPitchResult(null);
                          }
                        }}
                        className="w-full text-xs font-bold text-gray-700 py-1 px-2 border border-gray-200 rounded-lg bg-white focus:outline-hidden focus:border-indigo-500"
                      >
                        {selectedLeads.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.firstName} {l.lastName || ''} — {l.jobTitle || 'No Title'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedLeadForPitch && (
                    <div>
                      <div className="font-extrabold text-sm text-neutral-900">
                        {selectedLeadForPitch.firstName} {selectedLeadForPitch.lastName || ''}
                      </div>
                      
                      <div className="space-y-1.5 mt-2.5">
                        {selectedLeadForPitch.jobTitle && (
                          <div className="flex items-center text-xs text-gray-600 font-medium">
                            <Briefcase className="w-3.5 h-3.5 text-gray-400 mr-2 shrink-0" />
                            <span>{selectedLeadForPitch.jobTitle}</span>
                          </div>
                        )}
                        {selectedLeadForPitch.organization && (
                          <div className="flex items-center text-xs text-gray-600 font-medium">
                            <Building className="w-3.5 h-3.5 text-gray-400 mr-2 shrink-0" />
                            <span className="font-bold text-indigo-650">{selectedLeadForPitch.organization}</span>
                          </div>
                        )}
                        {selectedLeadForPitch.city && (
                          <div className="flex items-center text-xs text-gray-600 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 mr-2 shrink-0" />
                            <span>{selectedLeadForPitch.city}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 px-2">
                  <p className="text-xs text-gray-500 font-medium leading-relaxed">
                    No lead selected. Check the checkbox next to any lead in the directory table to load their context.
                  </p>
                </div>
              )}
            </div>

            {selectedLeadForPitch && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-4xs font-extrabold text-gray-400 uppercase tracking-wider mb-1">
                      Outreach Angle
                    </label>
                    <select
                      value={outreachAngle}
                      onChange={(e) => setOutreachAngle(e.target.value)}
                      className="w-full text-xs font-semibold text-gray-700 py-1.5 px-2.5 border border-gray-200 rounded-lg bg-white focus:outline-hidden focus:border-indigo-500 cursor-pointer shadow-3xs"
                    >
                      <option value="Value-First Pitch">Value-First Pitch</option>
                      <option value="Quick Intro">Quick Intro</option>
                      <option value="Pain-Point Centric">Pain-Point Centric</option>
                      <option value="Coffee Meeting Invitation">Coffee Meeting Invitation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-4xs font-extrabold text-gray-400 uppercase tracking-wider mb-1">
                      Pitch Tone
                    </label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full text-xs font-semibold text-gray-700 py-1.5 px-2.5 border border-gray-200 rounded-lg bg-white focus:outline-hidden focus:border-indigo-500 cursor-pointer shadow-3xs"
                    >
                      <option value="Professional">Professional</option>
                      <option value="Casual">Casual</option>
                      <option value="Enthusiastic">Enthusiastic</option>
                      <option value="Creative">Creative</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => handleGeneratePitch(false)}
                  disabled={isGeneratingPitch}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isGeneratingPitch ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Writing perfect outreach...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-white" />
                      <span>Generate Personalized Pitch (Cost: 2 Cr)</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {pitchResult && selectedLeadForPitch && (
              <div className="space-y-4 pt-3 border-t border-gray-200/80 animate-fadeIn">
                <div className="space-y-1 bg-gray-50/50 border border-gray-150 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-4xs font-extrabold text-gray-400 uppercase tracking-wider">
                      Subject Line
                    </span>
                    <button
                      onClick={() => handleCopy(pitchResult.subject, 'subject')}
                      className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center space-x-1"
                    >
                      {copiedSubject ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="text-4xs font-bold">{copiedSubject ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-xs font-extrabold text-neutral-900 bg-white border border-gray-200/50 rounded-lg p-2 mt-1">
                    {pitchResult.subject}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-4xs font-extrabold text-gray-400 uppercase tracking-wider">
                      Personalized Pitch Body
                    </span>
                    <button
                      onClick={() => handleCopy(pitchResult.body, 'body')}
                      className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center space-x-1"
                    >
                      {copiedBody ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="text-4xs font-bold">{copiedBody ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-xs text-gray-750 font-medium bg-white border border-gray-200 rounded-xl p-3.5 mt-1 leading-relaxed whitespace-pre-wrap font-sans">
                    {pitchResult.body}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ==================== TAB 2: ICP Lead Matcher ==================== */}
        {activeTab === 'matcher' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-indigo-900 rounded-xl p-4 text-white shadow-md relative overflow-hidden">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-200 flex items-center space-x-1.5 mb-1.5">
                <Brain className="w-4 h-4 text-indigo-300" />
                <span>AI Ideal Customer Profiler</span>
              </h3>
              <p className="text-2xs text-indigo-100 leading-relaxed font-medium">
                Describe your target segment in plain English. Gemini will scan all event registrants and return scored matches.
              </p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <textarea
                  value={icpQuery}
                  onChange={(e) => setIcpQuery(e.target.value)}
                  placeholder="e.g. 'Founders or CEOs based in Boston or SF interested in marketing tech'"
                  rows={3}
                  className="w-full text-xs p-3 pr-10 border border-gray-200 rounded-xl focus:outline-hidden focus:border-indigo-500 resize-none bg-white font-medium"
                />
                <button
                  onClick={handleIcpMatch}
                  disabled={isMatching}
                  className="absolute right-2.5 bottom-2.5 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isMatching ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <ArrowRight className="w-3.5 h-3.5 text-white" />}
                </button>
              </div>
            </div>

            {matchResults && !isMatching && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-3xs font-extrabold text-gray-400 uppercase tracking-wider">
                    Scored Matches ({matchResults.length})
                  </h4>
                  {matchResults.length > 0 && (
                    hasAppliedIcpFilter ? (
                      <button onClick={clearIcpFilter} className="text-4xs font-extrabold text-red-600 flex items-center space-x-1">
                        <X className="w-3 h-3" />
                        <span>Clear AI Filter</span>
                      </button>
                    ) : (
                      <button onClick={() => applyIcpFilter(matchResults)} className="text-4xs font-extrabold text-indigo-600 flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Filter Main Table</span>
                      </button>
                    )
                  )}
                </div>

                <div className="space-y-2.5">
                  {matchResults.map((match) => (
                    <div 
                      key={match.leadId}
                      onClick={() => onSelectLeadInTable(match.leadId)}
                      className="group bg-white hover:bg-indigo-50/20 border border-gray-200 hover:border-indigo-150 rounded-xl p-3 cursor-pointer transition-all flex items-start justify-between"
                    >
                      <div className="space-y-1 flex-1 pr-3">
                        <span className="font-extrabold text-xs text-neutral-900 group-hover:text-indigo-900 block">
                          Lead #{match.leadId}
                        </span>
                        <p className="text-xs font-semibold text-gray-700 italic">
                          "{match.explanation}"
                        </p>
                      </div>
                      <div className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-center font-mono text-xs font-bold">
                        {match.matchScore}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Drawer Footer Status */}
      <div className="p-4 border-t border-gray-150 bg-gray-50 shrink-0 text-center flex items-center justify-between text-3xs font-black text-gray-400 uppercase tracking-widest select-none font-mono">
        <span>Credits Remaining</span>
        <span className="text-indigo-700 text-xs font-black font-mono">{creditBalance} Cr</span>
      </div>

    </div>
  );
};
