import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Filter,
  CheckCircle,
  Eye,
  Building2,
  ExternalLink,
  ChevronRight,
  Check,
  RotateCcw,
  Calendar,
  Loader2,
  Search,
} from 'lucide-react';
import { ProjectWithSnapshot } from '../types';
import {
  getEarlyWarnings,
  EarlyWarningSignal,
  EarlyWarningsResponse,
  getAvailableMonths,
  AvailableMonthItem,
} from '../services/api';

interface EarlyWarningPageProps {
  projects?: ProjectWithSnapshot[];
  onSelectProject: (projectCode: string, hash?: string) => void;
}

export const EarlyWarningPage: React.FC<EarlyWarningPageProps> = ({
  onSelectProject,
}) => {
  const [monthsList, setMonthsList] = useState<AvailableMonthItem[]>([]);
  const [reportMonth, setReportMonth] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [warningsData, setWarningsData] = useState<EarlyWarningsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMonths = async () => {
      try {
        const months = await getAvailableMonths();
        if (months && months.length > 0) {
          setMonthsList(months);
          setReportMonth((prev) => (prev ? prev : months[0].report_month));
        }
      } catch (err) {
        console.warn('Failed to load available months in EarlyWarningPage:', err);
      }
    };
    loadMonths();
    const handleUpdated = () => loadMonths();
    window.addEventListener('infranetra:month-updated', handleUpdated);
    return () => window.removeEventListener('infranetra:month-updated', handleUpdated);
  }, []);

  const fetchWarnings = async () => {
    if (!reportMonth) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getEarlyWarnings({
        reportMonth,
        severity: severityFilter !== 'ALL' ? severityFilter : undefined,
        limit: 200,
      });
      setWarningsData(data);
    } catch (err: any) {
      console.warn('Failed to load early warnings from database API:', err);
      setError(err?.message || 'Failed to fetch early warnings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (reportMonth) {
      fetchWarnings();
    }
  }, [reportMonth, severityFilter]);

  const rawWarnings: EarlyWarningSignal[] = warningsData?.warnings || [];

  const filteredWarnings = useMemo(() => {
    return rawWarnings.filter((w) => {
      if (categoryFilter !== 'ALL' && w.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mTitle = w.title.toLowerCase().includes(q);
        const mDesc = w.description.toLowerCase().includes(q);
        const mPid = w.project_id.toLowerCase().includes(q);
        const mPname = w.project_name.toLowerCase().includes(q);
        if (!mTitle && !mDesc && !mPid && !mPname) return false;
      }
      return true;
    });
  }, [rawWarnings, categoryFilter, searchQuery]);

  // Counts by severity
  const severityCounts = useMemo(() => {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    rawWarnings.forEach((w) => {
      const s = w.severity.toUpperCase() as keyof typeof counts;
      if (counts[s] !== undefined) {
        counts[s]++;
      }
    });
    return counts;
  }, [rawWarnings]);

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div id="early-warning-page-container" className="space-y-6 pb-16">
      {/* Top Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-[#DC2626]/10 text-[#DC2626] flex items-center justify-center shadow-xs shrink-0 mt-0.5">
              <AlertTriangle className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[#101A3D] tracking-tight">
                  Early Warning Intelligence Feed
                </h1>
                <span className="text-[11px] font-mono-code font-bold uppercase px-2.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">
                  {rawWarnings.length} Active Triggers
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed max-w-2xl">
                Algorithmic threshold breach detection across cost escalation, schedule deferrals, monthly progress stagnation, and expenditure divergence.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-auto">
            {/* Snapshot Selector */}
            <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#CBD5E1] p-1 rounded-lg">
              <Calendar className="w-4 h-4 text-[#0F9D8C] ml-1.5" />
              <select
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              aria-label="Select Early Warning Snapshot"
              className="bg-transparent text-xs font-semibold text-[#101A3D] pr-2 focus:outline-hidden cursor-pointer"
            >
              {monthsList.map((m) => (
                <option key={m.report_month} value={m.report_month}>
                  {m.label} ({m.project_count.toLocaleString()})
                </option>
              ))}
            </select>
            </div>
          </div>
        </div>

        {/* Severity Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#F1F5F9]">
          <div className="p-3 bg-red-50/60 rounded-lg border border-red-100">
            <span className="text-[11px] font-semibold text-red-700 uppercase tracking-wider block">
              Critical Escalations
            </span>
            <span className="text-xl font-bold font-tabular text-red-900 mt-0.5 block">
              {severityCounts.CRITICAL}
            </span>
            <span className="text-[10px] text-red-600 mt-0.5 block">
              Cost &gt;25% or Delay &gt;18m
            </span>
          </div>

          <div className="p-3 bg-orange-50/60 rounded-lg border border-orange-100">
            <span className="text-[11px] font-semibold text-orange-700 uppercase tracking-wider block">
              High Severity
            </span>
            <span className="text-xl font-bold font-tabular text-orange-900 mt-0.5 block">
              {severityCounts.HIGH}
            </span>
            <span className="text-[10px] text-orange-600 mt-0.5 block">
              Stagnant progress or cost rise
            </span>
          </div>

          <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-100">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">
              Medium Warnings
            </span>
            <span className="text-xl font-bold font-tabular text-amber-900 mt-0.5 block">
              {severityCounts.MEDIUM}
            </span>
            <span className="text-[10px] text-amber-600 mt-0.5 block">
              Moderate timeline shifts
            </span>
          </div>

          <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
              Total Signals Active
            </span>
            <span className="text-xl font-bold font-tabular text-[#101A3D] mt-0.5 block">
              {rawWarnings.length}
            </span>
            <span className="text-[10px] text-[#64748B] mt-0.5 block">
              Derived from database
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search warning signal, project name, or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-xs text-[#101A3D] focus:bg-white focus:outline-hidden focus:border-[#0F9D8C]"
            />
          </div>

          {/* Severity */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            aria-label="Filter Warnings by Severity"
            className="py-1.5 px-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-xs text-[#101A3D] focus:bg-white focus:outline-hidden focus:border-[#0F9D8C]"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only ({severityCounts.CRITICAL})</option>
            <option value="HIGH">High Only ({severityCounts.HIGH})</option>
            <option value="MEDIUM">Medium Only ({severityCounts.MEDIUM})</option>
          </select>

          {/* Trigger Category */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter Warnings by Trigger Category"
            className="py-1.5 px-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-xs text-[#101A3D] focus:bg-white focus:outline-hidden focus:border-[#0F9D8C]"
          >
            <option value="ALL">All Warning Triggers</option>
            <option value="COST_ESCALATION">Cost Escalation</option>
            <option value="SCHEDULE_EXTENSION">Schedule Extension</option>
            <option value="PROGRESS_STAGNATION">Progress Stagnation</option>
            <option value="PROGRESS_DECLINE">Progress Regression</option>
            <option value="EXPENDITURE_DIVERGENCE">Expenditure Divergence</option>
          </select>
        </div>

        <span className="text-xs text-[#64748B]">
          Showing {filteredWarnings.length} of {rawWarnings.length} signals
        </span>
      </div>

      {isLoading && (
        <div className="p-8 bg-white rounded-xl border border-[#E2E8F0] flex items-center justify-center gap-2 text-xs text-[#64748B]">
          <Loader2 className="w-5 h-5 animate-spin text-[#0F9D8C]" />
          <span>Computing early warning trigger signals across snapshot database...</span>
        </div>
      )}

      {/* Warnings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredWarnings.map((w) => (
          <div
            key={w.id}
            onClick={() => onSelectProject(w.project_id)}
            className="p-4 bg-white rounded-xl border border-[#E2E8F0] hover:border-[#0F9D8C] hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getSeverityBadgeClass(
                    w.severity
                  )}`}
                >
                  {w.severity}
                </span>
                <span className="font-mono-code text-[11px] font-bold text-[#0F9D8C]">
                  {w.project_id}
                </span>
              </div>

              <div>
                <h3 className="font-bold text-sm text-[#101A3D] leading-snug">
                  {w.title}
                </h3>
                <div className="text-[11px] font-medium text-[#64748B] mt-0.5 truncate" title={w.project_name}>
                  {w.project_name}
                </div>
              </div>

              <p className="text-xs text-[#475569] leading-relaxed bg-[#F8FAFC] p-3 rounded-lg border border-[#F1F5F9]">
                {w.description}
              </p>
            </div>

            <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
              <span className="font-mono-code font-semibold text-[#0F9D8C] text-[11px]">
                {w.metric}
              </span>
              <span className="text-[#0F9D8C] font-semibold flex items-center gap-1 hover:underline">
                <span>View Project File</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {filteredWarnings.length === 0 && !isLoading && (
        <div className="p-12 text-center bg-white rounded-xl border border-[#E2E8F0] text-[#64748B]">
          <CheckCircle className="w-8 h-8 text-[#16A34A] mx-auto mb-2" />
          <p className="font-bold text-sm text-[#101A3D]">No warning signals match active filters</p>
          <p className="text-xs text-[#94A3B8] mt-1">All monitored parameters are within standard thresholds</p>
        </div>
      )}
    </div>
  );
};
