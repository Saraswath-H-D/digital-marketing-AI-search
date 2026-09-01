import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  Users,
  CheckCircle2,
  Flame,
  PieChart as PieChartIcon,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Lead } from '../types.ts';

interface AnalyticsViewProps {
  leads: Lead[];
}

// Design.md §2/§16: chart series pull from the brand/accent palette ("token-driven
// colours"), never arbitrary hex chosen per-chart.
const CHART_PALETTE = ['#7C3AED', '#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#F472B6', '#8B5CF6'];

const RANGE_DAYS: Record<string, number> = {
  'Today': 1,
  '7 Days': 7,
  '30 Days': 30,
  '90 Days': 90,
  'Custom': 30,
};

// Design.md §16: "tooltip borderRadius:10, border:1px solid rgba(15,23,42,0.08), fontSize:12".
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: 'var(--surface-card-elevated)',
        border: '1px solid rgba(15,23,42,0.08)',
        borderRadius: 10,
        fontSize: 12,
        padding: '8px 12px',
        color: 'var(--text-primary)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      }}
    >
      {label && <div style={{ fontWeight: 700, marginBottom: 2 }}>{label}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey || p.name} style={{ color: p.color || p.payload?.color || p.fill }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsView({ leads }: AnalyticsViewProps) {
  const [timeRange, setTimeRange] = useState<'Today' | '7 Days' | '30 Days' | '90 Days' | 'Custom'>('30 Days');

  const totalCount = leads.length;
  const verifiedCount = leads.filter(l => l.email && l.email !== '-' && !l.email.includes('@imported.com')).length;
  const verifiedPct = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;
  // Real fields only — no fabricated ratios. `intent` and the enrichment fields are
  // written by real user actions (CSV import / Data Enhancement), never invented here.
  const highIntentCount = leads.filter(l => l.intent === 'High Intent').length;
  const enrichedCount = leads.filter(l => (l.industry && l.industry !== '-') || (l.seniority && l.seniority !== '-') || (l.department && l.department !== '-')).length;
  const highIntentPct = totalCount > 0 ? Math.round((highIntentCount / totalCount) * 100) : 0;
  const enrichedPct = totalCount > 0 ? Math.round((enrichedCount / totalCount) * 100) : 0;

  // Design.md §16 Area chart: real day-by-day lead intake for the selected range,
  // bucketed from each lead's own createdAt/registrationTime — never synthetic.
  const trendData = useMemo(() => {
    const days = RANGE_DAYS[timeRange] ?? 30;
    const buckets: { date: string; label: string; count: number }[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      buckets.push({ date: key, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), count: 0 });
    }
    const indexByDate = new Map(buckets.map((b, i) => [b.date, i]));
    leads.forEach(l => {
      const src = l.createdAt || l.registrationTime;
      if (!src) return;
      const d = new Date(src);
      if (isNaN(d.getTime())) return;
      const idx = indexByDate.get(d.toISOString().split('T')[0]);
      if (idx !== undefined) buckets[idx].count += 1;
    });
    return buckets;
  }, [leads, timeRange]);

  const hasTrendData = trendData.some(b => b.count > 0);

  // Design.md §16 Donut/distribution: real counts grouped by each lead's own
  // `industry` field, top 6 + an "Other" remainder — never invented percentages.
  const industryData = useMemo(() => {
    const counts = new Map<string, number>();
    leads.forEach(l => {
      if (l.industry && l.industry !== '-') counts.set(l.industry, (counts.get(l.industry) || 0) + 1);
    });
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 6).map(([name, count], i) => ({ name, count, color: CHART_PALETTE[i % CHART_PALETTE.length] }));
    const otherCount = sorted.slice(6).reduce((acc, [, c]) => acc + c, 0);
    if (otherCount > 0) top.push({ name: 'Other', count: otherCount, color: '#94A3B8' });
    return top;
  }, [leads]);

  const industryTotal = industryData.reduce((acc, d) => acc + d.count, 0);

  // Real seniority distribution, rendered as a single stacked horizontal capacity bar
  // per Design.md §16 ("plain <div> segments coloured by status ... for pixel control").
  const seniorityData = useMemo(() => {
    const counts = new Map<string, number>();
    leads.forEach(l => {
      if (l.seniority && l.seniority !== '-') counts.set(l.seniority, (counts.get(l.seniority) || 0) + 1);
    });
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const palette = ['#7C3AED', '#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#94A3B8'];
    return sorted.slice(0, 6).map(([level, count], i) => ({ level, count, color: palette[i % palette.length] }));
  }, [leads]);

  const seniorityTotal = seniorityData.reduce((acc, d) => acc + d.count, 0);

  return (
    <div className="p-6 space-y-6 animate-fadeIn">
      {/* Top Header & Range Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--surface-card)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-2xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-3xs font-extrabold bg-violet-100 text-violet-700 rounded-full border border-violet-200">
              ENTERPRISE INTELLIGENCE
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">Live Sync</span>
          </div>
          <h2 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight mt-1">Lead Growth & Market Analytics</h2>
          <p className="text-xs text-[var(--text-muted)] font-medium">Real-time performance metrics, intent distribution & deliverability insights.</p>
        </div>

        {/* Date Filters */}
        <div className="flex items-center space-x-1.5 bg-[var(--surface-card-header)] p-1.5 rounded-xl border border-[var(--border-subtle)]">
          {(['Today', '7 Days', '30 Days', '90 Days', 'Custom'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                timeRange === r
                  ? 'bg-[var(--surface-card-elevated)] text-indigo-700 shadow-2xs font-extrabold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-5 bg-gradient-to-br from-violet-50 via-white to-indigo-50/50 border border-violet-200/80 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-extrabold text-violet-700 uppercase tracking-wider">Total Database Leads</span>
            <Users className="w-5 h-5 text-violet-600" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-[var(--text-primary)] tabular-nums">{totalCount.toLocaleString()}</span>
          </div>
          <span className="text-3xs text-[var(--text-muted)] font-medium block mt-1">Verified records in system</span>
        </div>

        <div className="p-5 bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 border border-emerald-200/80 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-extrabold text-emerald-700 uppercase tracking-wider">Verified Deliverability</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-[var(--text-primary)] tabular-nums">{verifiedPct}%</span>
          </div>
          <span className="text-3xs text-[var(--text-muted)] font-medium block mt-1">Direct corporate email verification</span>
        </div>

        <div className="p-5 bg-gradient-to-br from-orange-50 via-white to-rose-50/50 border border-orange-200/80 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-extrabold text-orange-700 uppercase tracking-wider">High Intent Signals</span>
            <Flame className="w-5 h-5 text-orange-600" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-[var(--text-primary)] tabular-nums">{highIntentCount.toLocaleString()}</span>
            <span className="text-xs font-extrabold text-orange-600">{highIntentPct}% of total</span>
          </div>
          <span className="text-3xs text-[var(--text-muted)] font-medium block mt-1">Ready for outreach conversion</span>
        </div>

        <div className="p-5 bg-gradient-to-br from-cyan-50 via-white to-blue-50/50 border border-cyan-200/80 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-extrabold text-cyan-700 uppercase tracking-wider">Enriched Intelligence</span>
            <Sparkles className="w-5 h-5 text-cyan-600" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-[var(--text-primary)] tabular-nums">{enrichedCount.toLocaleString()}</span>
            <span className="text-xs font-extrabold text-cyan-600">{enrichedPct}% coverage</span>
          </div>
          <span className="text-3xs text-[var(--text-muted)] font-medium block mt-1">Tech stack & company data attached</span>
        </div>
      </div>

      {/* Lead intake trend — Design.md §16 Area chart: single accent, gradient fill */}
      <div className="bg-[var(--surface-card)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-[var(--text-primary)]">Lead Intake Trend</h3>
            <p className="text-3xs text-[var(--text-muted)] font-medium">New contacts added to the directory, {timeRange.toLowerCase()}</p>
          </div>
          <TrendingUp className="w-4 h-4 text-sky-600" />
        </div>

        {hasTrendData ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(15,23,42,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="count" name="New leads" stroke="#0EA5E9" strokeWidth={2} fill="url(#trendFill)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[140px] flex items-center justify-center text-xs text-[var(--text-muted)] font-medium">
            No contacts added in this range yet.
          </div>
        )}
      </div>

      {/* Analytics Charts & Distribution Panels */}
      <div className="grid grid-cols-2 gap-6">

        {/* Industry Distribution — Design.md §16 Donut/PieChart with innerRadius + 2-col legend */}
        <div className="bg-[var(--surface-card)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">Industry Breakdown</h3>
              <p className="text-3xs text-[var(--text-muted)] font-medium">Lead distribution across target sectors</p>
            </div>
            <PieChartIcon className="w-4 h-4 text-violet-600" />
          </div>

          {industryData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={industryData} dataKey="count" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2}>
                    {industryData.map((d) => (
                      <Cell key={d.name} fill={d.color} stroke="var(--surface-card)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {industryData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="truncate">{d.name}</span>
                    <span className="text-[var(--text-muted)] font-mono shrink-0 ml-auto">{Math.round((d.count / industryTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[140px] flex items-center justify-center text-xs text-[var(--text-muted)] font-medium text-center px-4">
              No industry data yet — import or enrich contacts to populate this chart.
            </div>
          )}
        </div>

        {/* Seniority Distribution — Design.md §16 stacked horizontal capacity bar */}
        <div className="bg-[var(--surface-card)] p-5 rounded-2xl border border-[var(--border-subtle)] shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">Seniority & Authority Tier</h3>
              <p className="text-3xs text-[var(--text-muted)] font-medium">Decision-making power of directory leads</p>
            </div>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>

          {seniorityData.length > 0 ? (
            <div className="space-y-3">
              <div className="w-full h-3.5 rounded-full overflow-hidden flex bg-[var(--surface-card-header)]">
                {seniorityData.map((s) => (
                  <div
                    key={s.level}
                    style={{ width: `${(s.count / seniorityTotal) * 100}%`, background: s.color }}
                    title={`${s.level}: ${s.count}`}
                  />
                ))}
              </div>
              <div className="space-y-2">
                {seniorityData.map((s) => (
                  <div key={s.level} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--text-secondary)]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                      {s.level}
                    </span>
                    <span className="px-2.5 py-1 text-2xs font-extrabold text-white rounded-lg shadow-2xs" style={{ background: s.color }}>
                      {s.count} Contacts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[140px] flex items-center justify-center text-xs text-[var(--text-muted)] font-medium text-center px-4">
              No seniority data yet — import or enrich contacts to populate this chart.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
