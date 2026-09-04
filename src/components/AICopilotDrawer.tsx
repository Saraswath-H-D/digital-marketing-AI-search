import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Mail, Target, Copy, Check, RotateCcw,
  Brain, User, Lightbulb, Send, X, ArrowRight, ArrowLeft,
  Briefcase, MapPin, Building, HelpCircle, Loader2, MessageSquare, Flame,
  Search, Plus, Edit3, Trash2, Zap, Terminal, CheckCircle2,
  Paperclip, FileSpreadsheet, AlertCircle, Tag
} from 'lucide-react';
import { Lead, Filters, FilterOptions } from '../types.ts';
import { processNaturalLanguageCommand, AICommandResult, resolveCsvTagIntent, NO_TAG_RE, CSV_DELETE_INTENT_RE, interpretFilterQuery } from '../lib/aiAssistant.ts';
import { restoreLeadsFromTrash, getTrashLeads, getDeletedHistory, bulkImportLeads, previewBulkImportDuplicates, DuplicatePreviewResult, getLastImportReport, BulkImportResult } from '../data/leadStorage.ts';
import { parseCsvFile, buildAutoMapping, mapRowsToLeads, isCsvParseError } from '../lib/csvMapping.ts';
import { hashFile, resolveFileConflict, recordCsvFileUpload } from '../lib/csvFileRegistry.ts';
import { getActiveTagSet } from '../lib/supabase.ts';
import DuplicateLeadsModal from './DuplicateLeadsModal.tsx';
import ImportDuplicateChoiceModal from './ImportDuplicateChoiceModal.tsx';
import TagAlreadyInUseModal from './TagAlreadyInUseModal.tsx';

// Same normalization used everywhere else a tag gets compared (dedupe.ts,
// leadStorage.ts's leadMatchesTag, supabase.ts's getActiveTagSet itself).
const normalizeTagKey = (t: string): string => t.trim().toLowerCase().replace(/[-_\s]+/g, '-');

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
  // Natural-language lead filtering (§11: writes the app's OWN Filters state, same one
  // the sidebar drives — never a separate filtering mechanism).
  filters?: Filters;
  onApplyFilters?: (filters: Filters) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  result?: AICommandResult;
  timestamp: string;
}

interface AttachedCsv {
  file: File;
  name: string;
  size: number;
  headers: string[];
  rows: Record<string, string>[];
  hash: string | null;
}

const nowStamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
  onRefreshLeads,
  filters,
  onApplyFilters
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
      text: 'Hello! I am your AI Command Assistant. Type any search term, instruct me in plain English to insert new leads or update existing records, or attach a CSV to import contacts.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // CSV-via-chat upload state
  const [attachedCsv, setAttachedCsv] = useState<AttachedCsv | null>(null);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);
  const [awaitingTagAnswer, setAwaitingTagAnswer] = useState(false);
  const [awaitingFileConflictAnswer, setAwaitingFileConflictAnswer] = useState(false);
  const [pendingImportTag, setPendingImportTag] = useState<string | null>(null);
  // Most recent tag actually used in a completed chat-driven upload this session — the
  // only thing "same tag as before" is allowed to resolve against (never a guess).
  const [lastUsedCsvTag, setLastUsedCsvTag] = useState<string | null>(null);
  const [csvAttachError, setCsvAttachError] = useState('');
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateModalResult, setDuplicateModalResult] = useState<BulkImportResult | null>(null);
  const [duplicateModalCsvName, setDuplicateModalCsvName] = useState<string | undefined>(undefined);
  // Pre-import choice: set only when a dry-run duplicate check finds this upload
  // contains leads that already exist, mixed with genuinely new ones — asked every time
  // that happens, whether a tag was given for the upload or not (see
  // ImportDuplicateChoiceModal / previewBulkImportDuplicates).
  const [pendingDuplicateChoice, setPendingDuplicateChoice] = useState<{
    leadsWithTag: any[];
    finalTag: string | null;
    preview: DuplicatePreviewResult;
    csvName: string;
    csvHash: string | null;
  } | null>(null);
  // Set only when the tag resolved for this upload already has live leads under it —
  // asked every time that happens (see TagAlreadyInUseModal), independent of the file
  // and lead-level checks above/below. Holds the whole attached CSV (not just its name),
  // because by the time the user answers, handleCsvUploadCommand's own `attachedCsv`
  // state has already been cleared.
  const [pendingTagReuse, setPendingTagReuse] = useState<{ csv: AttachedCsv; finalTag: string } | null>(null);

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

  // Answers a duplicate-related question strictly from the real last-import report —
  // never invented. See leadStorage.ts's getLastImportReport / bulkImportLeads.
  const formatLastImportAnswer = (question: string): string => {
    const report = getLastImportReport();
    if (!report) {
      return "I don't have a CSV import result from this session yet — upload a CSV first and I can answer questions about its duplicate results.";
    }
    const { result, tag } = report;
    const q = question.toLowerCase();
    const tagLabel = tag ? `tag "${tag}"` : 'no tag';

    if (/unique/.test(q)) {
      return `The last import (${tagLabel}) kept ${result.uniqueRows} unique lead${result.uniqueRows === 1 ? '' : 's'} out of ${result.totalRows} row${result.totalRows === 1 ? '' : 's'} processed.`;
    }
    if (/different tag/.test(q)) {
      return `Tag is part of the exact-duplicate identity — a lead with identical information under a genuinely different tag is a different lead, imported as its own record, never merged into the existing one. Only the same person under the SAME tag counts as a duplicate.`;
    }
    if (/why/.test(q)) {
      return `A lead only counts as an exact duplicate when it shares the same tag AND every relevant mapped field matches another lead exactly, after safe normalization (trimming, case, harmless formatting). Even one differing field — job title, city, country, tag, anything meaningful — means it's kept as a separate record, never merged.`;
    }
    if (result.duplicatesSkipped === 0) {
      return `No duplicates were found in the last import (${tagLabel}) — all ${result.uniqueRows} row${result.uniqueRows === 1 ? '' : 's'} were unique and imported.`;
    }
    return `I found exact duplicates of ${result.duplicateLeadNames.length} lead${result.duplicateLeadNames.length === 1 ? '' : 's'} (${result.duplicatesSkipped} duplicate cop${result.duplicatesSkipped === 1 ? 'y' : 'ies'} total) in the last import (${tagLabel}) and corrected each to one lead — they were skipped during import, not deleted from Supabase.`;
  };

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

    // Duplicate-result Q&A — answered from the real last-import report (leadStorage's
    // getLastImportReport, updated by every bulkImportLeads call regardless of which UI
    // triggered it), never guessed and never routed through the generic search/CRUD parser.
    if (/\b(duplicate|duplicates|dupe|dupes)\b/i.test(queryToProcess)) {
      setChatLogs(prev => [...prev, userMsg]);
      if (!inputPrompt) setNaturalPrompt('');
      setChatLogs(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: formatLastImportAnswer(queryToProcess),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
      return;
    }

    // Natural-language lead filtering — writes the app's OWN Filters state (never a
    // separate filtering mechanism), so the result is identical to using the sidebar by
    // hand. Grounded strictly in real filterOptions values; declines honestly when the
    // requested concept isn't a field this app actually has.
    if (filters && onApplyFilters) {
      const filterResult = interpretFilterQuery(queryToProcess, filterOptions, filters);
      if (filterResult.mode !== 'none') {
        setChatLogs(prev => [...prev, userMsg]);
        if (!inputPrompt) setNaturalPrompt('');
        const stamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (filterResult.mode === 'clarify') {
          setChatLogs(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'assistant', text: filterResult.clarificationQuestion!, timestamp: stamp() }]);
          return;
        }
        if (filterResult.mode === 'unavailable') {
          const list = filterResult.unavailable.map(u => `• ${u}`).join('\n');
          const stillActive = filterResult.understood.length > 0
            ? `\n\nYour current filters are still active:\n${filterResult.understood.map(u => `• ${u}`).join('\n')}`
            : '';
          setChatLogs(prev => [...prev, {
            id: (Date.now() + 1).toString(), sender: 'assistant',
            text: `I can't filter by this because it isn't available as a field in your current lead data:\n${list}${stillActive}`,
            timestamp: stamp(),
          }]);
          return;
        }

        // mode === 'apply'
        onApplyFilters(filterResult.mergedFilters!);
        onApplyLeadFilter(null); // clear any stale AI id-override so the real Filters state is what's shown
        const understoodList = filterResult.understood.map(u => `• ${u}`).join('\n');
        const unavailNote = filterResult.unavailable.length > 0
          ? `\n\nNote: I couldn't filter by ${filterResult.unavailable.join(', ')} — not available in your current lead data.`
          : '';
        setChatLogs(prev => [...prev, {
          id: (Date.now() + 1).toString(), sender: 'assistant',
          text: `I understood:\n${understoodList}\n\nShowing matching leads...${unavailNote}`,
          timestamp: stamp(),
        }]);
        onShowMessage('Filters updated from your request.', 'success');
        return;
      }
    }

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

  // ==================== CSV UPLOAD VIA CHAT ====================

  const handleAttachCsvFile = async (file: File) => {
    setCsvAttachError('');
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvAttachError('Only CSV files are supported.');
      return;
    }
    const result = await parseCsvFile(file);
    if (isCsvParseError(result)) {
      setCsvAttachError(result.error);
      return;
    }
    const hash = await hashFile(file).catch(() => null);
    setAttachedCsv({ file, name: file.name, size: file.size, headers: result.headers, rows: result.rows, hash });
    setAwaitingTagAnswer(false);
    setAwaitingFileConflictAnswer(false);
  };

  const handleCsvFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleAttachCsvFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const removeAttachedCsv = () => {
    setAttachedCsv(null);
    setAwaitingTagAnswer(false);
    setAwaitingFileConflictAnswer(false);
    setPendingImportTag(null);
    setCsvAttachError('');
  };

  const sayInChat = (text: string) => setChatLogs(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'assistant', text, timestamp: nowStamp() }]);

  // Runs the actual import for a resolved tag + lead-duplicate choice — only ever called
  // after the file-level conflict check, the tag-reuse check, AND the lead-level
  // duplicate preview (see previewThenImportForCsv / checkTagReuseThenImportForCsv, and
  // the ImportDuplicateChoiceModal handler below) have all been settled. Component-scoped
  // (not a closure over a specific `attachedCsv`) so a modal callback firing after the
  // CSV attachment has already been cleared can still call it with the csvName/csvHash
  // it captured earlier.
  const runImportForCsv = async (
    leadsWithTag: any[],
    finalTag: string | null,
    csvName: string,
    csvHash: string | null,
    includeDuplicates: boolean
  ) => {
    // bulkImportLeads runs the exact-duplicate rule itself (every relevant field
    // identical after safe normalization, tag included — see lib/dedupe.ts) against
    // this batch AND existing Supabase rows, unless the caller already asked and the
    // user chose to include duplicates.
    const importResult = await bulkImportLeads(leadsWithTag, { includeDuplicates });
    const { count, supabaseResult } = importResult;

    if (finalTag) setLastUsedCsvTag(finalTag);
    if (csvHash) recordCsvFileUpload(csvHash, csvName, finalTag, leadsWithTag.length);

    const importedOk = count > 0;
    const lines = [
      `Import Complete`,
      `✓ CSV: ${csvName}`,
      `✓ Total leads in file: ${importResult.totalRows}`,
      `✓ Duplicate leads: ${importResult.duplicatesSkipped}`,
      importedOk ? `✓ New leads imported: ${count}` : `✗ No new leads were imported`,
    ];
    if (importResult.duplicatesSkipped > 0) {
      lines.push(`✓ Leads skipped: ${importResult.duplicatesSkipped}`);
    } else if (includeDuplicates) {
      lines.push(`✓ Imported every row from the file, including duplicates, as you chose.`);
    }
    lines.push(finalTag ? `✓ Tag: ${finalTag}` : `✓ No tag assigned`);
    if (!supabaseResult.success && supabaseResult.error) {
      lines.push(`⚠ Supabase sync issue: ${supabaseResult.error} — contacts were added locally but may not be fully synced yet.`);
    }
    sayInChat(lines.join('\n'));

    onShowMessage(
      importedOk ? `Imported ${count} contact(s) from ${csvName}${finalTag ? ` tagged "${finalTag}"` : ''}.` : `Import from ${csvName} added no contacts.`,
      importedOk ? 'success' : 'error'
    );
    if (onRefreshLeads) onRefreshLeads();

    // Mandatory popup (never just the chat) whenever exact duplicates were found.
    if (importResult.duplicatesSkipped > 0) {
      setDuplicateModalResult(importResult);
      setDuplicateModalCsvName(csvName);
      setIsDuplicateModalOpen(true);
    }
  };

  const handleDuplicateChoiceForCsv = async (choice: 'only-new' | 'full-file') => {
    const pending = pendingDuplicateChoice;
    setPendingDuplicateChoice(null);
    if (!pending) return;
    await runImportForCsv(pending.leadsWithTag, pending.finalTag, pending.csvName, pending.csvHash, choice === 'full-file');
  };

  // Lead-level duplicate check — separate from the file-level one below (see
  // lib/dedupe.ts). Runs whether an explicit tag was resolved for this upload or not
  // (finalTag may be null) — the comparison is about the lead data + tag, never the
  // filename. Only asks when it actually finds duplicates mixed with new leads; a clean
  // file imports immediately with no extra step. Component-scoped for the same reason as
  // runImportForCsv — the tag-reuse "Keep" choice below needs to call this after
  // attachedCsv has already been cleared.
  const previewThenImportForCsv = async (csv: AttachedCsv, finalTag: string | null) => {
    const mapping = buildAutoMapping(csv.headers);
    const mappedLeads = mapRowsToLeads(csv.rows, mapping, csv.headers);

    if (mappedLeads.length === 0) {
      sayInChat(`I parsed "${csv.name}" but found no usable contact rows in it — nothing was imported.`);
      return;
    }

    const leadsWithTag = mappedLeads.map((l: any) => ({ ...l, csvTag: finalTag }));
    const preview = await previewBulkImportDuplicates(leadsWithTag);

    if (preview.duplicatesSkipped > 0) {
      setPendingDuplicateChoice({ leadsWithTag, finalTag, preview, csvName: csv.name, csvHash: csv.hash });
      sayInChat(`I found ${preview.duplicatesSkipped} duplicate lead${preview.duplicatesSkipped === 1 ? '' : 's'} and ${preview.uniqueRows} new lead${preview.uniqueRows === 1 ? '' : 's'} in "${csv.name}"${finalTag ? ` (tag "${finalTag}")` : ''}. Choose how to import it from the popup.`);
      return;
    }
    await runImportForCsv(leadsWithTag, finalTag, csv.name, csv.hash, false);
  };

  // Tag-reuse check — a separate concern from the file-level and lead-level checks. Only
  // fires for an explicit, non-blank tag that already has live leads under it (never for
  // an untagged upload — there's no specific tag identity to warn about). Tag names must
  // be unique per upload — this never offers a "keep using it anyway" bypass; the import
  // cannot continue until a free tag name is provided (see TagAlreadyInUseModal) or the
  // user cancels.
  const checkTagReuseThenImportForCsv = async (csv: AttachedCsv, finalTag: string | null) => {
    if (finalTag) {
      const activeTags = await getActiveTagSet();
      if (activeTags && activeTags.has(normalizeTagKey(finalTag))) {
        setPendingTagReuse({ csv, finalTag });
        sayInChat(`The tag "${finalTag}" is already being used. Please enter a different tag name in the popup before I import this file.`);
        return;
      }
    }
    await previewThenImportForCsv(csv, finalTag);
  };

  // Re-validates whatever tag name the user just typed into the conflict modal. Only
  // resolves `ok: true` once it's confirmed free — TagAlreadyInUseModal keeps asking
  // otherwise (even if they typed back the exact same conflicting name), so the import
  // can never proceed under a still-taken tag name.
  const handleTagConflictSubmitForCsv = async (newTag: string): Promise<{ ok: boolean }> => {
    const activeTags = await getActiveTagSet();
    if (activeTags && activeTags.has(normalizeTagKey(newTag))) {
      return { ok: false };
    }
    const pending = pendingTagReuse;
    setPendingTagReuse(null);
    if (pending) await previewThenImportForCsv(pending.csv, newTag);
    return { ok: true };
  };

  const handleTagConflictCancelForCsv = () => {
    setPendingTagReuse(null);
    sayInChat('Import cancelled — nothing was added.');
  };

  // Executes the CSV-via-chat upload flow: tag resolution (Case A–D) → file-level
  // duplicate check (separate from lead-level duplicates) → tag-reuse check → import.
  // Runs instead of handleExecuteNLCommand whenever a CSV is currently attached.
  const handleCsvUploadCommand = async () => {
    const csv = attachedCsv;
    if (!csv) return;
    const messageText = naturalPrompt.trim();
    const wasAwaitingTag = awaitingTagAnswer;
    const wasAwaitingFileConflict = awaitingFileConflictAnswer;

    setChatLogs(prev => [...prev, {
      id: Date.now().toString(),
      sender: 'user',
      text: messageText ? `📎 ${csv.name}\n${messageText}` : `📎 ${csv.name}`,
      timestamp: nowStamp(),
    }]);
    setNaturalPrompt('');
    setIsProcessingCsv(true);

    const say = sayInChat;

    // File-level duplicate check — separate from lead-level exact duplicates. Runs
    // right before import, once the tag to use is known. Only a still-ACTIVE prior
    // upload (verified live against Supabase, not just "ever recorded") can trigger
    // this — a deleted CSV is always treated as brand new, its old tag never restored.
    const checkFileThenImport = async (finalTag: string | null) => {
      if (!csv.hash) {
        await checkTagReuseThenImportForCsv(csv, finalTag);
        return;
      }
      const conflict = await resolveFileConflict(csv.hash, finalTag);
      const tagLabel = finalTag || '(no tag)';
      if (conflict.status === 'same-active-tag') {
        say(`This exact CSV file was already imported as "${tagLabel}". Nothing new was imported.`);
        return;
      }
      if (conflict.status === 'different-active-tag') {
        setPendingImportTag(finalTag);
        setAwaitingFileConflictAnswer(true);
        say(`This CSV file has already been uploaded with a different tag (${conflict.activeTags.join(', ')}). Would you like to **upload both** (keep the same lead data, add "${tagLabel}" alongside the existing tag) or **consider only one file** (skip this — keep it as ${conflict.activeTags.join(', ')})?`);
        return;
      }
      // status === 'new' — either never uploaded, or every prior recorded tag for this
      // exact file has since been deleted. Never restore the old tag; §19 — current
      // Supabase state outranks chat history/local registry as proof of what's active.
      if (conflict.wasPreviouslyDeleted) {
        say(`This CSV was previously deleted, so I'm treating this as a new upload.`);
      }
      await checkTagReuseThenImportForCsv(csv, finalTag);
    };

    try {
      // Out-of-scope: deleting a CSV/its members through chat isn't implemented yet —
      // decline honestly instead of silently mis-reading it as an upload.
      if (!wasAwaitingTag && !wasAwaitingFileConflict && CSV_DELETE_INTENT_RE.test(messageText)) {
        say("I can't delete CSVs or their members through chat yet. Use the CSV tag search + \"Delete Tagged CSV Data\" control in the left filters sidebar for that.");
        removeAttachedCsv();
        return;
      }

      if (wasAwaitingFileConflict) {
        const lower = messageText.toLowerCase();
        if (/\bboth\b/.test(lower)) {
          await checkTagReuseThenImportForCsv(csv, pendingImportTag);
        } else if (/\b(one|only|single|skip|existing)\b/.test(lower)) {
          say(`Kept this CSV under its existing tag. Nothing new was imported.`);
        } else {
          say('Please reply "upload both" or "consider only one file."');
          setIsProcessingCsv(false);
          return; // keep waiting
        }
        return;
      }

      let finalTag: string | null;

      if (wasAwaitingTag) {
        // This message IS the answer to "which tag should I use?" — a bare word/phrase
        // reply counts as the tag itself here, no "... tag" phrasing required.
        if (!messageText) {
          say("I still need a tag name, or let me know to leave these untagged.");
          setIsProcessingCsv(false);
          return; // keep attachedCsv + awaitingTagAnswer, ask again
        }
        if (NO_TAG_RE.test(messageText) || /^(none|no|nothing|skip|untagged)$/i.test(messageText)) {
          finalTag = null;
        } else {
          finalTag = messageText.replace(/\s+/g, '-');
        }
      } else {
        const tagRes = resolveCsvTagIntent(messageText, lastUsedCsvTag);
        if (tagRes.needsClarification) {
          setAwaitingTagAnswer(true);
          say(tagRes.clarificationQuestion!);
          setIsProcessingCsv(false);
          return; // keep attachedCsv, wait for the next message to answer it
        }
        finalTag = tagRes.tag; // explicit tag, explicit null, or unspecified→null (never invented)
      }

      await checkFileThenImport(finalTag);
    } catch (err: any) {
      console.error('AI CSV upload failed:', err);
      say(`I couldn't complete this import — ${err?.message || 'an unexpected error occurred'}. Nothing further was changed.`);
    } finally {
      setIsProcessingCsv(false);
      removeAttachedCsv();
    }
  };

  const handleSendComposer = () => {
    if (attachedCsv) {
      handleCsvUploadCommand();
    } else {
      handleExecuteNLCommand();
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
Operon AI Growth Team`;

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
    <div className="w-[430px] shrink-0 border-l border-[var(--border-subtle)] bg-[var(--surface-card)] flex flex-col h-full shadow-2xl relative z-30 animate-slideIn">
      
      {/* Drawer Header */}
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-gradient-to-r from-indigo-50/40 via-[var(--surface-card)] to-[var(--surface-card)] dark:from-indigo-500/10">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[var(--text-primary)] leading-none font-display tracking-tight">Operon AI Assistant</h2>
            <span className="text-4xs uppercase tracking-wider text-indigo-600 font-black block mt-1 font-mono">
              Natural Language Command & Control
            </span>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-[var(--surface-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-[var(--border-subtle)] p-1 bg-[var(--surface-card-header)] shrink-0 select-none">
        <button
          onClick={() => setActiveTab('assistant')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1 transition-all ${
            activeTab === 'assistant' 
              ? 'bg-[var(--surface-card)] text-indigo-700 shadow-3xs border border-[var(--border-subtle)]' 
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>AI Command</span>
        </button>
        <button
          onClick={() => setActiveTab('pitch')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1 transition-all ${
            activeTab === 'pitch' 
              ? 'bg-[var(--surface-card)] text-indigo-700 shadow-3xs border border-[var(--border-subtle)]' 
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Pitch</span>
        </button>
        <button
          onClick={() => setActiveTab('matcher')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center space-x-1 transition-all ${
            activeTab === 'matcher' 
              ? 'bg-[var(--surface-card)] text-indigo-700 shadow-3xs border border-[var(--border-subtle)]' 
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
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
            <div className="flex-1 bg-[var(--surface-card-header)] border border-[var(--border-subtle)] rounded-xl p-3 space-y-3 min-h-[300px] overflow-y-auto font-sans">
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
                        : 'bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)] rounded-bl-none shadow-3xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {/* Result Details Card */}
                    {msg.result && msg.result.action === 'create' && msg.result.newLeadData && (
                      <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-2xs text-[var(--text-secondary)] space-y-1 bg-emerald-50/50 p-2 rounded-lg">
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
                      <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-2xs text-[var(--text-secondary)] space-y-1 bg-amber-50/50 p-2 rounded-lg">
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
                  <span className="text-[9px] text-[var(--text-muted)] mt-1 px-1 font-mono">{msg.timestamp}</span>
                </div>
              ))}

              {isProcessingCommand && (
                <div className="flex items-center space-x-2 text-xs text-indigo-600 font-semibold bg-[var(--surface-card)] p-2.5 rounded-xl border border-[var(--border-subtle)]">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>AI Assistant is understanding and executing payload...</span>
                </div>
              )}
            </div>

            {/* CSV attachment error */}
            {csvAttachError && (
              <div className="flex items-start space-x-2 px-3 py-2 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-400/20 rounded-xl text-2xs font-semibold text-rose-700 dark:text-rose-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{csvAttachError}</span>
              </div>
            )}

            {/* Attached CSV chip — Design.md §19 "attachment context" */}
            {attachedCsv && (
              <div className="flex items-center justify-between px-3 py-2 bg-[var(--accent-primary-soft)] border border-violet-300 dark:border-violet-400/30 rounded-xl animate-fadeIn">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xs font-extrabold text-[var(--text-primary)] truncate">{attachedCsv.name}</p>
                    <p className="text-3xs text-[var(--text-muted)] font-medium">{attachedCsv.rows.length} rows • {(attachedCsv.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <button
                  onClick={removeAttachedCsv}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                  title="Remove attachment"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {awaitingTagAnswer && (
              <div className="flex items-center space-x-1.5 px-1 text-3xs font-bold text-violet-600">
                <Tag className="w-3 h-3" />
                <span>Waiting for a tag answer for "{attachedCsv?.name}"</span>
              </div>
            )}

            {/* Input Bar */}
            <div className="relative">
              <input
                type="file"
                ref={csvFileInputRef}
                accept=".csv"
                onChange={handleCsvFileInputChange}
                className="hidden"
              />
              <textarea
                value={naturalPrompt}
                onChange={(e) => setNaturalPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendComposer();
                  }
                }}
                placeholder={attachedCsv ? "e.g. 'Upload this with the SaaS Founders tag' or 'Upload this without a tag'" : "Type natural language command... e.g. 'Search Procurement Managers' or 'Add lead VP Sales at Acme Corp' or attach a CSV to import contacts"}
                rows={2}
                className="w-full text-xs p-3 pr-16 pl-10 border border-[var(--border-subtle)] rounded-xl focus:outline-hidden focus:border-indigo-500 resize-none bg-[var(--surface-card)] font-medium shadow-3xs"
              />
              <button
                onClick={() => csvFileInputRef.current?.click()}
                disabled={isProcessingCommand || isProcessingCsv}
                className="absolute left-2.5 bottom-3.5 p-1.5 text-[var(--text-muted)] hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-lg disabled:opacity-40 transition-colors cursor-pointer"
                title="Attach a CSV to import contacts"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                onClick={handleSendComposer}
                disabled={isProcessingCommand || isProcessingCsv || (!naturalPrompt.trim() && !attachedCsv)}
                className="absolute right-2.5 bottom-3.5 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-40 transition-colors shadow-sm cursor-pointer"
                title={attachedCsv ? "Send / Import CSV" : "Send AI Command"}
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
            <div className="bg-[var(--surface-card-header)] rounded-xl p-4 border border-[var(--border-subtle)] relative">
              <h3 className="text-2xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider mb-2.5 flex items-center space-x-1">
                <User className="w-3.5 h-3.5" />
                <span>Target Lead Profile</span>
              </h3>
              
              {selectedLeads.length > 0 ? (
                <div className="space-y-3">
                  {selectedLeads.length > 1 && (
                    <div className="mb-2">
                      <label className="block text-4xs font-extrabold text-[var(--text-muted)] uppercase mb-1">
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
                        className="w-full text-xs font-bold text-[var(--text-secondary)] py-1 px-2 border border-[var(--border-subtle)] rounded-lg bg-[var(--surface-card)] focus:outline-hidden focus:border-indigo-500"
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
                      <div className="font-extrabold text-sm text-[var(--text-primary)]">
                        {selectedLeadForPitch.firstName} {selectedLeadForPitch.lastName || ''}
                      </div>
                      
                      <div className="space-y-1.5 mt-2.5">
                        {selectedLeadForPitch.jobTitle && (
                          <div className="flex items-center text-xs text-[var(--text-secondary)] font-medium">
                            <Briefcase className="w-3.5 h-3.5 text-[var(--text-muted)] mr-2 shrink-0" />
                            <span>{selectedLeadForPitch.jobTitle}</span>
                          </div>
                        )}
                        {selectedLeadForPitch.organization && (
                          <div className="flex items-center text-xs text-[var(--text-secondary)] font-medium">
                            <Building className="w-3.5 h-3.5 text-[var(--text-muted)] mr-2 shrink-0" />
                            <span className="font-bold text-indigo-600">{selectedLeadForPitch.organization}</span>
                          </div>
                        )}
                        {selectedLeadForPitch.city && (
                          <div className="flex items-center text-xs text-[var(--text-secondary)] font-medium">
                            <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)] mr-2 shrink-0" />
                            <span>{selectedLeadForPitch.city}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 px-2">
                  <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
                    No lead selected. Check the checkbox next to any lead in the directory table to load their context.
                  </p>
                </div>
              )}
            </div>

            {selectedLeadForPitch && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-4xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                      Outreach Angle
                    </label>
                    <select
                      value={outreachAngle}
                      onChange={(e) => setOutreachAngle(e.target.value)}
                      className="w-full text-xs font-semibold text-[var(--text-secondary)] py-1.5 px-2.5 border border-[var(--border-subtle)] rounded-lg bg-[var(--surface-card)] focus:outline-hidden focus:border-indigo-500 cursor-pointer shadow-3xs"
                    >
                      <option value="Value-First Pitch">Value-First Pitch</option>
                      <option value="Quick Intro">Quick Intro</option>
                      <option value="Pain-Point Centric">Pain-Point Centric</option>
                      <option value="Coffee Meeting Invitation">Coffee Meeting Invitation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-4xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                      Pitch Tone
                    </label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full text-xs font-semibold text-[var(--text-secondary)] py-1.5 px-2.5 border border-[var(--border-subtle)] rounded-lg bg-[var(--surface-card)] focus:outline-hidden focus:border-indigo-500 cursor-pointer shadow-3xs"
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
              <div className="space-y-4 pt-3 border-t border-[var(--border-subtle)] animate-fadeIn">
                <div className="space-y-1 bg-[var(--surface-card-header)] border border-[var(--border-subtle)] rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-4xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider">
                      Subject Line
                    </span>
                    <button
                      onClick={() => handleCopy(pitchResult.subject, 'subject')}
                      className="p-1 text-[var(--text-muted)] hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center space-x-1"
                    >
                      {copiedSubject ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="text-4xs font-bold">{copiedSubject ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-xs font-extrabold text-[var(--text-primary)] bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg p-2 mt-1">
                    {pitchResult.subject}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-4xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider">
                      Personalized Pitch Body
                    </span>
                    <button
                      onClick={() => handleCopy(pitchResult.body, 'body')}
                      className="p-1 text-[var(--text-muted)] hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center space-x-1"
                    >
                      {copiedBody ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span className="text-4xs font-bold">{copiedBody ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] font-medium bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl p-3.5 mt-1 leading-relaxed whitespace-pre-wrap font-sans">
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
                  className="w-full text-xs p-3 pr-10 border border-[var(--border-subtle)] rounded-xl focus:outline-hidden focus:border-indigo-500 resize-none bg-[var(--surface-card)] font-medium"
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
                  <h4 className="text-3xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider">
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
                      className="group bg-[var(--surface-card)] hover:bg-indigo-50/20 border border-[var(--border-subtle)] hover:border-indigo-200 rounded-xl p-3 cursor-pointer transition-all flex items-start justify-between"
                    >
                      <div className="space-y-1 flex-1 pr-3">
                        <span className="font-extrabold text-xs text-[var(--text-primary)] group-hover:text-indigo-900 block">
                          Lead #{match.leadId}
                        </span>
                        <p className="text-xs font-semibold text-[var(--text-secondary)] italic">
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
      <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface-card-header)] shrink-0 text-center flex items-center justify-between text-3xs font-black text-[var(--text-muted)] uppercase tracking-widest select-none font-mono">
        <span>Credits Remaining</span>
        <span className="text-indigo-700 text-xs font-black font-mono">{creditBalance} Cr</span>
      </div>

      <DuplicateLeadsModal
        isOpen={isDuplicateModalOpen}
        onClose={() => { setIsDuplicateModalOpen(false); if (onRefreshLeads) onRefreshLeads(); }}
        result={duplicateModalResult}
        csvName={duplicateModalCsvName}
      />

      <TagAlreadyInUseModal
        isOpen={!!pendingTagReuse}
        tag={pendingTagReuse?.finalTag || ''}
        onSubmit={handleTagConflictSubmitForCsv}
        onCancel={handleTagConflictCancelForCsv}
      />

      <ImportDuplicateChoiceModal
        isOpen={!!pendingDuplicateChoice}
        preview={pendingDuplicateChoice?.preview || null}
        fileName={pendingDuplicateChoice?.csvName}
        tagLabel={pendingDuplicateChoice?.finalTag || null}
        onChoose={handleDuplicateChoiceForCsv}
        onCancel={() => {
          setPendingDuplicateChoice(null);
          sayInChat('Import cancelled — nothing was added.');
        }}
      />

    </div>
  );
};
