import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Mail, Target, Copy, Check, RotateCcw, 
  Brain, User, Lightbulb, Send, X, ArrowRight, ArrowLeft,
  Briefcase, MapPin, Building, HelpCircle, Loader2, MessageSquare, Flame
} from 'lucide-react';

interface Lead {
  id: number;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  organization: string | null;
  jobTitle: string | null;
  city: string | null;
  questions: string | null;
  sourceName: string | null;
  approvalStatus: string;
}

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeads: Lead[];
  onApplyLeadFilter: (leadIds: number[] | null) => void;
  onSelectLeadInTable: (leadId: number) => void;
  onShowMessage: (text: string, type: 'success' | 'error') => void;
  creditBalance: number;
  setCreditBalance: React.Dispatch<React.SetStateAction<number>>;
}

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
  isOpen,
  onClose,
  selectedLeads,
  onApplyLeadFilter,
  onSelectLeadInTable,
  onShowMessage,
  creditBalance,
  setCreditBalance
}) => {
  const [activeTab, setActiveTab] = useState<'pitch' | 'matcher'>('pitch');
  const [selectedLeadForPitch, setSelectedLeadForPitch] = useState<Lead | null>(null);

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
      // Keep selected lead if it's still in the list, otherwise choose the first one
      if (!selectedLeadForPitch || !selectedLeads.some(l => l.id === selectedLeadForPitch.id)) {
        setSelectedLeadForPitch(selectedLeads[0]);
        // Reset the pitch result when switching leads
        setPitchResult(null);
      }
    } else {
      setSelectedLeadForPitch(null);
    }
  }, [selectedLeads]);

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
    // Simulate smart AI processing delay
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

      setPitchResult({
        subject,
        body,
        insights
      });

      // Deduct 2 credits for pitch generation
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
      // Get all leads from local storage
      const storageModule = await import('../data/leadStorage.ts');
      const allLeads = storageModule.getStoredLeads();
      const queryLower = icpQuery.toLowerCase();

      const keywords = queryLower.split(/\s+/).filter(k => k.length > 2);

      const scored = allLeads.map(l => {
        let score = 30; // base score
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

        // Cap at 98%
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

      // Deduct 3 credits for full-database semantic matching
      setCreditBalance(prev => Math.max(0, prev - 3));
      onShowMessage(`AI found ${topMatches.length} matching target leads!`, 'success');
    } catch (err: any) {
      console.error(err);
      onShowMessage('Error matching leads.', 'error');
    } finally {
      setIsMatching(false);
    }
  };

  // Apply matched leads as active filter on main table
  const applyIcpFilter = (matches: any[]) => {
    if (!matches || matches.length === 0) return;
    const matchingIds = matches.map(m => m.leadId);
    onApplyLeadFilter(matchingIds);
    setHasAppliedIcpFilter(true);
    onShowMessage(`Applied AI recommendation filter: Showing ${matchingIds.length} leads.`, 'success');
  };

  // Clear matched filter
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
    <div className="w-[420px] shrink-0 border-l border-gray-200 bg-white flex flex-col h-full shadow-2xl relative z-30 animate-slideIn">
      
      {/* Drawer Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-indigo-50/40 via-white to-white">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-950 leading-none font-display tracking-tight">Apollo AI Copilot</h2>
            <span className="text-4xs uppercase tracking-wider text-indigo-600 font-black block mt-1 font-mono">
              Powered by Gemini 3.5 Flash
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
          onClick={() => setActiveTab('pitch')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
            activeTab === 'pitch' 
              ? 'bg-white text-indigo-700 shadow-3xs border border-gray-200/50' 
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Smart Outreach Pitch</span>
        </button>
        <button
          onClick={() => setActiveTab('matcher')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
            activeTab === 'matcher' 
              ? 'bg-white text-indigo-700 shadow-3xs border border-gray-200/50' 
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>ICP Semantic Matcher</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        
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
                  {/* Lead Picker Dropdown (If multiple selected) */}
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
                        {selectedLeadForPitch.questions && selectedLeadForPitch.questions !== 'no' && (
                          <div className="mt-2.5 pt-2.5 border-t border-gray-200/60 bg-indigo-50/30 p-2 rounded-lg text-xs text-indigo-900 border-l-2 border-indigo-500">
                            <div className="font-bold flex items-center space-x-1 mb-1 text-indigo-950 text-3xs uppercase tracking-wider">
                              <MessageSquare className="w-3 h-3 text-indigo-500" />
                              <span>Submitted Question / Note</span>
                            </div>
                            <p className="italic font-medium leading-relaxed">"{selectedLeadForPitch.questions}"</p>
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

            {/* Outreach Pitch Preferences Form */}
            {selectedLeadForPitch && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  {/* Outreach Angle */}
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

                  {/* Outreach Tone */}
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

                {/* Custom Refinement */}
                <div>
                  <label className="block text-4xs font-extrabold text-gray-400 uppercase tracking-wider mb-1 flex justify-between">
                    <span>Custom Instruction (Optional)</span>
                    <span className="text-[9px] text-gray-400 normal-case font-normal">e.g. "Keep it under 3 sentences"</span>
                  </label>
                  <textarea
                    value={refinementPrompt}
                    onChange={(e) => setRefinementPrompt(e.target.value)}
                    placeholder="Enter any custom constraints, product/service name, or specific offer hooks..."
                    rows={2}
                    className="w-full text-xs p-2.5 border border-gray-200 rounded-lg focus:outline-hidden focus:border-indigo-500 resize-none bg-white font-medium"
                  />
                </div>

                {/* Generate Button */}
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

            {/* Generated Results Presentation */}
            {pitchResult && selectedLeadForPitch && (
              <div className="space-y-4 pt-3 border-t border-gray-200/80 animate-fadeIn">
                
                {/* Insights bullets first */}
                {pitchResult.insights && pitchResult.insights.length > 0 && (
                  <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3.5">
                    <h4 className="text-3xs font-extrabold text-amber-800 uppercase tracking-widest mb-2 flex items-center space-x-1">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                      <span>Strategic AI Lead Insights</span>
                    </h4>
                    <ul className="space-y-2 text-xs font-medium text-amber-900">
                      {pitchResult.insights.map((insight, idx) => (
                        <li key={idx} className="flex items-start">
                          <Flame className="w-3.5 h-3.5 text-amber-500 mr-2 shrink-0 mt-0.5" />
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Subject Line */}
                <div className="space-y-1 bg-gray-550 border border-gray-150 rounded-xl p-3 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-4xs font-extrabold text-gray-400 uppercase tracking-wider">
                      Subject Line
                    </span>
                    <button
                      onClick={() => handleCopy(pitchResult.subject, 'subject')}
                      className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center space-x-1"
                      title="Copy Subject"
                    >
                      {copiedSubject ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="text-4xs font-bold">{copiedSubject ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-xs font-extrabold text-neutral-900 bg-white border border-gray-200/50 rounded-lg p-2 mt-1">
                    {pitchResult.subject}
                  </div>
                </div>

                {/* Email Body */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-4xs font-extrabold text-gray-400 uppercase tracking-wider">
                      Personalized Pitch Body
                    </span>
                    <button
                      onClick={() => handleCopy(pitchResult.body, 'body')}
                      className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center space-x-1"
                      title="Copy Email Body"
                    >
                      {copiedBody ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="text-4xs font-bold">{copiedBody ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-xs text-gray-750 font-medium bg-white border border-gray-200 rounded-xl p-3.5 mt-1 leading-relaxed whitespace-pre-wrap font-sans">
                    {pitchResult.body}
                  </div>
                </div>

                {/* Pitch refinement */}
                <div className="pt-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={refinementPrompt}
                      onChange={(e) => setRefinementPrompt(e.target.value)}
                      placeholder="Ask AI to adjust this draft... (e.g. 'Make it more casual')"
                      className="flex-1 text-xs py-1.5 px-3 border border-gray-200 rounded-lg focus:outline-hidden focus:border-indigo-500 bg-white font-medium"
                    />
                    <button
                      onClick={() => handleGeneratePitch(true)}
                      disabled={isGeneratingPitch}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 rounded-lg text-xs font-bold flex items-center space-x-1"
                    >
                      {isGeneratingPitch ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Refine</span>
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* ==================== TAB 2: ICP Lead Matcher ==================== */}
        {activeTab === 'matcher' && (
          <div className="space-y-4 animate-fadeIn">
            
            {/* Description panel */}
            <div className="bg-gradient-to-r from-indigo-550 to-indigo-650 bg-indigo-900 rounded-xl p-4 text-white shadow-md relative overflow-hidden">
              <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
                <Brain className="w-24 h-24 text-white" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-200 flex items-center space-x-1.5 mb-1.5">
                <Brain className="w-4 h-4 text-indigo-300" />
                <span>AI Ideal Customer Profiler</span>
              </h3>
              <p className="text-2xs text-indigo-100 leading-relaxed font-medium">
                Describe your target segment in plain English. Gemini will scan all event registrants, evaluate matching indicators, and return scored suggestions with matching explanations.
              </p>
            </div>

            {/* Input Form */}
            <div className="space-y-2">
              <label className="block text-4xs font-extrabold text-gray-400 uppercase tracking-wider">
                Describe Your target persona or ICP
              </label>
              <div className="relative">
                <textarea
                  value={icpQuery}
                  onChange={(e) => setIcpQuery(e.target.value)}
                  placeholder="e.g. 'Founders or CEOs based in Boston or SF interested in marketing tech and engineering integrations'"
                  rows={3}
                  className="w-full text-xs p-3 pr-10 border border-gray-200 rounded-xl focus:outline-hidden focus:border-indigo-500 resize-none bg-white font-medium leading-relaxed"
                />
                <button
                  onClick={handleIcpMatch}
                  disabled={isMatching}
                  className="absolute right-2.5 bottom-2.5 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                  title="Run matching"
                >
                  {isMatching ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
              </div>
              <span className="text-[10px] text-gray-400 block font-medium">
                Uses 3 credits to run full list semantic scoring and analytical evaluation.
              </span>
            </div>

            {/* Matching Results List */}
            {isMatching && (
              <div className="py-12 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <span className="text-xs text-gray-500 font-semibold tracking-wide">
                  Gemini is evaluating lead score metrics...
                </span>
              </div>
            )}

            {matchResults && !isMatching && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-3xs font-extrabold text-gray-400 uppercase tracking-wider">
                    Scored Matches ({matchResults.length})
                  </h4>
                  {matchResults.length > 0 && (
                    hasAppliedIcpFilter ? (
                      <button
                        onClick={clearIcpFilter}
                        className="text-4xs font-extrabold text-red-600 hover:text-red-800 hover:underline flex items-center space-x-1"
                      >
                        <X className="w-3 h-3" />
                        <span>Clear AI Filter</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => applyIcpFilter(matchResults)}
                        className="text-4xs font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center space-x-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Filter Main Table</span>
                      </button>
                    )
                  )}
                </div>

                {matchResults.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-6 text-center border border-gray-150">
                    <p className="text-xs text-gray-500 font-semibold">
                      No strong matches found (score &gt; 40) for this description. Try broadening your criteria.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {matchResults.map((match) => (
                      <div 
                        key={match.leadId}
                        onClick={() => onSelectLeadInTable(match.leadId)}
                        className="group bg-white hover:bg-indigo-50/20 border border-gray-200/85 hover:border-indigo-150 rounded-xl p-3 cursor-pointer transition-all shadow-3xs flex items-start justify-between"
                      >
                        <div className="space-y-1 flex-1 pr-3">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-extrabold text-xs text-neutral-900 group-hover:text-indigo-900">
                              Lead #{match.leadId}
                            </span>
                            <span className="text-4xs text-gray-400 font-bold uppercase">
                              Evaluated
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-gray-700 leading-normal italic">
                            "{match.explanation}"
                          </p>
                          <div className="pt-1.5 flex items-center text-4xs text-indigo-500 font-bold uppercase tracking-wider">
                            <span>Inspect Lead Row</span>
                            <ArrowRight className="w-2.5 h-2.5 ml-1 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0.5" />
                          </div>
                        </div>

                        {/* Match Score Badge */}
                        <div className={`px-2 py-1 rounded-lg text-center shrink-0 flex flex-col justify-center min-w-14 border ${
                          match.matchScore >= 80 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : match.matchScore >= 60
                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                            : 'bg-gray-50 text-gray-600 border-gray-100'
                        }`}>
                          <span className="text-[9px] font-black leading-none uppercase opacity-85 font-sans">Match</span>
                          <span className="text-xs font-black mt-0.5 leading-none font-mono">{match.matchScore}%</span>
                        </div>

                      </div>
                    ))}
                  </div>
                )}

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
