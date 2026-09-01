import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Database, Sparkles, Check, ShieldCheck } from 'lucide-react';
import { Lead } from '../types.ts';

interface DataEnhancementModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
  creditBalance: number;
  onApplyEnrichment: (updates: Array<{ id: number; field: 'seniority' | 'department' | 'industry'; value: string }>) => Promise<void>;
}

const isBlank = (v: any) => v === undefined || v === null || v === '' || v === '-';

// Conservative, honest heuristics derived from data the contact already has — never
// fabricated contact details (no invented phone numbers/emails/LinkedIn URLs, which
// could be mistaken for real data and acted on). Only fills a field when it's blank;
// never overwrites an existing value.
function inferSeniority(jobTitle: string): string | null {
  const t = jobTitle.toLowerCase();
  if (!t || t === '-') return null;
  if (/(chief|ceo|cto|cfo|coo|cmo|president|founder|owner)/.test(t)) return 'C-Suite';
  if (/(vp|vice president)/.test(t)) return 'VP';
  if (/(director|head of)/.test(t)) return 'Director';
  if (/(senior|sr\.)/.test(t)) return 'Senior';
  if (/(manager|lead)/.test(t)) return 'Manager';
  return 'Individual Contributor';
}

function inferDepartment(jobTitle: string): string | null {
  const t = jobTitle.toLowerCase();
  if (!t || t === '-') return null;
  if (/(market)/.test(t)) return 'Marketing';
  if (/(sales|business development|\bbd\b|account exec)/.test(t)) return 'Sales';
  if (/(engineer|developer|software|it\b|tech)/.test(t)) return 'Engineering';
  if (/(financ|account|cfo)/.test(t)) return 'Finance';
  if (/(hr\b|human resource|people)/.test(t)) return 'Human Resources';
  if (/(operations|\bops\b)/.test(t)) return 'Operations';
  if (/(legal|counsel)/.test(t)) return 'Legal';
  if (/(product)/.test(t)) return 'Product';
  if (/(customer success|support)/.test(t)) return 'Customer Success';
  return null;
}

function inferIndustry(orgName: string): string | null {
  const c = orgName.toLowerCase();
  if (!c || c === '-') return null;
  if (/(bank|financial|capital|invest|insurance)/.test(c)) return 'Financial Services';
  if (/(hospital|health|medical|clinic|pharma)/.test(c)) return 'Healthcare';
  if (/(university|school|college|institute|education|academy)/.test(c)) return 'Education';
  if (/(tech|software|digital|systems|labs?\b|\bai\b|data|cloud)/.test(c)) return 'Technology';
  if (/(retail|store|shop|mart)/.test(c)) return 'Retail';
  if (/(law|legal|associates|llp)/.test(c)) return 'Legal Services';
  if (/(consult)/.test(c)) return 'Consulting';
  if (/(manufactur|industries|steel|textile|factory)/.test(c)) return 'Manufacturing';
  return null;
}

export default function DataEnhancementModal({ isOpen, onClose, leads, creditBalance, onApplyEnrichment }: DataEnhancementModalProps) {
  const [isRunning, setIsRunning] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const completeness = useMemo(() => {
    const total = leads.length || 1;
    const missing = (pred: (l: Lead) => boolean) => leads.filter(pred).length;
    return {
      email: missing(l => isBlank(l.email)),
      phone: missing(l => isBlank(l.phone)),
      jobTitle: missing(l => isBlank(l.jobTitle)),
      organization: missing(l => isBlank(l.organization)),
      seniority: missing(l => isBlank(l.seniority)),
      department: missing(l => isBlank(l.department)),
      industry: missing(l => isBlank(l.industry)),
      linkedinUrl: missing(l => isBlank(l.linkedinUrl)),
      total: leads.length,
    };
  }, [leads]);

  const seniorityCandidates = useMemo(
    () => leads.filter(l => isBlank(l.seniority) && !isBlank(l.jobTitle) && inferSeniority(l.jobTitle!) !== null),
    [leads]
  );
  const departmentCandidates = useMemo(
    () => leads.filter(l => isBlank(l.department) && !isBlank(l.jobTitle) && inferDepartment(l.jobTitle!) !== null),
    [leads]
  );
  const industryCandidates = useMemo(
    () => leads.filter(l => isBlank(l.industry) && !isBlank(l.organization) && inferIndustry(l.organization!) !== null),
    [leads]
  );

  const runEnrichment = async (
    field: 'seniority' | 'department' | 'industry',
    candidates: Lead[],
    infer: (source: string) => string | null,
    sourceKey: 'jobTitle' | 'organization',
    label: string
  ) => {
    if (candidates.length === 0) return;
    if (creditBalance < candidates.length) {
      setLastResult(`Not enough credits — need ${candidates.length}, have ${creditBalance}.`);
      return;
    }
    setIsRunning(field);
    const updates = candidates
      .map(l => {
        const value = infer((l as any)[sourceKey] || '');
        return value ? { id: l.id, field, value } : null;
      })
      .filter(Boolean) as Array<{ id: number; field: typeof field; value: string }>;

    await onApplyEnrichment(updates);
    setIsRunning(null);
    setLastResult(`${label}: filled in ${updates.length} contact${updates.length !== 1 ? 's' : ''}.`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.35 }}
            className="w-full max-w-xl glass-modal overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-1.5">
                    Data Enhancement
                    <span className="px-1.5 py-0.1 text-[9px] font-black bg-violet-600 text-white rounded-full">PRO</span>
                  </h3>
                  <p className="text-3xs text-[var(--text-muted)] font-medium">Fill gaps using data you already have — never fabricated</p>
                </div>
              </div>
              <button onClick={onClose} className="btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {/* Data completeness overview */}
              <div>
                <h4 className="text-3xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Data Completeness ({completeness.total} contacts)</h4>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Email', missing: completeness.email },
                    { label: 'Phone', missing: completeness.phone },
                    { label: 'Seniority', missing: completeness.seniority },
                    { label: 'Department', missing: completeness.department },
                    { label: 'Industry', missing: completeness.industry },
                    { label: 'Job Title', missing: completeness.jobTitle },
                    { label: 'Company', missing: completeness.organization },
                    { label: 'LinkedIn', missing: completeness.linkedinUrl },
                  ].map(f => (
                    <div key={f.label} className="p-2.5 bg-[var(--surface-card-header)] border border-[var(--border-subtle)] rounded-lg text-center">
                      <div className={`text-sm font-extrabold ${f.missing === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{f.missing}</div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] mt-0.5">{f.label} missing</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Safe, honest inference actions */}
              <div className="space-y-2.5">
                <h4 className="text-3xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3" /> Auto-Categorize From Existing Data
                </h4>

                {[
                  {
                    field: 'seniority' as const,
                    label: 'Infer Seniority from Job Titles',
                    desc: '"VP Marketing" → Seniority: VP · "CEO" → C-Suite, etc.',
                    candidates: seniorityCandidates,
                    infer: inferSeniority,
                    sourceKey: 'jobTitle' as const,
                  },
                  {
                    field: 'department' as const,
                    label: 'Infer Department from Job Titles',
                    desc: '"Sales Manager" → Department: Sales, etc.',
                    candidates: departmentCandidates,
                    infer: inferDepartment,
                    sourceKey: 'jobTitle' as const,
                  },
                  {
                    field: 'industry' as const,
                    label: 'Infer Industry from Company Names',
                    desc: '"Apex Bank Ltd" → Industry: Financial Services, etc.',
                    candidates: industryCandidates,
                    infer: inferIndustry,
                    sourceKey: 'organization' as const,
                  },
                ].map(action => (
                  <div key={action.field} className="p-3.5 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--text-primary)]">{action.label}</p>
                      <p className="text-3xs text-[var(--text-muted)] mt-0.5">{action.desc}</p>
                      <p className="text-3xs text-indigo-600 font-semibold mt-0.5">{action.candidates.length} contact{action.candidates.length !== 1 ? 's' : ''} eligible · 1 credit each</p>
                    </div>
                    <button
                      disabled={action.candidates.length === 0 || isRunning !== null}
                      onClick={() => runEnrichment(action.field, action.candidates, action.infer, action.sourceKey, action.label)}
                      className="btn-primary shrink-0 !text-xs !py-2 !px-3 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isRunning === action.field ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>Run</span>
                    </button>
                  </div>
                ))}
              </div>

              {lastResult && (
                <div className="flex items-center space-x-2 px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-400/20 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{lastResult}</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
