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
  if (/(chief|\bceo\b|\bcto\b|\bcfo\b|\bcoo\b|\bcmo\b|\bcio\b|\bciso\b|president|founder|co-founder|owner|proprietor|chairman|chairperson|board member|partner\b)/.test(t)) return 'C-Suite';
  if (/(\bvp\b|vice president|svp|evp)/.test(t)) return 'VP';
  if (/(director|head of|\bhod\b)/.test(t)) return 'Director';
  if (/(principal|staff\b)/.test(t)) return 'Senior';
  if (/(senior|sr\.?\s)/.test(t)) return 'Senior';
  if (/(manager|lead\b|supervisor|team lead)/.test(t)) return 'Manager';
  if (/(intern|trainee|junior|jr\.?\s|entry.level)/.test(t)) return 'Entry Level';
  if (/(associate|analyst|specialist|coordinator|executive\b|representative|assistant)/.test(t)) return 'Individual Contributor';
  return 'Individual Contributor';
}

function inferDepartment(jobTitle: string): string | null {
  const t = jobTitle.toLowerCase();
  if (!t || t === '-') return null;
  if (/(market|brand|growth|content|seo|\bppc\b|social media)/.test(t)) return 'Marketing';
  if (/(sales|business development|\bbd\b|account exec|account manager)/.test(t)) return 'Sales';
  if (/(engineer|developer|software|programmer|\bit\b|tech(?:nical|nology)?\b|devops|sre|architect|qa\b|quality assurance)/.test(t)) return 'Engineering';
  if (/(financ|account(?:ant|ing)|\bcfo\b|treasury|audit|controller)/.test(t)) return 'Finance';
  if (/(\bhr\b|human resource|people\b|talent|recruit)/.test(t)) return 'Human Resources';
  if (/(operations|\bops\b|logistics|supply chain|procurement)/.test(t)) return 'Operations';
  if (/(legal|counsel|attorney|compliance)/.test(t)) return 'Legal';
  if (/(product\b)/.test(t)) return 'Product';
  if (/(customer success|customer support|customer service|support\b)/.test(t)) return 'Customer Success';
  if (/(design|\bux\b|\bui\b|creative)/.test(t)) return 'Design';
  if (/(data\b|analytics|\bbi\b|scientist)/.test(t)) return 'Data & Analytics';
  if (/(security|\bciso\b|infosec)/.test(t)) return 'Security';
  if (/(research|\br&d\b)/.test(t)) return 'Research & Development';
  if (/(admin|office manager|executive assistant)/.test(t)) return 'Administration';
  return null;
}

// Company-name → industry. Only signals genuinely legible from the name itself (sector
// words, legal-entity hints like "Bank"/"Hospital") — never a guess based on size, logo,
// or anything not actually present in the string.
function inferIndustryFromOrg(orgName: string): string | null {
  const c = orgName.toLowerCase();
  if (!c || c === '-') return null;
  if (/(bank|financial|capital|invest|insurance|wealth|asset management)/.test(c)) return 'Financial Services';
  if (/(hospital|health|medical|clinic|pharma|diagnostic|wellness)/.test(c)) return 'Healthcare';
  if (/(university|school|college|institute|education|academy|edtech)/.test(c)) return 'Education';
  if (/(tech|software|digital|systems|labs?\b|\bai\b|\bsaas\b|data|cloud|analytics)/.test(c)) return 'Technology';
  if (/(retail|store|shop|mart|ecommerce|e-commerce)/.test(c)) return 'Retail';
  if (/(law|legal|associates|llp|attorneys)/.test(c)) return 'Legal Services';
  if (/(consult)/.test(c)) return 'Consulting';
  if (/(manufactur|industries|steel|textile|factory)/.test(c)) return 'Manufacturing';
  if (/(realty|real estate|properties|builders|construction|infra)/.test(c)) return 'Real Estate & Construction';
  if (/(media|studio|films?\b|entertainment|broadcast|records)/.test(c)) return 'Media & Entertainment';
  if (/(auto|motors|vehicles?\b)/.test(c)) return 'Automotive';
  if (/(energy|power|solar|oil|gas\b|petroleum)/.test(c)) return 'Energy';
  if (/(logistics|transport|shipping|freight|cargo)/.test(c)) return 'Transportation & Logistics';
  if (/(telecom|wireless|network)/.test(c)) return 'Telecommunications';
  if (/(foundation|\bngo\b|nonprofit|non-profit|trust\b|charity)/.test(c)) return 'Nonprofit';
  if (/(government|ministry|municipal|\bgovt\b)/.test(c)) return 'Government';
  if (/(food|beverage|restaurant|cafe|catering)/.test(c)) return 'Food & Beverage';
  if (/(agri|farm|agro)/.test(c)) return 'Agriculture';
  if (/(hotel|resort|travel|tourism|hospitality)/.test(c)) return 'Hospitality & Travel';
  return null;
}

// Fallback signal used ONLY when the company name gives nothing legible — a job title
// alone can still honestly imply an industry (e.g. "ICU Nurse" → Healthcare even at a
// genetically-named employer). Never invents an industry the title doesn't actually
// suggest.
function inferIndustryFromTitle(jobTitle: string): string | null {
  const t = jobTitle.toLowerCase();
  if (!t || t === '-') return null;
  if (/(nurse|physician|doctor|surgeon|clinician|therapist|dentist|pharmacist)/.test(t)) return 'Healthcare';
  if (/(teacher|professor|lecturer|principal educator|instructor)/.test(t)) return 'Education';
  if (/(software|developer|programmer|devops|data scientist|\bml\b engineer)/.test(t)) return 'Technology';
  if (/(attorney|lawyer|legal counsel|solicitor)/.test(t)) return 'Legal Services';
  if (/(banker|underwriter|actuary|financial advisor)/.test(t)) return 'Financial Services';
  if (/(chef|restaurateur|hotelier)/.test(t)) return 'Hospitality & Travel';
  if (/(architect|civil engineer|site engineer)/.test(t)) return 'Real Estate & Construction';
  if (/(pilot|logistics coordinator|fleet manager)/.test(t)) return 'Transportation & Logistics';
  return null;
}

function inferIndustry(lead: Lead): string | null {
  return inferIndustryFromOrg(lead.organization || '') || inferIndustryFromTitle(lead.jobTitle || '');
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
    () => leads.filter(l => isBlank(l.industry) && (!isBlank(l.organization) || !isBlank(l.jobTitle)) && inferIndustry(l) !== null),
    [leads]
  );

  const runEnrichment = async (
    field: 'seniority' | 'department' | 'industry',
    candidates: Lead[],
    infer: (l: Lead) => string | null,
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
        const value = infer(l);
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
                    infer: (l: Lead) => inferSeniority(l.jobTitle || ''),
                  },
                  {
                    field: 'department' as const,
                    label: 'Infer Department from Job Titles',
                    desc: '"Sales Manager" → Department: Sales, etc.',
                    candidates: departmentCandidates,
                    infer: (l: Lead) => inferDepartment(l.jobTitle || ''),
                  },
                  {
                    field: 'industry' as const,
                    label: 'Infer Industry from Company & Job Title',
                    desc: '"Apex Bank Ltd" → Financial Services · "ICU Nurse" → Healthcare, etc.',
                    candidates: industryCandidates,
                    infer: (l: Lead) => inferIndustry(l),
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
                      onClick={() => runEnrichment(action.field, action.candidates, action.infer, action.label)}
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
